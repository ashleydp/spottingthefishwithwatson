'use strict'

const express = require('express')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')
const request = require('request')

// use `PORT` env var on Beep Boop - default to 3000 locally
var port = process.env.PORT || 3000
var SpotifyWebApi = require('spotify-web-api-node');
// credentials are optional
var spotifyApi = new SpotifyWebApi({
  clientId : 'fcecfc72172e4cd267473117a17cbd4d',
  clientSecret : 'a6338157c9bb5ac9c71924cb2940e1a7',
  redirectUri : 'http://www.example.com/callback'
});

var DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
var async = require('async');
var discovery = new DiscoveryV1({
  username: '2c2d8cd4-e4e3-42e6-b702-fc2057db4200',
  password: 'E5F7lHbWIak0',
  version_date: DiscoveryV1.VERSION_DATE_2016_12_15
});

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})

// attach Slapp to express server
var server = slapp.attachToExpress(express())


var HELP_TEXT = `
I will respond to the following messages:
\`help\` - to see this message.
\`hi\` - to demonstrate a conversation that tracks state.
\`thanks\` - to demonstrate a simple response.
\`<type-any-other-text>\` - to demonstrate a random emoticon response, some of the time :wink:.
\`attachment\` - to see a Slack attachment message.
`


slapp.command('/playlist', (msg) => {
  var message = msg.body.text;
  //msg.respond(message);

  if (message == 'dj cat') {
    msg.respond({
      text: 'Ready to blow this house down! :confetti_ball: ',
      attachments: [{
        text: 'Cat DJ rocking this world..',
        title: 'Meet DJ cat',
        image_url: 'http://media3.giphy.com/media/W8krmZSDxPIfm/giphy-downsized.gif',
        title_link: 'https://beepboophq.com/',
        color: '#7CD197',
        "actions": [
          {
            "name": "playPlaylist",
            "text": "Let's go!",
            "type": "button",
            "value": "play"
          }]
        }]
      })
    }

    discovery.query({ environment_id: '057a6f5b-d16b-4465-b163-dfe7e674e8ac', collection_id: '219f9473-11a9-4b78-b68b-9c9aa3e296b3', query: message }, function(err, data) {
      var articles = [];

      if (err) {
        console.error('Something went wrong!');
      } else {
/*
        msg.respond({
          text: JSON.stringify(data, null, 2)
        })


*/

        async.each(data.results, function(item, callback) {
          msg.respond({
            text: item.title,
            attachments: [{
              title_link: item.url
            }]
          })
          /*
          articles.push({
            title: item.title,
            url: item.url
          });
          */
        });

/*
        var articles = data.results;
        for (var i = 0; i < articles.length; i++) {
          var title = articles[i].title;
          var url = articles[i].url;

          msg.respond({
            text: title,
            attachments: [{
              title_url: url;
            }]
          });
        }
*/
      }
    });
/*
    spotifyApi.searchArtists(message, { limit: 10, offset: 20 }, function(err, data) {
      if (err) {
        console.error('Something went wrong!');
      } else {

        var albums = data.body.artists.items;
        for(var i = 0; i < albums.length; i++) {

          var artist = albums[i].name;
          var url = albums[i].external_urls.spotify;

          if (albums[i].images.length > 0) {
            var imageurl = albums[i].images[1].url;
          } else {
            imageurl = "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRuP5_wqv9qQziKxUNtU74UgSwyWWH7K7GFNPuQY2s9aWxjUXVq";
          }

          msg.respond({
            text: 'This is what we found for your search! :confetti_ball: ',
            attachments: [{
              text: artist,
              title: artist,
              image_url: imageurl,
              title_link: url,
              color: '#7CD197'
              }]
            })


          }
        }
      });
*/
    })



    //*********************************************
    // Setup different handlers for messages
    //*********************************************

    // response to the user typing "help"
    slapp.message('help', ['mention', 'direct_message'], (msg) => {
      msg.say(HELP_TEXT)
    })

    // "Conversation" flow that tracks state - kicks off when user says hi, hello or hey
    slapp
    .message('^(hi|hello|hey)$', ['direct_mention', 'direct_message'], (msg, text) => {
      msg
      .say(`${text}, how are you?`)
      // sends next event from user to this route, passing along state
      .route('how-are-you', { greeting: text })
    })
    .route('how-are-you', (msg, state) => {
      var text = (msg.body.event && msg.body.event.text) || ''

      // user may not have typed text as their next action, ask again and re-route
      if (!text) {
        return msg
        .say("Whoops, I'm still waiting to hear how you're doing.")
        .say('How are you?')
        .route('how-are-you', state)
      }

      // add their response to state
      state.status = text

      msg
      .say(`Ok then. What's your favorite color?`)
      .route('color', state)
    })
    .route('color', (msg, state) => {
      var text = (msg.body.event && msg.body.event.text) || ''

      // user may not have typed text as their next action, ask again and re-route
      if (!text) {
        return msg
        .say("I'm eagerly awaiting to hear your favorite color.")
        .route('color', state)
      }

      // add their response to state
      state.color = text

      msg
      .say('Thanks for sharing.')
      .say(`Here's what you've told me so far: \`\`\`${JSON.stringify(state)}\`\`\``)
      // At this point, since we don't route anywhere, the "conversation" is over
    })

    // Can use a regex as well
    slapp.message(/^(thanks|thank you)/i, ['mention', 'direct_message'], (msg) => {
      // You can provide a list of responses, and a random one will be chosen
      // You can also include slack emoji in your responses
      msg.say([
        "You're welcome :smile:",
        'You bet',
        ':+1: Of course',
        'Anytime :sun_with_face: :full_moon_with_face:'
      ])
    })

    //Goodnight message
    slapp.message('goodnight', ['mention', 'direct_message'], (msg) => {
      msg.say('sweet dreams dude!! :crescent_moon: ')
    })

    // demonstrate returning an attachment...
    slapp.message('attachment', ['mention', 'direct_message'], (msg) => {
      msg.say({
        text: 'Ready to blow this house down! :confetti_ball: ',
        attachments: [{
          text: 'Cat DJ rocking this world..',
          title: 'Meet DJ cat',
          image_url: 'http://media3.giphy.com/media/W8krmZSDxPIfm/giphy-downsized.gif',
          title_link: 'https://beepboophq.com/',
          color: '#7CD197',
          "actions": [
            {
              "name": "playPlaylist",
              "text": "Let's go!",
              "type": "button",
              "value": "play"
            }]
          }]
        })
      })


      // Catch-all for any other responses not handled above
      slapp.message('.*', ['direct_mention', 'direct_message'], (msg) => {
        // respond only 40% of the time
        if (Math.random() < 0.4) {
          msg.say([':wave:', ':pray:', ':raised_hands:'])
        }
      })





      // start http server
      server.listen(port, (err) => {
        if (err) {
          return console.error(err)
        }

        console.log(`Listening on port ${port}`)
      })

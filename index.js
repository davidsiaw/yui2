const Discord = require('discord.js');
const Icy = require('icy');
const client = new Discord.Client();
const WebSocket = require('ws');

client.on('ready', () => {
  console.log('I am ready!');

  var required_channels = process.env.CHANNEL_ID

  var channels = [];

  client.guilds.map( (g) => {
    g.channels.
      filter( (c) => { return required_channels.indexOf(c.id) != -1; } ).
      map ( (c) => { channels.push(c) } );
  });

  channels.map((c)=> {
    c.join()
     .then(connection => {

      var current_stream = null;
      var icy_type = true;

      function setup_events() {

        current_stream.on("start", function(){
          console.log("[SETUP]", "started", c.id)
        });

        current_stream.on("error", function(e){
          console.log("[SETUP]", "errored!");
          console.log("[SETUP]", e);
          current_stream.end();
          start();
        });

        current_stream.on("end", function(e){
          console.log("[SETUP]", "ended!", c.id);
          setTimeout(start, 5000);
        });
      }

      function start() {

        if (icy_type)
        {
          Icy.get("http://listen.moe:9999/stream", function (res) {

            // log the HTTP response headers
            console.error("[START]", res.headers);

            // log any "metadata" events that happen
            res.on('metadata', function (metadata) {
              var parsed = Icy.parse(metadata);
              console.error(parsed);
            });

            current_stream = connection.playStream(res, function(err, str) {console.log("[ERR]", err); console.log("[STR]", str)} );
            setup_events();

          });
        }
        else
        {
          current_stream = connection.playArbitraryInput("http://listen.moe:9999/stream");
          setup_events();
        }
      }

      start();

     })
     .catch(console.error);
  });


  function start_websocket_client() {

    var ws = new WebSocket('wss://listen.moe/api/v2/socket');

    ws.on('open', function open() {
      console.log('connected');
    });

    ws.on('message', function incoming(data) {
      console.log("[WSMSG]", data);

      try {
        var data_json = JSON.parse(data);

        console.log("[WSMSG]", data_json);

        if (data_json["song_name"])
        {
          client.user.setGame(data_json["song_name"] + " - " + data_json["artist_name"]);
        }
      }
      catch (e) {
      }

    });

    ws.on('close', function close() {
      console.log("[WSMSG]", 'disconnected');
      setTimeout(start_websocket_client, 10);
    });

  }

  start_websocket_client();

});


client.on('message', message => {
  if (message.content === 'ping') {
    message.reply('pong');
  }
});

client.login(process.env.BOT_TOKEN);

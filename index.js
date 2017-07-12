const Discord = require('discord.js');
const Icy = require('icy');
const client = new Discord.Client();
const WebSocket = require('ws');

function send(channel)
{
  try
  {
    var message = "[" + new Date() + "]";
    for (var idx in arguments)
    {
      if (idx == 0) { continue; }
      message += " "
      message += arguments[idx]
    }
    channel.send(message);
  }
  catch (e)
  {
    console.log("[SEND]", e)
  }
}

function find_channel(client, chan_id, on_success, on_failure)
{
  var channels = [];

  client.guilds.map( (g) => {
    g.channels.
      filter( (c) => { return chan_id.indexOf(c.id) != -1; } ).
      map ( (c) => { channels.push(c) } );
  });

  if (channels.length == 1)
  {
    on_success(channels[0]);
  }
  else
  {
    on_failure(chan_id);
  }
}

function not_find_chan(chan)
{
  console.log("could not find channel", chan_id)
}

function setup_events(current_stream, c, connection, icy_type, logging_channel)
{
  current_stream.on("start", function(){
    send(logging_channel, "[SETUP]", "started", c.id)
  });

  current_stream.on("error", function(e){
    send(logging_channel, "[SETUP]", "errored!");
    send(logging_channel, "[SETUP]", e);
    current_stream.end();
    setTimeout(()=>{start(c, connection, icy_type);}, 500);
  });

  current_stream.on("end", function(e){
    send(logging_channel, "[SETUP]", "ended!", c.id);
    setTimeout(()=>{start(c, connection, icy_type);}, 500);
  });
}

function start(c, connection, icy_type, logging_channel)
{
  if (icy_type)
  {
    Icy.get("http://listen.moe:9999/stream", function (res) {

      // log the HTTP response headers
      send(logging_channel, "[START]", res.headers);

      // log any "metadata" events that happen
      res.on('metadata', function (metadata) {
        var parsed = Icy.parse(metadata);
        send(logging_channel, "```\n", parsed, "\n```");
      });

      var current_stream = connection.playStream(res, function(err, str) {
        send(logging_channel, "[STRIMERROR]", err); 
        send(logging_channel, "[STRIM]", str);
      } );
      setup_events(current_stream, c, connection, icy_type, logging_channel);

    });
  }
  else
  {
    var current_stream = connection.playArbitraryInput("http://listen.moe:9999/stream");
    setup_events(current_stream, c, connection, icy_type);
  }
}

function play_radio(c, connection, logging_channel)
{
  start(c, connection, true, logging_channel);
}

function start_websocket_client(logging_channel) {

  var ws = new WebSocket('wss://listen.moe/api/v2/socket');

  ws.on('open', function open()
  {
    send(logging_channel, "[WSMSG]", 'connected');
  });

  ws.on('message', function incoming(data) 
  {
    try {
      var data_json = JSON.parse(data);

      send(logging_channel, "[WSMSG]", "```\n", JSON.stringify(data_json, null, 2), "\n```");

      if (data_json["song_name"])
      {
        client.user.setGame(data_json["song_name"] + " - " + data_json["artist_name"]);
      }
    }
    catch (e) {
    }

  });

  ws.on('close', function close()
  {
    send(logging_channel, "[WSMSG]", 'disconnected');
    setTimeout(start_websocket_client, 10);
  });

}

client.on('ready', () => {

  find_channel(client, "331596661954576385", (logging_channel) => {
    send(logging_channel, "(re)Started up")

    find_channel(client, process.env.CHANNEL_ID, (c)=> {
      c.join()
       .then((connection) => { play_radio(c, connection, logging_channel); })
       .catch(console.error);
    }, not_find_chan);

    start_websocket_client(logging_channel);

  }, not_find_chan);

});


client.on('message', message => {
  console.log("[MSG]", message.author, message.content);
  if (message.content === 'yui restart' && message.author.id == "122908555178147840")
  {
    message.reply('Okie~ be right back!');
    client.destroy();
    setTimeout(() => {
      process.exit();
    }, 2000);
    
  }
});

client.login(process.env.BOT_TOKEN);

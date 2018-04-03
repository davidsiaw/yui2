const Discord = require('discord.js');
const Icy = require('icy');
const client = new Discord.Client();
const WebSocket = require('ws');

const LISTEN_MOE_SOCKET_URL = process.env.LISTEN_MOE_SOCKET_URL || "wss://listen.moe/gateway"
const LISTEN_MOE_STREAM_URL = process.env.LISTEN_MOE_STREAM_URL || "https://listen.moe/stream"

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
    console.log("[SENDFAIL]", e)
    setTimeout(() => {
      process.exit();
    }, 100);
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
    Icy.get(LISTEN_MOE_STREAM_URL, function (res) {

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
    var src = LISTEN_MOE_STREAM_URL;
    if (process.env.SOURCE_FILE)
    {
      src = process.env.SOURCE_FILE
    }
    var current_stream = connection.playArbitraryInput(src);
    setup_events(current_stream, c, connection, icy_type, logging_channel);
  }
}

function play_radio(c, connection, logging_channel)
{
  start(c, connection, false, logging_channel);
}

function set_music(client, message)
{
  client.user.setActivity(message, {
    type: "LISTENING",
    url: "https://astrobunny.net"
  }).then(

    (successMessage) => {
      console.log("Set listening to:" + message)

  }).catch(

    (reason) => {
      console.log('Rejected set_music ('+reason+').');

  });
}

function start_websocket_client(logging_channel) {

  var ws = new WebSocket(LISTEN_MOE_SOCKET_URL);
  var heartbeat = null;

  ws.on('open', function open()
  {
    send(logging_channel, "[WSMSG]", 'connected');
    var hello = {op: 0, d: {auth: "Bearer null"}}
    ws.send(JSON.stringify(hello))

    heartbeat = setInterval(function(){
      var poke = {op: 9}
      ws.send(JSON.stringify(poke))
    }, 30000);
  });

  ws.on('message', function incoming(data) 
  {
    try {
      var data_json = JSON.parse(data);

      send(logging_channel, "[WSMSG]", "```\n", JSON.stringify(data_json, null, 2), "\n```");

      if (data_json["op"] === 1 && data_json["t"] === "TRACK_UPDATE")
      {
        if (process.env.SOURCE_FILE)
        {
          set_music(client, process.env.SOURCE_NAME + " - " + process.env.SOURCE_ARTIST);
        }
        else
        {
          var song_name = data_json["d"]["song"]["title"]
          var artist_name = data_json["d"]["song"]["artists"][0]["name"]
          set_music(client, song_name + " - " + artist_name);
        }
      }

    }
    catch (e) {
    }

  });

  ws.on('close', function close()
  {
    send(logging_channel, "[WSMSG]", 'disconnected');
    clearInterval(heartbeat);
    setTimeout(()=>{start_websocket_client(logging_channel)}, 10);
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
  //console.log("[MSG]", message.author, message.content);
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

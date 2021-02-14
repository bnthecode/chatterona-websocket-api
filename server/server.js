import http from "http";
import ws from "websocket";
import redis from "redis";
import { v4 as uuid } from "uuid";
const APPID = process.env.APPID;
let channels = {};
// when saving a connection save the index of the connections for fast deletion
let indexMap = {};
const WebSocketServer = ws.server;

const subscriber = redis.createClient({
  port: 6379,
  host: "rds",
});

const publisher = redis.createClient({
  port: 6379,
  host: "rds",
});

subscriber.on("subscribe", function (cache) {
  console.log(
    "\x1b[35m%s\x1b[0m",
    `Server ${APPID} subscribed successfully to ${cache}`
  );
});

subscriber.on("message", function (cache, message) {
  try {
    const { channelId } = JSON.parse(message);
    const channel = channels[channelId];
    const clients = channel ? channel.connectedClients : [];
    clients.forEach((c) => c.send(message));
  } catch (ex) {
    console.log("ERR::" + ex);
  }
});

subscriber.subscribe("message-cache");

const httpserver = http.createServer();

const websocket = new WebSocketServer({
  httpServer: httpserver,
});

httpserver.listen(5000, () => {
  console.log(
    "\x1b[36m%s\x1b[0m",
    `----- Chatterona websocket server #${APPID}  running on port`,
    "5000",
    "\x1b[36m",
    "-----"
  );
});

const getMessageType = (message, con) => {
  const { channelId, message: updater, type } = JSON.parse(message.utf8Data);
  switch (type) {
    case "join-channel": {
      console.log("\x1b[35m%s\x1b[0m", `joining channel ${channelId}`);
      return handleSocketJoinChannel(channelId, con);
    }
    case "send-message": {
      return publisher.publish("message-cache", message.utf8Data);
    }
    default: {
      console.log(
        "\x1b[31m%s\x1b[0m",
        `websocket server did not handle message event for ${channelId}`
      );
    }
  }
};

websocket.on("request", (request) => {
  console.log("\x1b[33m%s\x1b[0m", `websocket initiated`);

  const con = request.accept(null, request.origin);
  con.on("message", (message) => {
    getMessageType(message, con);
  });
  con.send(`Connected successfully to server ${APPID}`);
  // need a way to clear open connections inside channel map
});

const handleSocketJoinChannel = (channelId, con) => {
  const channel = channels[channelId];
  const currentConnectionLength = channel ? channel.connectedClients.length : 0;
  const connectionId = uuid();

  channels = {
    ...channels,
    [channelId]: {
      ...(channel || {}),
      connectedClients: [...(channel ? channel.connectedClients : []), 
        con,
      ],
    },
  };
  // keep index of connection for easy deletion
  indexMap = {
    ...indexMap,
    [connectionId] : currentConnectionLength
  }

  con.on("close", () => {
    const removalIdx = indexMap[connectionId];
    const foundConnection = channel.connectedClients[removalIdx];
    foundConnection.close();
    channel.connectedClients.splice(indexMap[connectionId]);
  });

  console.log(
    "\x1b[35m%s\x1b[0m",
    `adding to channel sockets --> ${channelId}`
  );
};

// Client
// const ws = new WebSocket('ws://localhost:5000');
// ws.onmessage = message => console.log(`Received: ${message.data}`);
// const joinChannelMsg = { type: 'join-channel', channelId: '12345'};
// ws.send(JSON.stringify(joinChannelMsg));
// then -->
// const messageToChannel = { type: 'send-message', message: 'Whats up guys?', channelId: '12345'};
// ws.send(JSON.stringify(messageToChannel));

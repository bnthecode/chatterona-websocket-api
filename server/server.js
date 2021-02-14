import http from "http";
import ws from "websocket";
import redis from "redis";
const APPID = process.env.APPID;
let channels = {};
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
  console.log(`Server ${APPID} subscribed successfully to ${cache}`);
});

subscriber.on("message", function (message) {
  try {
    const { channelId } = JSON.parse(message);
    const channel = channels[channelId];
    const clients = channel ? channel.connectedClients : [];
    clients.forEach((c) => c.send(APPID + ":" + message));
  } catch (ex) {
    console.log("ERR::" + ex);
  }
});

subscriber.subscribe("message_cache");

const httpserver = http.createServer();

const websocket = new WebSocketServer({
  httpServer: httpserver,
});

httpserver.listen(5000, () =>
  console.log("My server is listening on port 5000")
);

const getMessageType = (channelId, type) => {
  switch (type) {
    case "join-channel": {
      return handleSocketJoinChannel(channelId, con);
    }
    case "send-message": {
      return publisher.publish(message.utf8Data);
    }
    default: {
      console.log("Oh man, what do we do now??");
    }
  }
}

websocket.on("request", (request) => {
  console.log("websocket recieved");

  const con = request.accept(null, request.origin);
  con.on("close", () => console.log("websocket closed"));

  con.on("message", (message) => {
    const { channelId, type } = JSON.parse(message.utf8Data);
    getMessageType(channelId, type);
  });
  con.send(`Connected successfully to server ${APPID}`);
});

const handleSocketJoinChannel = (channelId, con) => {
  const channel = channels[channelId];
  console.log(`joining channel ${channelId}`);
  channels = {
    ...channels,
    [channelId]: {
      ...(channel || {}),
      connectedClients: [...(channel ? channel.connectedClients : []), con],
    },
  };
};


// Client
// const ws = new WebSocket('ws://localhost:5000');
// ws.onmessage = message => console.log(`Received: ${message.data}`);
// const joinChannelMsg = { type: 'join-channel', channelId: '12345'};
// ws.send(JSON.stringify(joinChannelMsg));
// then -->
// const messageToChannel = { type: 'send-message', message: 'Whats up guys?', channelId: '12345'};
// ws.send(JSON.stringify(messageToChannel));

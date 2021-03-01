import http from "http";
import ws from "websocket";
import redis from "redis";
import WebsocketRegistry from "./WebsocketRegistry.js";
const APPID = process.env.APPID;
const WebSocketServer = ws.server;

export const subscriber = redis.createClient({
  port: 6379,
  host: "rds",
});

export const publisher = redis.createClient({
  port: 6379,
  host: "rds",
});


const httpserver = http.createServer();

const wsServer = new WebSocketServer({
  httpServer: httpserver,
  autoAcceptConnections: false,
});

try {
  const websocketRegistry = new WebsocketRegistry(wsServer);
  websocketRegistry.createContext(subscriber, publisher);
  console.log('----------successfully initialized websocket registry-------------')
} catch (error) {
  console.log('error initializing websocket registry..', error.message)
}

httpserver.listen(5000, () => {
  console.log(
    "\x1b[36m%s\x1b[0m",
    `----- Chatterona websocket server #${APPID}  running on port`,
    'version---1',
    "5000",
    "\x1b[36m",
    "-----"
  );
});

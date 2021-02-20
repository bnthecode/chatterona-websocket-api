import { v4 } from "uuid";

class WebsocketRegistry {
  constructor(server) {
    this.websocketServer = server;
    this.channels = {};
    this.connectionPairs = {};
  }

  createContext = (subscriber, publisher) => {
    try {
      this.publisher = publisher;
      this.subscriber = subscriber;
      this.initializeEventListeners(subscriber);
    } catch (error) {
      console.log("error creating websocket pubsub", error.message);
    }
  };

  initializeEventListeners = (subscriber) => {
    try {
      this.websocketServer.on("request", (request) => {
        this.handleWebsocketRequest(request);
      });

      subscriber.on("message", (cache, message) => {
        switch (cache) {
          case "message-cache":
            return this.handleOutgoingWebsocketMessage(message);
          case "channel-typer":
            return this.handleOutgoingWebsocketMessage(message);
          case "existing-connections":
            return this.cleanUpOpenSockets(message);
        }
      });

      subscriber.subscribe("message-cache");
      subscriber.subscribe("existing-connections");
      subscriber.subscribe("channel-typer");
    } catch (error) {
      console.log("error initializing websocket listeners", error.message);
    }
  };

  handleWebsocketRequest = (request) => {
    try {
      console.log("handling initial connection");
      const connection = request.accept(null, request.origin);
      connection.CONNECTION_ID = v4();

      connection.on("message", (message) => {
        this.handleIncomingWebsocketMessage(message, connection);
      });

      connection.on("close", () => {
        console.log("closing connection");
      });
    } catch (error) {
      console.log("error proccessng websocket request", error.message);
    }
  };

  handleIncomingWebsocketMessage = (message, connection) => {
    console.log(message)
    try {
      const { channelId, type } = JSON.parse(
        message.utf8Data
      );
   
      switch (type) {
        
        //text chat
        case "join-channel": {
          return this.handleWebsocketJoinChannel(channelId, connection);
        }
        case "send-message": {
          return this.handleWebsocketSendMessage(message.utf8Data);
        }
        case "channel-typer": {
          return this.handleWebsocketAddChannelTyper(message.utf8Data);
        }
        // voice
        case "join-voice": {
          console.log("im adding myself into voice.., i have the channel id");
          return;
        }
        // case "candidate": {
        //   console.log("candidate...", candidate);
        //   connection.send(
        //     JSON.stringify({
        //       type: "candidate",
        //       offer: offer,
        //     })
        //   );
        //   return;
        // }

        // case "create-offer": {
        //   console.log("offer.....", offer);
        //   connection.send(
        //     JSON.stringify({
        //       type: "create-offer",
        //       offer: offer,
        //     })
        //   );
        //   return;
        // }

        // case "create-answer": {
        //   console.log("answer.....", answer);
        //   connection.send(
        //     JSON.stringify({
        //       type: "create-answer",
        //       answer: answer,
        //     })
        //   );
        //   return;
        // }

        default: {
          console.log(
            "\x1b[31m%s\x1b[0m",
            `websocket server did not handle message event for ${channelId}`
          );
        }
      }
    } catch (error) {
      console.log("error processing websocket incoming message", error.message);
    }
  };

  handleOutgoingWebsocketMessage = (message) => {
    console.log("sending outgoing message");
    try {
      const { channelId } = JSON.parse(message);
      const channel = this.channels[channelId];
      const clients = channel ? channel.connectedClients : [];
      clients.forEach((c) => c.send(message));
    } catch (ex) {
      console.log("ERR::" + ex);
    }
  };

  handleWebsocketJoinChannel = (channelId, connection) => {
    console.log("joining channel --> ", channelId);
    try {
      const channel = this.channels[channelId];
      const connectedToOtherChannel = this.connectionPairs[
        connection.CONNECTION_ID
      ];
      // each time we join a channel we create a new connection id...
      // that connectionId is used to determine if we have already connected

      this.channels = {
        ...this.channels,
        [channelId]: {
          ...(channel || {}),
          connectedClients: [
            ...(channel ? channel.connectedClients : []),
            connection,
          ],
        },
      };
      if (channel && connectedToOtherChannel) {
        // distributed cache keeps all sockets aware of each other
        // somehow make some checks so we dont store shit over and over
        // like if this channel exists push it so everyone else knows it exists

        this.publisher.publish(
          "existing-connections",
          JSON.stringify({
            CONNECTION_ID: connection.CONNECTION_ID,
            channelId: connectedToOtherChannel,
          })
        );
      }

      this.connectionPairs = {
        ...this.connectionPairs,
        [connection.CONNECTION_ID]: channelId,
      };
    } catch (error) {
      console.log("error joining channel", error.message);
    }
  };

  handleWebsocketSendMessage = (message) => {
    try {
      console.log("handling incoming message, of type message");
      this.publisher.publish("message-cache", message);
    } catch (error) {
      console.log("error sending message", error.message);
    }
  };

  handleWebsocketAddChannelTyper = (typer) => {
    try {
      this.publisher.publish("channel-typer", typer);
    } catch (error) {
      console.log("error sending message", error.message);
    }
  };

  cleanUpOpenSockets = (redisUpdate) => {
    // not too bad because channels dont really have a ridiculous amount of people listening at once..
    const { CONNECTION_ID, channelId } = JSON.parse(redisUpdate);
    // this is to update is to keep in sync with other servers
    if (this.channels[channelId]) {
      this.channels[channelId] = {
        ...this.channels[channelId],
        connectedClients: [
          ...this.channels[channelId].connectedClients.filter(
            (n) => n.CONNECTION_ID !== CONNECTION_ID
          ),
        ],
      };
    }
  };
}

export default WebsocketRegistry;

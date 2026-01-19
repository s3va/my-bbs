import { DurableObject } from "cloudflare:workers";

// Durable Object
export class WebSocketHibernationServer extends DurableObject {

  sessions;

  constructor(ctx, env) {
    super(ctx, env);

    this.sessions = new Map();

    this.ctx.getWebSockets().forEach((ws) => {
      let attachment = ws.deserializeAttachment();
      if (attachment) {
        // If we previously attached state to our WebSocket,
        // let's add it to `sessions` map to restore the state of the connection.
        this.sessions.set(ws, { ...attachment });
      }
    });

    // Sets an application level auto response that does not wake hibernated WebSockets.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }

  async fetch(request) {

    console.log(`**************** ${request.url}`);
    console.log(`**************** ${request.headers.get("Authorization")}`)
    const authorization = request.headers.get("Authorization");
    const [scheme, encoded] = authorization.split(" ");
    const credentials = Buffer.from(encoded, "base64").toString();
    const index = credentials.indexOf(":");
    const user = credentials.substring(0, index);
    console.log(`**************** ${user}`)

    // Creates two ends of a WebSocket connection.
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);


    ////////////////////////////////////////////////
    // Calling `acceptWebSocket()` informs the runtime that this WebSocket is to begin terminating
    // request within the Durable Object. It has the effect of "accepting" the connection,
    // and allowing the WebSocket to send and receive messages.
    // Unlike `ws.accept()`, `this.ctx.acceptWebSocket(ws)` informs the Workers Runtime that the WebSocket
    // is "hibernatable", so the runtime does not need to pin this Durable Object to memory while
    // the connection is open. During periods of inactivity, the Durable Object can be evicted
    // from memory, but the WebSocket connection will remain open. If at some later point the
    // WebSocket receives a message, the runtime will recreate the Durable Object
    // (run the `constructor`) and deliver the message to the appropriate handler.
    ///////////////////////////////////////////////

    // Calling `acceptWebSocket()` connects the WebSocket to the Durable Object, allowing the WebSocket to send and receive messages.
    // Unlike `ws.accept()`, `state.acceptWebSocket(ws)` allows the Durable Object to be hibernated
    // When the Durable Object receives a message during Hibernation, it will run the `constructor` to be re-initialized
    this.ctx.acceptWebSocket(server);
    // Generate a random UUID for the session.
    const id = crypto.randomUUID();
    // Attach the session ID to the WebSocket connection and serialize it.
    // This is necessary to restore the state of the connection when the Durable Object wakes up.
    if (this.sessions.size > 12) {
      return new Response("Chat FULL!!!!", {
        status: 503,
      });
    }
    server.serializeAttachment({ id, user });
    // Add the WebSocket connection to the map of active sessions.
    this.sessions.set(server, { id, user });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws, message) {
    // Get the session associated with the WebSocket connection.
    const session = this.sessions.get(ws);

    if (!session.connectiontime) {
      const connectiontime = new Date().toISOString();
      console.log("first message");
      session.connectiontime = connectiontime;
      ws.serializeAttachment({ ...ws.deserializeAttachment(), connectiontime });
      this.sessions.forEach((s, websock) => {
        if(s.connectiontime){
          ws.send(JSON.stringify({ joined: s.user + ` (${s.id.slice(-4)})` }, null, 8));
        };
        console.log(JSON.stringify({ joined: s.user  + ` (${s.id.slice(-4)})`}, null, 8));
        if (ws!=websock && s.connectiontime ) {
          websock.send(JSON.stringify({ joined: session.user + ` (${session.id.slice(-4)})` }, null, 8));
        };
      });
    }

    // Upon receiving a message from the client, reply with the same message,
    // but will prefix the message with "[Durable Object]: " and return the number of connections.
    // ws.send(
    //   //`[Durable Object] message: ${message}, connections: ${this.ctx.getWebSockets().length}\n` +
    //   //`  [Durable Object] message: ${message}, from: ${session.id} (${session.user}), to: the initiating client. Total connections: ${this.sessions.size}`
    //   {message,session}
    //   ,
    // );

    // Send a message to all WebSocket connections, loop over all the connected WebSockets.
    // this.sessions.forEach((attachment, ws) => {
    //   const time = new Date().toISOString();
    //   ws.send(
    //     //`[Durable Object] message: ${message}, from: ${session.id} (${session.user}), to: all clients. Total connections: ${this.sessions.size}`,
    //     JSON.stringify({ message, session, time }, null, 8),
    //   );
    //   console.log(JSON.stringify({ message, session, time }, null, 8));
    // });

    this.broadcast(message, session)

    // // Send a message to all WebSocket connections except the connection (ws),
    // // loop over all the connected WebSockets and filter out the connection (ws).
    // this.sessions.forEach((attachment, connectedWs) => {
    //   if (connectedWs !== ws) {
    //     connectedWs.send(
    //       `[Durable Object] message: ${message}, from: ${session.id}, to: all clients except the initiating client. Total connections: ${this.sessions.size}`,
    //     );
    //   }
    // });

  }

  async webSocketClose(ws, code, reason, wasClean) {
    // If the client closes the connection, the runtime will invoke the webSocketClose() handler.
    const u = this.sessions.get(ws).user;
    const i = this.sessions.get(ws).id.slice(-4);

    this.sessions.delete(ws);
    ws.close(code, "Durable Object is closing WebSocket");
    this.sessions.forEach((sess, wsock) => {
      wsock.send(JSON.stringify({ exit: u + ` (${i})` },null,8));
    });
  }

  // broadcast() broadcasts a message to all clients.
  broadcast(message, session) {
    // Apply JSON if we weren't given a string to start with.
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }

    // Iterate over all the sessions sending them messages.
    let quitters = [];
    this.sessions.forEach((s, ws) => {
      if (s.connectiontime) {
        try {
          //ws.send(message);
          const time = new Date().toISOString();
          ws.send(
            JSON.stringify({ message, session, time }, null, 8),
          );
          console.log(JSON.stringify({ message, session, time }, null, 8));
        } catch (err) {
          // Whoops, this connection is dead. Remove it from the map and arrange to notify
          // everyone below.
          s.quit = true;
          quitters.push(s);
          this.sessions.delete(ws);
        }
      } else {
        // This session hasn't sent the initial user info message yet, so we're not sending them
        // messages yet (no secret lurking!). Queue the message to be sent later.
        //session.blockedMessages.push(message);
      }
    });

    quitters.forEach(quitter => {
      if (quitter.user) {
        this.broadcast({ quit: quitter.user + ` (${quitter.id.slice(-4)})` });
      }
    });
  }
}

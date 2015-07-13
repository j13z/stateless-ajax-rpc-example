# Stateless AJAX RPC Example


*An example project.*

The main purpose of this example is to show how a “mixed” AJAX response with unknown content type can be handled by a browser client using jQuery. (jQuery’s AJAX implementation is used as it provides good browser compatibility. This is *not* REST.)

- A **Node.js web server** serves API requests. Contacts an **RCP server / worker** via **RabbitMQ** (AMQP), which generates files that should be served to the client (e.g. create a PDF or process an image or audio).

- The **browser client** makes requests using a custom jQuery AJAX transport. It does not know the content type of the response in advance: It’s either binary data on success, or JSON if there is an error. jQuery can’t handle binary (`Blob`) responses out of the box.

- The server system **does not keep any state**. After processing the request, it sends a response and forgets about the request. Instead of responding with file links, it **sends binary data directly to the browser client** (or JSON in case of an error).

- Processing can be scaled to accommodate higher load by using multiple RPC server instances. (File processing is mocked here.)

An alternative to the binary response format would be to embed the Base64 encoding into a JSON response. 


## Motivation

*Example use case:*

Generate PDFs on a server, but *without keeping state* in form of client PDF files (that have yet to be retrieved) on the server. Instead, send each client the PDF and forget about it, i.e. delete the file. This frees the server from keeping track of file lifetimes etc.

*Drawback:* Does not provide progress information; which is however not a drawback if no meaningful progress information can be generated anyway.


## Run it

Dependencies: RabbitMQ, Node.js

- `$ npm install`
- Build the project (compile ES6): `$ ./node_modules/.bin/gulp` (or just `gulp`)
- Start RabbitMQ server (tmux recommended): `[shell1] $ rabbitmq-server`
- Start web server: `[shell2] $ ./dist/server.js`
- Start RPC server: `[shell3] $ ./dist/rpc-server.js` (add more instances as needed)
- Open the browser client: [http://127.0.0.1:8000/client.html](http://127.0.0.1:8000/client.html)


## Notes

- Would use HTTPS in production.

- See [RabbitMQ’s RPC example](http://www.rabbitmq.com/tutorials/tutorial-six-python.html).

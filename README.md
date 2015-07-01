# Stateless AJAX RPC Example


*Example project.*

- **Node.js web server** serves API requests. Contacts an **RCP server / worker** via RabbitMQ (AMQP) which generates files that should be served to the client (e.g. create a PDF or process an image / audio).

- **Browser client** makes requests via jQuery using a custom AJAX transport. The client does not know the content type of the response in advance, it's either binary data on success, or JSON if there is an error.
- The server system does not keep any state. It processes requests, sends a requests and forgets about them. Instead of responding with file links, it **sends binary data directly to the client**.

- Processing can be scaled to accommodate higher load by using multiple RPC server instances. (File processing is mocked here.)

The main purpose of this example is to show how the "mixed" (unknown) AJAX response can be handled by the client using jQuery. (jQuery is used for browser compatibility.)



## Motivation

*Example use case:*

Generate PDFs on the server, but *without keeping state* in form of client PDF documents on the server. Instead, send each client the PDF and forget about it. This frees the server from keeping track of processing result lifetimes etc.

*Drawback:* Does not provide progress information; which is however not a drawback if no meaningful progress information can be generated anyway.



## Notes

Would use HTTPS in production.

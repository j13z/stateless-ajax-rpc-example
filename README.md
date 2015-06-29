# jQuery AJAX Example with Mixed Response type

Author: j13z

*Example project I made for myself to test the mechanics of retrieving a "mixed" AJAX response via jQuery.*

- Client makes an XHR requests to a server API using jQuery.
- Server returns either JSON or binary data.
- Client should be able to handle both. Requires custom AJAX transport for jQuery. Without jQuery you would have to work around all the browser compatibility issues on your own.


## Use Case

*Original use case:* Simple RPC call that generates a file (web server calls worker), but server should be stateless.

- Request processing from a server that generates a file.

- Keep the server **stateless**: Server should be able to handle a request by producing a file, sending it to the client *and then forgetting about it*. (The server can thus delete all temporary files on after sending the response.) An alternative would be to produce the file, deposit it on a local file system and send the client a link to the file. This however imposes the server the task of cleaning up / expiring files periodically, probably requiring another worker, if the server itself should be responsible only for HTTP.

- No progress information is sent to the client (as it could not be generated anyway because the processing does not provide feedback).

- The file that’s served from the file system here would be generated via an RPC (and one or more RPC servers / workers) in a real scenario.


## Notes

The server is just a very basic example. Would use HTTPS in a real scenario (Basic Authentication).

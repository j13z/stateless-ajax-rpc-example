#!/usr/bin/env node
'use strict';

var http = require('http');
var fs   = require('fs');
var amqp = require('amqplib');
var uuid = require('node-uuid');

var args = Array.prototype.slice.call(process.argv, 2);
var port = args[0] || 8000;



var credentialsStore = (function () {

	var credentials = JSON.parse(fs.readFileSync('credentials.json'));

	return {
		validate: function (id, secret) {
			var validArgs = id.length > 0 && secret.length > 0;
			return validArgs && credentials[id] === secret;
		}
	}
})();



// Returns `true` or `false`, alternating
var alternate = (function () {
	var value = 0;

	return function () {
		var result = value;
		value = (value + 1) & 1;
		return result === 0;
	};
})();




makeRpcRequest().then(function (response) {
	console.log(response);
});




/**
 * @return {Promise}
 */
function makeRpcRequest() {

	console.log('make request');

	// Would proably look much nicer with ES6 arrow functions …

	// FIXME: Don't connect *per request*.
	return amqp.connect('amqp://localhost').then(function (connection) {

		return connection.createChannel().then(function (channel) {

			var deferred = Promise.defer();
			var correlationId = uuid();

			function maybeAnswer(message) {
				if (message.properties.correlationId === correlationId) {
					deferred.resolve(message.content.toString());
				}
			}

			return channel.assertQueue('', { exclusive: true })
			.then(function (result) {
				var queue = result.queue;

				return channel.consume(queue, maybeAnswer, { noAck: true })
				.then(function () {
					console.log(' [x] Requesting (RPC)');
					var value = 'foo';    // FIXME

					channel.sendToQueue('rpc_queue', new Buffer(value), {
						correlationId: correlationId,
						replyTo: queue
					});

					return deferred.promise;
				});
			});
		});
	})
	.catch(function (error) {
		console.error(error.stack);    // FIXME
	});
}



/**
 * Parses and evaluates (authenticates) a HTTP Basic Authentication header.
 *
 * Sets a boolean `isAuthenticated` property on the response.
 */
var authenticate = (function () {

	var splitRegex = /(.*):(.*)/;

	return function (request) {

		var header = request.headers['authorization'];    // keys are lowercase
		if (!header) {
			return;
		}

		var base64Value = header.slice(6);
		var utf8Value = (new Buffer(base64Value, 'base64')).toString('utf8');

		// FIXME: Has a Unicode encoding issue for multibyte UTF-8
		var parts = utf8Value.match(splitRegex);
		if (!parts) {
			console.log('Received invalid `Authorization` header:', header);
			return;
		}

		var username = parts[1];
		var password = parts[2];

		request.isAuthenticated = credentialsStore.validate(username, password);
	};
})();



http.ServerResponse.prototype.sendFile = function(filename, contentType) {
	this.writeHead(200, { 'Content-Type': contentType });
	fs.createReadStream(filename).pipe(this);
}


var handlers = {
	'/data': function (request, response) {

		if (!request.isAuthenticated) {
			response.statusCode = 401;    // Unauthorized
			response.end();
			return;
		}

		// Create either a JSON response or some other response
		// (`application/pdf` here) that would be parsed as binary data by the
		// JavaScript web client.

		if (alternate() === true) {
			response.writeHead(200, {
				'Content-Type': 'application/json; charset=UTF-8'
			});
			response.end(JSON.stringify({ message: 'Hello World'}));
		}
		else {
			setTimeout(function () {
				response.writeHead(200, { 'Content-Type': 'application/pdf' });
				fs.createReadStream('assets/document.pdf').pipe(response);
			}, 300);
		}
	},

	'/client': function (request, response) {
		response.sendFile(
			'client.html',
			'text/html; charset=UTF-8'
		);
	},

	'/jquery-2.1.4.min.js': function (request, response) {
		response.sendFile(
			'jquery-2.1.4.min.js',
			'application/javascript; charset=UTF-8'
		);
	}
}


http.createServer(function (request, response) {

	var handler = handlers[request.url];

	if (handler) {
		authenticate(request);

		console.log(
			'[Request] ' + request.url +
			(request.isAuthenticated ? ' (authenticated)' : '')
		);

		handler(request, response);
	}
	else {
		response.statusCode = 404;
		response.end();
	}
})
.listen(port, '127.0.0.1');


console.log('Server running at http://127.0.0.1:' + port);

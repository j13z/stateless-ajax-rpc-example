#!/usr/bin/env node
'use strict';

var http = require('http');
var fs   = require('fs');

var amqp = require('amqplib');
var uuid = require('node-uuid');

var express = require('express');
var bodyParser = require('body-parser');


var args = Array.prototype.slice.call(process.argv, 2);
var port = args[0] || 8000;
var rabbitMqUri = 'amqp://localhost';


/**
 * Primitive API authentication store.
 */
var credentialsStore = (function () {

	var credentials = JSON.parse(fs.readFileSync('credentials.json'));

	return {
		validate: function (id, secret) {
			var validArgs = id.length > 0 && secret.length > 0;
			return validArgs && credentials[id] === secret;
		}
	}
})();



// Express

var app = express();
app.use(express.static('static'));
app.use(bodyParser.json());    // parses all `application/json` requests

app.use(function (request, response, next) {
	console.log('[Request]  ' + request.url);
	next();
});



// TODO: Swap this out with some express-ready solution.
/**
 * Parses and evaluates (authenticates) an HTTP Basic Authentication header.
 *
 * Sets a boolean `isAuthenticated` property on the response.
 */
var authenticate = (function () {

	var splitRegex = /(.*):(.*)/;

	return function (request, response, next) {

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

		next();
	};
})();

app.use(authenticate);




// Returns `true` or `false`, alternating
var alternate = (function () {
	var value = 0;

	return function () {
		var result = value;
		value = (value + 1) & 1;
		return result === 0;
	};
})();




/**
 * @return {Promise}
 */
function makeRpcRequest(channel, data) {

	// Would proably look much nicer with ES6 arrow functions …

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
			console.log('Performing RPC request: ' + correlationId);

			channel.sendToQueue('rpc_queue', new Buffer(data), {
				correlationId: correlationId,
				replyTo: queue
			});

			return deferred.promise;
		});
	});
}



app.post('/generate-pdf', function (request, response) {

	if (!request.isAuthenticated) {
		response.statusCode = 401;    // Unauthorized
		response.end();
		return;
	}

	// Create either a JSON response or some other response
	// (`application/pdf` here) that would be parsed as binary data by the
	// JavaScript web client.

	if (alternate() === true) {
		setTimeout(function () {
			response.json({
				success: false,
				error:  'I’m sorry, Dave. I’m afraid I can’t do that.'
			});
		}, 200);
	}
	else {
		var input = request.body.input;

		makeRpcRequest(input).then(function (result) {
			result = JSON.parse(result);

			console.log(
				'RPC result for ' + result.correlationId + ': "' +
				result.filename + '"'
			);

			response.writeHead(200, { 'Content-Type': 'application/pdf' });
			fs.createReadStream(result.filename).pipe(response);
		})
		.catch(function (error) {
			// FIXME
			console.error(error.stack);
			console.log('Continuing …');
		});
	}
});




// Connect to RabbitMQ, start the HTTP server
//
amqp.connect(rabbitMqUri).then(function (connection) {

	return connection.createChannel().then(function (channel) {

		makeRpcRequest = makeRpcRequest.bind(null, channel);

		var server = app.listen(port, function () {
			console.log('Server running at http://127.0.0.1:' + port);
		});
	});
})
.catch(function (error) {
	console.error(error.stack);    // FIXME
});


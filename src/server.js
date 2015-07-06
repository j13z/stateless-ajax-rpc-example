#!/usr/bin/env node

import fs from 'fs';
import amqp from 'amqplib';
import uuid from 'node-uuid';

import express from 'express';
import bodyParser from 'body-parser';


const args = Array.prototype.slice.call(process.argv, 2);
const port = args[0] || 8000;
const rabbitMqUri = 'amqp://localhost';


/**
 * Primitive API authentication store.
 */
const credentialsStore = (function () {

	const credentials = JSON.parse(fs.readFileSync('credentials.json'));

	return {
		validate(id, secret) {
			const validArgs = id.length > 0 && secret.length > 0;
			return validArgs && credentials[id] === secret;
		}
	};
})();



// Express

const app = express();
app.use(express.static('static'));
app.use(bodyParser.json());    // parses all `application/json` requests

app.use((request, response, next) => {
	console.log('[Request]  ' + request.url);
	next();
});



// TODO: Swap this out with some express-ready solution.
/**
 * Parses and evaluates (authenticates) an HTTP Basic Authentication header.
 *
 * Sets a boolean `isAuthenticated` property on the response.
 */
const authenticate = (function () {

	const splitRegex = /(.*):(.*)/;

	return (request, response, next) => {

		const header = request.headers['authorization'];    // keys are lowercase
		if (!header) {
			return;
		}

		const base64Value = header.slice(6);
		const utf8Value = (new Buffer(base64Value, 'base64')).toString('utf8');

		// FIXME: Has a Unicode encoding issue for multibyte UTF-8
		const parts = utf8Value.match(splitRegex);
		if (!parts) {
			console.log('Received invalid `Authorization` header:', header);
			return;
		}

		const username = parts[1];
		const password = parts[2];

		request.isAuthenticated = credentialsStore.validate(username, password);

		next();
	};
})();

app.use(authenticate);




// Returns `true` or `false`, alternating
const alternate = (function () {
	let value = 0;

	return function () {
		const result = value;
		value = (value + 1) & 1;
		return result === 0;
	};
})();




/**
 * @return {Promise}
 */
function makeRpcRequest(channel, data) {

	const deferred = Promise.defer();
	const correlationId = uuid();

	function maybeAnswer(message) {
		if (message.properties.correlationId === correlationId) {
			deferred.resolve(message.content.toString());
		}
	}

	return channel.assertQueue('', { exclusive: true }).then(result => {
		const queue = result.queue;

		return channel.consume(queue, maybeAnswer, { noAck: true }).then(() => {

			console.log('Performing RPC request: ' + correlationId);

			channel.sendToQueue('rpc_queue', new Buffer(data), {
				correlationId: correlationId,
				replyTo: queue
			});

			return deferred.promise;
		});
	});
}



app.post('/generate-pdf', (request, response) => {

	if (!request.isAuthenticated) {
		response.statusCode = 401;    // Unauthorized
		response.end();
		return;
	}

	// Create either a JSON response or a binary response (`application/pdf`)

	const isSuccess = alternate();

	if (isSuccess) {
		const input = request.body.input;

		makeRpcRequest(input).then(result => {

			result = JSON.parse(result);
			const filename = result.filename;

			console.log('Got RPC result:  ' + filename);

			response.writeHead(200, { 'Content-Type': 'application/pdf' });
			const readStream = fs.createReadStream(filename);

			readStream.pipe(response).on('finish', () => {

				// Delete file, but don't wait for that
				fs.unlink(filename, error => {
					if (error) {
						// FIXME: Handle properly.
						console.error('Could not delete file');
						handleError(error);
					}
					else {
						console.log('Deleted ' + filename);
					}
				});
			});
		})
		.catch(handleError);
	}
	else {
		setTimeout(() => {
			response.json({
				success: false,
				error:  'I’m sorry, Dave. I’m afraid I can’t do that.'
			});
		}, 200);
	}
});



function handleError(error) {
	// FIXME: Handle properly
	console.error(error.stack);
	console.log('Continuing …');
}



// Connect to RabbitMQ, start the HTTP server
//
amqp.connect(rabbitMqUri).then(connection => {

	return connection.createChannel().then(channel => {

		makeRpcRequest = makeRpcRequest.bind(null, channel);

		// (Would use HTTPS for production)
		app.listen(port, () => {
			console.log('Server running at http://127.0.0.1:' + port);
		});
	});
})
.catch(handleError);


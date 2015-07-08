#!/usr/bin/env node

const isRequired = require.main !== module;    // Is not run from shell

import fs   from 'fs';
import amqp from 'amqplib';
import uuid from 'node-uuid';

import express    from 'express';
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



function log() {

	if (!isRequired) {
		console.log.apply(null, arguments);
	}
}



// Express

const app = express();
app.use(express.static('static'));
app.use(bodyParser.json());    // parses all `application/json` requests

// Console logging
if (!isRequired) {
	app.use((request, response, next) => {
		log('[Request]  ' + request.url);
		next();
	});
}



// TODO: Swap this out with some express-ready solution.
/**
 * Parses and evaluates (authenticates) an HTTP Basic Authentication header.
 *
 * Sets a boolean `isAuthenticated` property on the response.
 */
const authenticate = (function () {

	const splitRegex = /(.*):(.*)/;

	return (request, response, next) => {

		const header = request.headers['authorization'];   // keys are lowercase
		if (!header) {
			next();
			return;
		}

		const base64Value = header.slice(6);
		const utf8Value = (new Buffer(base64Value, 'base64')).toString('utf8');

		// FIXME: Has a Unicode encoding issue for multibyte UTF-8
		const parts = utf8Value.match(splitRegex);
		if (!parts) {
			log('Received invalid `Authorization` header:', header);
			next();
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

			log('Performing RPC request: ' + correlationId);

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
		response.status(401).end();    // Unauthorized
		return;
	}

	// Create either a JSON response or a binary response (`application/pdf`)

	const isSuccess = alternate();

	if (isSuccess) {
		const input = request.body.input;

		makeRpcRequest(input).then(result => {

			result = JSON.parse(result);
			const filename = result.filename;

			log('Got RPC result:  ' + filename);

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
						log('Deleted ' + filename);
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
	log('Continuing …');
}



/**
 * Connects to the RabbitMQ server and starts the web server.
 *
 * @return {Promise}
 */
function createServer(port) {

	return amqp.connect(rabbitMqUri).then(connection => {

		return connection.createChannel().then(channel => {

			makeRpcRequest = makeRpcRequest.bind(null, channel);

			// (Would use HTTPS for production)
			const server = app.listen(port, () => {
				log('Server running at http://127.0.0.1:' + port);
			});

			return server;
		})
		.catch(handleError);
	})
	.catch(error => {
		console.error('Could not connect to RabbitMQ server\n\n' + error.stack);
		process.exit(1);
	});
}



if (!isRequired) {
    createServer(port);
}

export default createServer;

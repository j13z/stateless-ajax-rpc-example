#!/usr/bin/env node

const isRequired = require.main !== module;    // Is not run from shell

import fs   from 'fs';
import amqp from 'amqplib';


/**
 * Responds to the RPC call with a filename.
 */
function reply(channel, message) {

	const input = message.content.toString();
	const correlationId = message.properties.correlationId;

	generateFile(input, correlationId).then(filename => {

		const result = {
			filename: filename,
			correlationId: correlationId
		};

		log('Serving request ' + correlationId);

		channel.sendToQueue(
			message.properties.replyTo,
			new Buffer(JSON.stringify(result)),
			{ correlationId: correlationId }
		);

		channel.ack(message);
	})
	.catch(handleError);
}



/**
 * @return {Promise}    Promise for the output filename.
 *                      Client may (and should) delete the file after "cosuming"
 *                      it.
 */
function generateFile(input, uuid) {

	log('Generating file for request ' + uuid);

	const outputFilename = 'outputs/' + uuid + '.pdf';
	const readStream  = fs.createReadStream('static/example_document.pdf');
	const writeStream = fs.createWriteStream(outputFilename);

	return new Promise(resolve => {

		// Mocked here: Just create the output file by copying an example file.
		readStream.pipe(writeStream).on('finish', () => {
			// Simulate some work
			setTimeout(() => {
				resolve(outputFilename);
			}, 300);
		});
	});
}


/**
 * Connects to the RabbitMQ broker and listens for RPC requests.
 *
 * @return {Promise}
 */
function connect() {

	return amqp.connect('amqp://localhost').then(connection => {

		process.once('SIGINT', () => {
			connection.close();
		});

		return connection.createChannel().then(channel => {

			const queueName = 'rpc_queue';

			return channel.assertQueue(queueName, {
				durable: false
			})
			.then(() => {
				channel.prefetch(1);
				return channel.consume(queueName, reply.bind(null, channel));
			});
		});
	})
	.then(() => {
		log('Awaiting RPC requests');
	})
	.catch(handleError);
}



function log() {

	if (!isRequired) {
		console.log.apply(null, arguments);
	}
}


function handleError(error) {
	console.warn(error);    // FIXME: Error handling / logging
}


if (!isRequired) {
    connect();
}

export default connect;

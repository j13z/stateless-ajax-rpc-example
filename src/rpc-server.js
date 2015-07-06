#!/usr/bin/env node

import fs from 'fs';
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

		console.log('Serving request ' + correlationId);

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

	console.log('Generating file for request ' + uuid);

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



amqp.connect('amqp://localhost').then(connection => {

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
	console.log('Awaiting RPC requests');
})
.catch(handleError);


function handleError(error) {
	console.warn(error);    // FIXME: Error handling / logging
}

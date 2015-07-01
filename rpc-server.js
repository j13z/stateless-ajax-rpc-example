#!/usr/bin/env node

'use strict';

var fs   = require('fs');
var amqp = require('amqplib');


/**
 * Responds to the RPC call with a filename.
 */
function reply(channel, message) {

	var input = message.content.toString();
	var correlationId = message.properties.correlationId;

	generateFile(input, correlationId).then(function (filename) {

		var result = {
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

	var outputFilename = 'outputs/' + uuid + '.pdf';
	var readStream  = fs.createReadStream('static/example_document.pdf');
	var writeStream = fs.createWriteStream(outputFilename);

	return new Promise(function (resolve, reject) {

		// Mocked here: Just create the output file by copying an example file.
		readStream.pipe(writeStream).on('finish', function () {
console.log('writeStream finished');
			// Simulate some work
			setTimeout(function () {
				resolve(outputFilename);
			}, 300);
		});
	});
}



amqp.connect('amqp://localhost').then(function (connection) {

	process.once('SIGINT', function () {
		connection.close();
	});

	return connection.createChannel().then(function (channel) {

		var queueName = 'rpc_queue';

		return channel.assertQueue(queueName, {
			durable: false
		})
		.then(function () {
			channel.prefetch(1);
			return channel.consume(queueName, reply.bind(null, channel));
		});
	});
})
.then(function () {
	console.log('Awaiting RPC requests');
})
.catch(handleError);


function handleError(error) {
	console.warn(error);    // FIXME: Error handling / logging
}

#!/usr/bin/env node
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _amqplib = require('amqplib');

var _amqplib2 = _interopRequireDefault(_amqplib);

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

		channel.sendToQueue(message.properties.replyTo, new Buffer(JSON.stringify(result)), { correlationId: correlationId });

		channel.ack(message);
	})['catch'](handleError);
}

/**
 * @return {Promise}    Promise for the output filename.
 *                      Client may (and should) delete the file after "cosuming"
 *                      it.
 */
function generateFile(input, uuid) {

	console.log('Generating file for request ' + uuid);

	var outputFilename = 'outputs/' + uuid + '.pdf';
	var readStream = _fs2['default'].createReadStream('static/example_document.pdf');
	var writeStream = _fs2['default'].createWriteStream(outputFilename);

	return new Promise(function (resolve) {

		// Mocked here: Just create the output file by copying an example file.
		readStream.pipe(writeStream).on('finish', function () {
			// Simulate some work
			setTimeout(function () {
				resolve(outputFilename);
			}, 300);
		});
	});
}

_amqplib2['default'].connect('amqp://localhost').then(function (connection) {

	process.once('SIGINT', function () {
		connection.close();
	});

	return connection.createChannel().then(function (channel) {

		var queueName = 'rpc_queue';

		return channel.assertQueue(queueName, {
			durable: false
		}).then(function () {
			channel.prefetch(1);
			return channel.consume(queueName, reply.bind(null, channel));
		});
	});
}).then(function () {
	console.log('Awaiting RPC requests');
})['catch'](handleError);

function handleError(error) {
	console.warn(error); // FIXME: Error handling / logging
}
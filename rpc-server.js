#!/usr/bin/env node

var amqp = require('amqplib');


/**
 * Replies with a PDF filename.
 */
function reply(channel, message) {
	var input = message.content.toString();
	var correlationId = message.properties.correlationId;

	generatePdf(input, correlationId).then(function (filename) {


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
	});
}



/**
 * @return {Promise}
 */
function generatePdf(input, uuid) {
	// TODO: Implement (require module)

	console.log('Generate PDF for ' + uuid);

	return new Promise(function (resolve, reject) {
		setTimeout(function () {
			resolve('static/document.pdf');
		}, 300);
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
.then(null, console.warn);    // FIXME

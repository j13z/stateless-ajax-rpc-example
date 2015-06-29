#!/usr/bin/env node

var amqp = require('amqplib');

function reply(channel, message) {
	// var n = parseInt(message.content.toString());
	// console.log(' [.] fib(%d)', n);
	console.log(' [.] serving request');
	var response = 'hello';

	channel.sendToQueue(
		message.properties.replyTo,
		new Buffer(response.toString()),
		{ correlationId: message.properties.correlationId }
	);

	channel.ack(message);
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
	console.log(' [x] Awaiting RPC requests');
})
.then(null, console.warn);    // FIXME

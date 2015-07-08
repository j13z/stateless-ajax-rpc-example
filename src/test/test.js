/* global describe, it, before, after */

const expect  = require('chai').expect;
const request = require('supertest');

const createWebServer  = require('../server');
const connectRpcServer = require('../rpc-server');


const authValue = 'Basic bXlfYXBpX2lkOiRlY3JldA==';
const testInput = 'Hello, world!';



describe('POST (JSON) /generate-pdf', () => {

	let webServer;


	before(done => {

		createWebServer(8000).then(_server => {
			webServer = _server;

			connectRpcServer().then(done);
		});
	});


	after(() => {

		webServer.close();
	});



	it('should respond with 401 if not authorized', done => {

		request(webServer)
			.post('/generate-pdf')
			.set('Accept', 'application/json')

			.expect(401, done);
	});



	function expectPdfResponse(done) {

		request(webServer)
			.post('/generate-pdf')
			.set('Authorization', authValue)
			.send({ input: testInput })

			.expect(200)
			.expect('Content-Type', 'application/pdf')
			.end(done);
	}


	function expectJsonResponse(done) {

		request(webServer)
			.post('/generate-pdf')
			.set('Authorization', authValue)
			.send({ input: testInput })

			.expect(200)
			.expect('Content-Type', /application\/json/)
			.expect(response => {
				expect(response.body.success).to.equal(false);
				expect(response.body).to.have.property('error');
			})
			.end(done);
	}


	it('should respond with `application/pdf`  on the first  request',
	   expectPdfResponse);

	it('should respond with `application/json` on the second request',
	   expectJsonResponse);

	it('should respond with `application/pdf`  on the third  request',
	   expectPdfResponse);

	it('should respond with `application/json` on the fourth request',
	   expectJsonResponse);
});

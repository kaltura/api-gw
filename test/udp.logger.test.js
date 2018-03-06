const fs = require('fs');
const os = require('os');
const http = require('http');
const dgram = require("dgram");
const expect = require('chai').expect;
const shortid = require('shortid');
const childProcess = require('child_process');

const testText = shortid.generate();
const udpPort = 65535 - Math.floor(Math.random() * 10000);

const config = {
    logger: {
		logLevel: 'DEBUG',
		udpPort: udpPort
    },
	ports: {
		http: 1337
	},
    processors: [{
		require: `${__dirname}/modules/test-processor`,
		testText: testText
    }],
    proxies: [{
        'require': './lib/proxies/test'
    }]
};

// make it under tmp dir
const configPath = `${os.tmpdir()}/api-gw-test-${shortid.generate()}`;
fs.writeFile(configPath, JSON.stringify(config));

function startServer(callback) {
	let serverProcess = childProcess.fork('start', [configPath]);
	serverProcess.on('message', (message) => {
		if(message === 'listening') {
			callback(serverProcess);
		}
	});
}

function startUdpServer() {
	const server = dgram.createSocket('udp4');

	server.on('error', (err) => {
		server.close();
		throw err;
	});


	server.on('listening', () => {
		const address = server.address();
		console.log(`UDP server listening ${address.address}:${address.port}`);
	});

	server.bind(udpPort).unref();
	return server;
}

function sendRequest() {
	let version = 'v2_6';
	let service = shortid.generate();
	let action = shortid.generate();

	let request = http.request({
		port: config.ports.http,
		host: '127.0.0.1',
		method: 'GET',
		path: `/${version}/service/${service}/action/${action}`,
		timeout: 30000
	});
	request.on('error', (err) => {
		throw err;
	});
	request.end();
}

describe('udp', () => {
    describe('logger', () => {
		it('valid text', (done) => {
			startServer((serverProcess) => {
				let udpServer = startUdpServer();
				udpServer.on('message', (msg, rinfo) => {
					msg = msg.toString('utf8').replace(/[\n\r]+$/, '');
					console.log(`UDP [${rinfo.address}:${rinfo.port}]: ${msg}`);
					if(msg.match(new RegExp(` ${testText}$`))) {
						done();
						udpServer.close();
						serverProcess.send('stop');
					}
				});
				sendRequest();
			});
		});
    });
});


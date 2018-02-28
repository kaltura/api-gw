const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const dgram = require("dgram");
const expect = require('chai').expect;
const shortid = require('shortid');
const kaltura = require('kaltura-ott-client');
const querystring = require('querystring');
const childProcess = require('child_process');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const ports = {
	http: 1337,
	https: 1338
};

const config = {
	accessLogPath: './log/access.{yyyy-mm-dd}.log',
	logLevel: "DEBUG",
	ports: ports,
    sslOptions: {
        key: './config/key.pem',
        cert: './config/cert.pem'
    },
    processors: [{
        require: './lib/query-string-processor'
    }],
    proxies: [{
        'require': './lib/test-proxy'
    }]
};

// make it under tmp dir
const configPath = `${os.tmpdir()}/api-gw-test-${shortid.generate()}`;
fs.writeFile(configPath, JSON.stringify(config));

let serverProcess = null;

let ks = 'djJ8MjAzfMvEqu4HezrDJfIF_726hVYCvtU0OH_nWAQd4e3kwtfHj7t2-7UPLXPEYwCnE7HOLS8EgBiM8SRqzDPmwZdYrBrZzrdLtGpOqvJJbhHrfajYG2VCjS-t6nx6I59bQozT81479NcOZGc9vOsJHuCDMpI0r1PEzrYOgkq--xiInHW3HZOCLrSXS8c8mWvHngSZQg==';
let version = 'v2_6';
let service = shortid.generate();
let action = shortid.generate();
let pathRequest1 = {
	aaa: shortid.generate(),
	bbb: shortid.generate(),
	cc: {
		dd: shortid.generate(),
		ee: {
			ff: shortid.generate(),
			gg: shortid.generate()
		}
	}
};
let pathRequest2 = {
	hh: {
		ii: shortid.generate(),
		jj: {
			kk: shortid.generate(),
			ll: shortid.generate()
		}
	}
};
let queryString1 = {
	mm: shortid.generate(),
	nn: {
		oo: shortid.generate(),
		pp: {
			qq: shortid.generate(),
			rr: shortid.generate()
		}
	}
};
let queryString2 = {
	ss: shortid.generate(),
	tt: {
		uu: shortid.generate(),
		vv: {
			ww: shortid.generate(),
			xx: shortid.generate()
		}
	}
};
let post = {
	ks: ks,
	aa1: 123,
	aa2: shortid.generate(),
	aa3: true,
	aa4: false,
	aa5: 0.5,
	aa6: [{
		bb1: shortid.generate()
	}, {
		bb1: shortid.generate()
	}],
	aa7: {
		cc1: shortid.generate(),
		cc2: {
			dd1: shortid.generate()
		}
	}
};
let postData = JSON.stringify(post);


function object2path1(obj, prefix) {
	let parts = [];

	for(let key in obj) {
		let prefixedKey = prefix ? `${prefix}:${key}` : key;
		if(typeof(obj[key]) === 'object') {
			parts.push(object2path1(obj[key], prefixedKey));
		}
		else {
			parts.push(`${prefixedKey}/${obj[key]}`);
		}
	}

	return parts.join('/');
}

function object2path2(obj, prefix) {
	let parts = [];

	for(let key in obj) {
		let prefixedKey = prefix ? `${prefix}[${key}]` : key;
		if(typeof(obj[key]) === 'object') {
			parts.push(object2path2(obj[key], prefixedKey));
		}
		else {
			parts.push(`${prefixedKey}/${obj[key]}`);
		}
	}

	return parts.join('/');
}

function object2query1(obj, prefix) {
	let parts = [];

	for(let key in obj) {
		let prefixedKey = prefix ? `${prefix}:${key}` : key;
		if(typeof(obj[key]) === 'object') {
			parts.push(object2query1(obj[key], prefixedKey));
		}
		else {
			parts.push(`${prefixedKey}=${obj[key]}`);
		}
	}

	return parts.join('&');
}

function object2query2(obj, prefix) {
	let parts = [];

	for(let key in obj) {
		let prefixedKey = prefix ? `${prefix}[${key}]` : key;
		if(typeof(obj[key]) === 'object') {
			parts.push(object2query2(obj[key], prefixedKey));
		}
		else {
			parts.push(`${prefixedKey}=${obj[key]}`);
		}
	}

	return parts.join('&');
}

function expectObjectKeys(expected, actual) {
	for(let key in expected) {
		if(typeof(expected[key]) === 'object') {
			expectObjectKeys(expected[key], actual[key]);
		}
		else {
			expect(actual[key]).to.equal(expected[key]);
		}
	}
}

let listening = false;
function testRequest(protocol, port) {
	it(protocol, (done) => {
		let interval = setInterval(() => {
			if(!listening) {
				return;
			}
			clearInterval(interval);
			let httpModule = protocol == 'http' ? http : https;
			let request = httpModule.request({
				port: port,
				host: '127.0.0.1',
				method: 'POST',
				path: `/${version}/service/${service}/action/${action}/${object2path1(pathRequest1)}/${object2path2(pathRequest2)}?${object2query1(queryString1)}&${object2query2(queryString2)}`,
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(postData)
				},
				timeout: 30000
			}, (response) => {
				expect(response.statusCode).to.equal(200);
				expect(response.headers['content-type']).to.equal('application/json');
				let body = '';
				response.setEncoding('utf8');
				response.on('data', (chunk) => {
					body += chunk;
				});
				response.on('end', () => {
					let json = JSON.parse(body);
					expect(json.headers['content-type']).to.equal('application/json');
					expectObjectKeys(pathRequest1, json.request);
					expectObjectKeys(pathRequest2, json.request);
					expectObjectKeys(queryString1, json.request);
					expectObjectKeys(queryString2, json.request);
					
					delete ports[protocol]; // remove tested protocol
					done();
					
					if(!Object.keys(ports).length) {
						serverProcess.send('stop');
					}
				});
			});
			request.on('error', (err) => {
				throw err;
			});
			request.write(postData);
			request.end();
		}, 100);
	});

}

describe('full-cycle', () => {
    describe('query', () => {
		serverProcess = childProcess.fork('start', [configPath]);
		serverProcess.on('message', (message) => {
			listening = true;
		});
		
		for(let protocol in ports) {
			testRequest(protocol, ports[protocol]);
		}
    });
});


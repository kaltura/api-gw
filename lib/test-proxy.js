const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');
const httpProxy = require('http-proxy');
const Helper = require('./helper');

class TestProxy extends Helper {
    
    constructor(options) {
        super(options);

        options.target = 'http://127.0.0.1:9000';
        
        this.paths = options.paths;
        this.proxyServer = httpProxy.createProxyServer(options);

        http.createServer(function (req, res) {
            
            let body = '';
            req.on('data', function (data) {             
                body += data;
            });
    
            req.on('end', function () {                
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.write('Request successfully proxied!' + '\n');
                res.write('Path: ' + req.url + '\n');
                res.write(JSON.stringify(req.headers, true, 2) + '\n\n');
                res.write(JSON.stringify(JSON.parse(body), true, 2));
                res.end();
            });
            
        }).listen(9000);
    }

    /**
     * @param {http.IncomingMessage} request 
     * @param {http.ServerResponse} response
     * @returns {Promise}
     */
    proxy(request, response) {
        var This = this;

        return new Promise((resolve, reject) => {
            This.proxyServer.web(request, response);
            request.resume();
            resolve();
        });
    }
}

module.exports = TestProxy;
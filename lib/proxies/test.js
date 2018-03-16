const fs = require('fs');
const os = require('os');
const http = require('http');
const cluster = require("cluster");
const Promise = require('bluebird');
const httpProxy = require('http-proxy');
const Helper = require('../helper');

const port = 65535 - Math.floor(Math.random() * 10000);

class TestProxy extends Helper {
    
    constructor(options) {
        super(options);

        options.target = `http://127.0.0.1:${port}`;
        
        this.proxyServer = httpProxy.createProxyServer(options);
        this._listen();
    }

    _listen() {
        let hostname = os.hostname();
        http.createServer(function (req, res) {
            
            let body = '';
            req.on('data', function (data) {             
                body += data;
            });
    
            req.on('end', function () {                
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'X-Me': hostname
                });
                var json = {
                    path: req.url,
                    headers: req.headers
                };
                if(body.length) {
                    json.request = JSON.parse(body);
                }
                res.end(JSON.stringify(json, true, 2));
            });
            
        })
        .listen(port, () => {
            this.logger.debug(`Test HTTP server listening on port ${port}`);
        });
    }

    /**
     * @param {http.IncomingMessage} request 
     * @param {http.ServerResponse} response
     * @returns {Promise}
     */
    proxy(request, response) {
        var This = this;

        return new Promise((resolve, reject) => {
            if(this.filtersMatch(request)) {
                This.proxyServer.web(request, response);
                resolve();
            }
            else {
                reject();
            }
        });
    }
}

module.exports = TestProxy;
const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');
const httpProxy = require('http-proxy');
const Helper = require('../helper');

class ApiProxy extends Helper {
    
    constructor(options, server) {
        super(options, server);
        const host = options.target;
        
        this.proxyServer = httpProxy.createProxyServer(options);
        this.proxyServer.on('error', (err, request, response) => {
            this.logger.error(`Request [${request.id}] proxy server error`, err);
        });
        this.proxyServer.on('proxyRes', (proxyRes, request, response) => {
            response.proxyHeaders = proxyRes.headers;
            this.logger.debug(`Request [${request.id}] proxy [${host}/${request.url}] server response`, JSON.stringify(proxyRes.headers, true, 2));
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
                this._onStart(request, response);
                This.proxyServer.web(request, response);
                resolve();
                this._onEnd(request, response);
            }
            else {
                reject();
            }
        });
    }
}

module.exports = ApiProxy;
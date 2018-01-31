const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');
const httpProxy = require('http-proxy');
const Helper = require('./helper');

class ApiProxy extends Helper {
    
    constructor(options) {
        super(options);
        
        this.paths = options.paths;

        this.proxyServer = httpProxy.createProxyServer(options);
    }

    /**
     * @param {http.IncomingMessage} request 
     * @param {http.ServerResponse} response
     * @returns {Promise}
     */
    proxy(request, response) {
        var This = this;

        return new Promise((resolve, reject) => {
            for(let i in this.paths) {
                let regex = new RegExp(this.paths[i]);
                if(regex.test(request.url)) {
                    This.proxyServer.web(request, response);
                    request.resume();
                    resolve();
                    return;
                }
            }

            reject();
        });
    }
}

module.exports = ApiProxy;
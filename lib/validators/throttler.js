const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');
const Helper = require('../helper');

class Throttler extends Helper {
    
    constructor(options, server) {
        super(options, server);
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    validate(request, response) {
        return new Promise((resolve, reject) => {
            this._onStart(request, response);
            // TODO
            resolve();
            this._onEnd(request, response);
        });
    }
}

module.exports = Throttler;
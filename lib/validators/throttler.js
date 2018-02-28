const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');
const Helper = require('../helper');

class Throttler extends Helper {
    
    constructor(options) {
        super(options);
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    validate(request) {
        return new Promise((resolve, reject) => {
            // TODO
            resolve();
        });
    }
}

module.exports = Throttler;
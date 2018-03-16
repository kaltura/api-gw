const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const dateFormat = require('dateformat');

const Helper = require('../helper');

class JsonStringifyer extends Helper {
    
    constructor(options, server) {
        super(options, server);
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process(data) {
        let {request, response, json} = data;
        
        if(json && this.filtersMatch(request)) {
            this._onStart(request, response);
            let body = JSON.stringify(json);

            const buf = Buffer.from(body, 'utf8');
            request.unshift(buf);
            request.headers['content-length'] = body.length;
            this._onEnd(request, response);
        }
        return Promise.resolve(data);
    }

    filtersMatch(request) {
        if(request.method != 'POST') {
            return false;
        }

        if(!request.headers['content-type'].toLowerCase().startsWith('application/json')) {
            return false;
        }

        return super.filtersMatch(request);
    }
}

module.exports = JsonStringifyer;
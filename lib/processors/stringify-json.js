const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const dateFormat = require('dateformat');
const StringDecoder = require('string_decoder').StringDecoder;

const Helper = require('../helper');

class JsonStringifyer extends Helper {
    
    constructor(options) {
        super(options);
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process(data) {
        let {request, json} = data;
        
        if(json && this.filtersMatch(request)) {
            let body = JSON.stringify(json);

            const buf = Buffer.from(body, 'utf8');
            request.unshift(buf);
            request.headers['content-length'] = body.length;
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
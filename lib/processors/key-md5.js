const fs = require('fs');
const md5 = require('md5');
const path = require('path');
const Promise = require('bluebird');
const dateFormat = require('dateformat');

const Helper = require('../helper');

class KeyGenerator extends Helper {
    
    constructor(options, server) {
        super(options, server);

        if(options.fieldsToIgnore) {
            this.fieldsToIgnore = options.fieldsToIgnore;
        }
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process(data) {
        let {request, response, json} = data;
        
        if(this.filtersMatch(request)) {
            this._onStart(request, response);
            let body = '';

            if(json) {
                if(this.fieldsToIgnore) {
                    for(let i = 0; i < this.fieldsToIgnore.length; i++) {
                        if(json[this.fieldsToIgnore[i]]) {
                            delete json[this.fieldsToIgnore[i]];
                        }
                    }
                    body = JSON.stringify(json);
                }
            }

            request.key = md5(request.url + body);
            this._onEnd(request, response);
        }
        return Promise.resolve(data);
    }

    filtersMatch(request) {
        return super.filtersMatch(request);
    }
}

module.exports = KeyGenerator;
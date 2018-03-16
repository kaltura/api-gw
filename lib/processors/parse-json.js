const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const dateFormat = require('dateformat');

const Helper = require('../helper');

class JsonParser extends Helper {
    
    constructor(options, server) {
        super(options, server);
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process(data) {
        let {request, response} = data;
        let This = this;

        return new Promise((resolve, reject) => {
            if(This.filtersMatch(request)) {
                this._onStart(request, response);
                try{
                    data.json = JSON.parse(request.body);
                    resolve(data);
                    this._onEnd(request, response);
                } 
                catch(err) {
                    reject(`${err}, Body: ${request.body}`)
                    this._onError(request, response);
                }
            }
            
            resolve(data);
        });
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

module.exports = JsonParser;
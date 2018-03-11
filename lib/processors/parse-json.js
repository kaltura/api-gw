const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const dateFormat = require('dateformat');

const Helper = require('../helper');

class JsonParser extends Helper {
    
    constructor(options) {
        super(options);
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process(data) {
        let {request} = data;
        let This = this;

        return new Promise((resolve, reject) => {
            if(This.filtersMatch(request)) {
                try{
                    data.json = JSON.parse(request.body);
                    resolve(data);
                } 
                catch(err) {
                    reject(`${err}, Body: ${request.body}`)
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
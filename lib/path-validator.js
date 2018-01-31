const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');
const Helper = require('./helper');

class PathValidator extends Helper {
    
    constructor(options) {
        super(options);

        this.paths = options.paths;
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    validate(request) {
        for(let i in this.paths) {
            let regex = new RegExp(this.paths[i]);
            if(regex.test(request.url)) {
                return true;
            }
        }
        
        throw `Path [request.url] is invalid`;
    }
}

module.exports = PathValidator;
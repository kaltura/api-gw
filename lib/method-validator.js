const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');
const Helper = require('./helper');

class MethodValidator extends Helper {
    
    constructor(options) {
        super(options);
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    validate(request, response) {
        switch(request.method) {
            case 'GET':
            case 'POST':
                return true;
                
            case 'OPTIONS':
                response.writeHead(200, {
                    'Access-Control-Allow-Headers': 'origin, x-requested-with, content-type, accept',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'private',
                    'Content-Length': 0
                });
                response.end();
                return false;

            default:
                throw `HTTP method [${request.method}] is not supported`;
        }
    }
}

module.exports = MethodValidator;
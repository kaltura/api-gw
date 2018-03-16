const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');
const jsontoxml = require('jsontoxml');
const Helper = require('../helper');

class FilterPrerequisite extends Helper {
    
    constructor(options, server) {
        super(options);
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    wrap(err, request, response) {
        if(this.filtersMatch(request)) {
            var now = new Date();
            response.duration = (now.getTime() - request.startTime) / 1000;
            
            if(request.headers['accept'].toLowerCase().startsWith('application/xml')) {
                return this._xml(err, response);
            }
            else {
                return this._json(err, response);
            }
        }

        return false;
    }

    _json(err, response) {
        response.writeHead(500, {'Content-Type': 'application/json'});
        let json = {
            result: {
                error: {
                    objectType: 'KalturaAPIException',
                    code: '-2',
                    message: `Gateway Error`
                }
            },
            executionTime: response.duration
        }

        if(typeof(err) == 'object' && err.message) {
            json.result.error.message = err.message;
            if(err.code) {
                json.result.error.code = err.code;
            }
        }
        else if(typeof(err) == 'string') {
            json.result.error.message = err;
        }

        response.end(JSON.stringify(json, true, 2));

        return true;
    }

    _xml(err, response) {
        response.writeHead(500, {'Content-Type': 'application/xml'});
        let json = {
            xml: {
                result: {
                    error: {
                        objectType: 'KalturaAPIException',
                        code: '-2',
                        message: `Gateway Error`
                    }
                },
                executionTime: response.duration
            }
        }

        if(typeof(err) == 'object' && err.message) {
            json.xml.result.error.message = err.message;
            if(err.code) {
                json.xml.result.error.code = err.code;
            }
        }
        else if(typeof(err) == 'string') {
            json.xml.result.error.message = err;
        }

        response.end(jsontoxml(json));
        return true;
    }
}

module.exports = FilterPrerequisite;
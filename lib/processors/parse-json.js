const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const dateFormat = require('dateformat');
const StringDecoder = require('string_decoder').StringDecoder;

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

        if(this.filtersMatch(request)) {
            return this.readJson(request)
            .then((json) => {
                if(data.json) {
                    Object.assign(data.json, json);
                }
                else {
                    data.json = json;
                }
                return Promise.resolve(data);
            }, (err) => {
                reject(err);
            });
        }
        else {
            Promise.resolve(data);
        }
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

    readJson(request) {
        let read = false;
        let body = '';
        let onReadable = () => {
            request.pause();
            request.removeListener('readable', onReadable);

            const decoder = new StringDecoder('utf8');
            
            let chunk;
            while (null !== (chunk = request.read())) {
                const str = decoder.write(chunk);
                body += str;
            }
            request.post = body.replace(/[\r\n]/g, '');
            read = true;
        };
        request.on('readable', onReadable);
        request.on('end', () => {
        });
        
        return new Promise((resolve, reject) => {
            let handle = () => {
                if(read) {
                    try{
                        let json = JSON.parse(body);
                        resolve(json);
                    } 
                    catch(err) {
                        reject(`${err}, Body: ${body}`)
                    }
                }
                else {
                    setTimeout(handle, 100);
                }
            };

            handle();
        });
    }
}

module.exports = JsonParser;
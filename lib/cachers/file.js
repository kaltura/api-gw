const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const Helper = require('../helper');

class FileCacher extends Helper {
    
    constructor(options, server) {
        super(options, server);
        
        this.path = options.path;

        if(!fs.existsSync(this.path)) {
            fs.mkdirSync(this.path);
        }
    }

    _findCacheFile(request) {
        const filepath = `${this.path}/${request.key}.cache`;
        return new Promise((resolve, reject) => {
            fs.exists(filepath, exists => {
                if(exists) {
                    // TODO check file age, delete if old
                    fs.readFile(filepath, (err, data) => {
                        if(err) {
                            reject(err);
                        }
                        else {
                            resolve(JSON.parse(data));
                        }
                    });
                }
                else {
                    reject('Cache not found');
                }
            });
        });
    }

    _validateKeys({keys, path}) {
        return new Promise((resolve, reject) => {
            // TODO validate all invalidation keys, reject if invalid
            resolve(path);
        });
    }

    _respond(request, response, contentPath) {
        // TODO add headers, e.g. content-type
        response.fromCache = true;
        response.setHeader('Cache-Key', request.key)
        var readStream = fs.createReadStream(contentPath);
        readStream.pipe(response);
        return Promise.resolve();
    }

    /**
     * @param {http.IncomingMessage} request 
     * @param {http.ServerResponse} response
     * @returns {Promise}
     */
    start(request, response) {
        if(this.filtersMatch(request)) {
            this._onStart(request, response);
            return this._findCacheFile(request)
            .then((cache) => this._validateKeys(cache))
            .then((contentPath) => this._respond(request, response, contentPath))
            .then(() => {
                this._onEnd(request, response);
                return Promise.resolve();
            });
        }
        else {
            reject();
        }
    }

    /**
     * @param {http.IncomingMessage} request 
     * @param {string} content
     * @returns {Promise}
     */
    cache(request, response) {

        if(!this.filtersMatch(request)) {
            return;
        }
        this._onStart(request, response);
        
        let headers = response.headers;
        let content = response.body;

        // TODO check config for headers that force to not cache

        const filepath = `${this.path}/${request.key}.`;
        var cache = {
            keys: [], // TODO check config for headers of invalidations keys
            path: filepath + 'data'
        };
        fs.writeFile(filepath + 'data', content, err => {
            if(!err) {
                fs.writeFile(filepath + 'cache', JSON.stringify(cache), err => {
                    if(err) {
                        this.logger.error(`Error writing file ${filepath}cache`, err);
                    }
                });
            }
        });
        this._onEnd(request, response);
        return true;
    }
}

module.exports = FileCacher;
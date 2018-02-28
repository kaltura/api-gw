const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');
const Helper = require('./helper');

class FileCacher extends Helper {
    
    constructor(options) {
        super(options);
        
        this.path = options.path;

        if(!fs.existsSync(this.path)) {
            fs.mkdirSync(this.path);
        }
    }

    findCacheFile(request) {
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

    validateKeys({keys, path}) {
        return new Promise((resolve, reject) => {
            // TODO validate all invalidation keys, reject if invalid
            resolve(path);
        });
    }

    respond(request, response, contentPath) {
        response.disableCache = true;
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
            return this.findCacheFile(request)
            .then((cache) => this.validateKeys(cache))
            .then((contentPath) => this.respond(request, response, contentPath));
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
    cache(request, headers, content) {
        if(!this.filtersMatch(request)) {
            return;
        }
        
        // TODO check config for headers that force to not cache

        const filepath = `${this.path}/${request.key}.`;
        var cache = {
            keys: [], // TODO check config for headers of invalidations keys
            path: filepath + 'data'
        };
        fs.writeFile(filepath + 'data', content, err => {
            if(!err) {
                fs.writeFile(filepath + 'cache', JSON.stringify(cache));
            }
        });
        return true;
    }
}

module.exports = FileCacher;
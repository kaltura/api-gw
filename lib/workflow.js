const fs = require('fs');
const md5 = require('md5');
const path = require('path');
const zlib = require('zlib');
const Promise = require('bluebird');
const dateFormat = require('dateformat');
const StringDecoder = require('string_decoder').StringDecoder;

const Helper = require('./helper');

const MODULE_TYPES = [
    'prerequisites',
    'processors',
    'validators',
    'cachers',
    'proxies',
    'enrichers',
    'errorResponseWrappers'
];

class Workflow extends Helper {
    
    constructor(options, server) {
        super(options, server);

        this.name = options.name;
        let This = this;
        MODULE_TYPES.map((moduleType) => This[moduleType] = []);
        if(options.extends && server.workflows[options.extends]) {
            MODULE_TYPES.map((moduleType) => {
                if(server.workflows[options.extends][moduleType] && server.workflows[options.extends][moduleType].length)
                for(var i = 0; i < server.workflows[options.extends][moduleType].length; i++) {
                    This[moduleType].push(server.workflows[options.extends][moduleType][i]);
                }
            });
        }

        MODULE_TYPES.map((moduleType) => {
            if(options[moduleType] && options[moduleType].length)
            for(var i = 0; i < options[moduleType].length; i++) {
                let config = options[moduleType][i];
                if(typeof(config) === 'string') {
                    if(!server.modules[config]) {
                        throw `Module ${config} is not defined for workflow ${this.name}`;
                    }
                    This[moduleType].push(server.modules[config]);
                }
                else {
                    let moduleClass = require(path.resolve(process.cwd(), config.require));
                    This[moduleType].push(new moduleClass(config, server));
                }
            }
        });
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    handle(request, response) {
        return new Promise((resolve, reject) => {
            if(this.filtersMatch(request)) {
                this._onStart(request, response);
                resolve();
                this._process(request, response)
                .then(() => this._validate(request, response))
                .then(() => this._startCache(request, response))
                .then(() => this._proxy(request, response))
                .catch((err) => {
                    if(err) {
                        this.logger.error(`Request [${request.id}] error`, err);
                        this._errorResponse(err, request, response);
                    }
                    this._onEnd(request, response);
                });
            }
            else {
                reject();
            }
        });
    }

    /**
     * Syncronic validator
     */
    _prerequisite(request, response) {
        for(let i in this.prerequisites) {
            if(!this.prerequisites[i].isFulfilled(request, response)) {
                return false;
            }
        }
        return true;
    }

    _process(request, response) {
        let This = this;

        if(!This._prerequisite(request, response)) {
            return Promise.reject();
        }

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
            request.body = body.replace(/[\r\n]/g, '');
            read = true;
        };
        request.on('readable', onReadable);
        
        let promise = new Promise((resolve, reject) => {
            let handle = () => {
                if(read) {
                    resolve({
                        request: request,
                        response: response
                    });
                }
                else {
                    setTimeout(handle, 50);
                }
            };

            handle();
        });

        let processPromise = (index) => {
            return (data) => {
                return This.processors[index].process(data);
            };
        };

        let processIndex = 0;
        while(processIndex < this.processors.length) {
            promise = promise.then(processPromise(processIndex++));
        }

        return promise;
    }

    _validate(request, response) {
        return Promise.each(this.validators, (validator, index, length) => {
            return validator.validate(request, response);
        });
    }

    _startCache(request, response) {
        var This = this;

        var _write = response.write;
        var _end = response.end;

        response.body = '';
        response.write = (chunk, encoding, callback) => {
            if((response.headers && response.headers['content-encoding'] == 'gzip') || (response.proxyHeaders && response.proxyHeaders['content-encoding'] == 'gzip')) {
                chunk = zlib.unzipSync(chunk);
            }
            let data = chunk.toString('utf8');

            this.logger.debug(`Request [${request.id}] write [${encoding}]`, data);
            response.body += data;
            if(callback) {
                callback(chunk.length);
            }
            return chunk.length;
            //return _write.apply(response, [chunk, encoding, callback]);
        };
        response.end = (data, encoding, callback) => {
            if(!response.body) {
                response.body = '';
            }
            if(data) {
                response.body += data;
            }

            if(!response.fromCache) {
                if(response.body) {
                    This.enrichers.forEach(enricher => enricher.enrich(request, response));
                }

                if(response.body) {
                    This.cachers.forEach(cacher => cacher.cache(request, response));
                }
            }
            
            if((response.headers && response.headers['content-encoding'] == 'gzip') || (response.proxyHeaders && response.proxyHeaders['content-encoding'] == 'gzip')) {
                zlib.gzip(response.body, (err, gzip) => {
                    if(err) {
                        response.statusCode = 500;  
                        _write.apply(response, ["Gzip failed", encoding]);
                        _end.apply(response, [callback]);
                    }
                    _write.apply(response, [gzip, encoding]);
                    _end.apply(response, [callback]);
                });
            }
            else {
                _write.apply(response, [response.body, encoding]);
                _end.apply(response, [callback]);
            }
        };

        return new Promise((resolve, reject) => {
            var promises =  This.cachers.map(cacher => cacher.start(request, response));
            Promise.any(promises)
            .then(cache => reject(), err => resolve());
        });
    }

    _proxy(request, response) {
        if(!this.proxies.length) {
            return Promise.reject('No proxy defined');
        }

        var promises = this.proxies.map(proxy => proxy.proxy(request, response));
        return Promise.any(promises)
        .then(() => Promise.resolve(), () => Promise.reject('No proxy found'));
        
        request.resume();
    }

    _errorResponse(err, request, response) {  
        for(let i in this.errorResponseWrappers) {
            if(this.errorResponseWrappers[i].wrap(err, request, response)) {
                return;
            }
        }
    }
}

module.exports = Workflow;
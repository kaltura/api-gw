const fs = require('fs');
const md5 = require('md5');
const http = require('http');
const Promise = require('bluebird');
const kaltura = require('kaltura-ott-client');
const StringDecoder = require('string_decoder').StringDecoder;

class Server {
    constructor() {
        const json = fs.readFileSync('./config/config.json');
        this.config = JSON.parse(json);

        let clientConfig = new kaltura.Configuration();
        clientConfig.serviceUrl = this.config.serviceUrl;
        this.client = new kaltura.Client(clientConfig);

        this.preProcessValidators = this.initHelpers(this.config.preProcessValidators);
        this.processors = this.initHelpers(this.config.processors);
        this.validators = this.initHelpers(this.config.validators);
        this.cachers = this.initHelpers(this.config.cachers);
        this.proxies = this.initHelpers(this.config.proxies);
    }

    initHelpers(configs) {
        var helpers = [];
        if(configs) {
            for(var i = 0; i < configs.length; i++) {
                var helperClass = require(configs[i].require);
                configs[i].client = this.client;
                helpers.push(new helperClass(configs[i]));
            }
        }

        return helpers;
    }

    /**
     * Syncronic validator
     */
    validatePreProcess(request, response) {
        for(let i in this.preProcessValidators) {
            if(!this.preProcessValidators[i].validate(request, response)) {
                return false;
            }
        }
        return true;
    }

    process(request, response) {
        let This = this;

        let ret = new Promise((resolve, reject) => {
            if(This.validatePreProcess(request, response)) {
                let onReadable = () => {
                    request.removeListener('readable', onReadable);
                    request.pause();

                    let json;
                    if(request.headers['content-type'].toLowerCase().startsWith('application/json')) {
                        const decoder = new StringDecoder('utf8');
                        let body = '';
                        let chunk;
                        while (null !== (chunk = request.read())) {
                            const str = decoder.write(chunk);
                            body += str;
                        }
                        json = JSON.parse(body);
                    }
                    resolve({
                        request: request,
                        response: response,
                        json: json
                    });
                };
                request.on('readable', onReadable);
            }
            else {
                reject();
            }
        });

        let processPromise = (index) => {
            return (data) => {
                return this.processors[index].process(data);
            };
        };

        let processIndex = 0;
        while(processIndex < this.processors.length) {
            ret = ret.then(processPromise(processIndex++));
        }
        ret = ret.then(({json}) => {
            if(json) {
                let body = JSON.stringify(json);
                const buf = Buffer.from(body, 'utf8');
                request.unshift(buf);
                request.headers['content-length'] = body.length;

                if(This.config.fieldsToIgnore) {
                    for(let i = 0; i < This.config.fieldsToIgnore.length; i++) {
                        if(json[This.config.fieldsToIgnore[i]]) {
                            delete json[This.config.fieldsToIgnore[i]];
                        }
                    }
                    body = JSON.stringify(json);
                }
                request.key = md5(request.url + body);
            }
            return Promise.resolve();
        });

        return ret;
    }

    validate(request, response) {
        return Promise.each(this.validators, (validator, index, length) => {
            return validator.validate(request, response);
        });
    }

    start(request, response) {
        var This = this;

        var _write = response.write;
        var _end = response.end;

        response.cache = '';
        response.write = (chunk, encoding, callback) => {
            response.cache += chunk;
            return _write.apply(response, [chunk, encoding, callback]);
        };
        response.end = (data, encoding, callback) => {
            if(data) {
                response.cache += data;
            }

            if(response.cache && !response.disableCache) {
                This.cachers.forEach(cacher => cacher.cache(request, response.headers, response.cache));
            }
            
            return _end.apply(response, [data, encoding, callback]);
        };

        return new Promise((resolve, reject) => {
            var promises =  This.cachers.map(cacher => cacher.start(request, response));
            Promise.any(promises)
            .then(cache => reject(), err => resolve());
        });
    }

    proxy(request, response) {
        if(!this.proxies.length) {
            return Promise.reject('No proxy defined');
        }

        var promises = this.proxies.map(proxy => proxy.proxy(request, response));
        return Promise.any(promises)
        .then(() => Promise.resolve(), () => Promise.reject('No proxy found'));
    }

    listen() {
        var This = this;

        http.createServer((request, response) => {
            
            This.process(request, response)
            .then(() => This.validate(request, response))
            .then(() => This.start(request, response))
            .then(() => This.proxy(request, response))
            .catch((err) => {
                if(err) {
                    response.writeHead(500, {'Content-Type': 'text/plain'});
                    console.error(err);
                    if(typeof(err) == 'object' && err.message) {
                        
                        response.end(err.message);
                    }
                    else {
                        response.end(err);
                    }
                }
            });

        }).listen(1337, '127.0.0.1');
        console.log('Server running at http://127.0.0.1:1337/');
    }
}


const server = new Server();
server.listen();
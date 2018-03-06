const fs = require('fs');
const os = require('os');
const md5 = require('md5');
const path = require('path');
const http = require('http');
const https = require('https');
const dgram = require("dgram");
const cluster = require("cluster");
const Promise = require('bluebird');
const kaltura = require('kaltura-ott-client');
const EventEmitter = require('events').EventEmitter;
const StringDecoder = require('string_decoder').StringDecoder;


const Filter = require('./lib/filter');

class Server extends EventEmitter {

    constructor(configPath) {
        super();

        if(!configPath) {
            configPath = './config/config.json';
        }
        this.configPath = configPath;
        if(cluster.isMaster) {
            fs.watchFile(configPath, {persistent: false, interval: 1000}, (currStats, prevStats) => {
                this._reload();
            })
        }

        this._init();
    }

    _init() {
        const json = fs.readFileSync(this.configPath);
        this.config = JSON.parse(json);

        this._initLogger();

        if(cluster.isWorker) {
            this._initClient();
            this._initFilter();

            this.prerequisites = this._initHelpers(this.config.prerequisites);
            this.processors = this._initHelpers(this.config.processors);
            this.validators = this._initHelpers(this.config.validators);
            this.cachers = this._initHelpers(this.config.cachers);
            this.proxies = this._initHelpers(this.config.proxies);
            this.enrichers = this._initHelpers(this.config.enrichers);
        }
    }

    _initClient() {
        let clientConfig = new kaltura.Configuration();
        clientConfig.serviceUrl = this.config.serviceUrl;
        this.client = new kaltura.Client(clientConfig);
    }

    _initLogger() {

        let loggerOptions = {};
        if(this.config.logger) {
            loggerOptions = this.config.logger;
        }
        
        let loggerRequire = './lib/logger.js';
        if(loggerOptions.require) {
            loggerRequire = loggerOptions.require;
        }
        let loggerClass = require(loggerRequire);
        this.logger = new loggerClass(loggerOptions);
    }

    _initFilter() {
        this.filters = {};
        if(this.config.filters) {
            for(var filterName in this.config.filters) {
                var config = this.config.filters[filterName];
                var filterClass = Filter;
                if(config.require) {
                    filterClass = require(config.require);
                }
                this.filters[filterName] = new filterClass(filterName, config);
            }
        }
    }

    _initHelpers(configs) {
        var helpers = [];
        if(configs) {
            for(var i = 0; i < configs.length; i++) {
                let config = configs[i];
                let helperClass = require(config.require);
                config.client = this.client;
                let loggerOptions = {
                    name: helperClass.name
                };
                if(config.logLevel) {
                    loggerOptions.logLevel = config.logLevel;
                }
                config.logger = this.logger.getLogger(loggerOptions);
                
                if(config.filters) {
                    var filters = config.filters.map(filterName => this.filters[filterName]);
                    config.filters = filters;
                }
                helpers.push(new helperClass(config, this));
            }
        }

        return helpers;
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

        let ret = new Promise((resolve, reject) => {
            if(This._prerequisite(request, response)) {
                let onReadable = () => {
                    request.removeListener('readable', onReadable);
                    request.pause();

                    let json;
                    if(request.method == 'POST' && request.headers['content-type'].toLowerCase().startsWith('application/json')) {
                        const decoder = new StringDecoder('utf8');
                        let body = '';
                        let chunk;
                        while (null !== (chunk = request.read())) {
                            const str = decoder.write(chunk);
                            body += str;
                        }
                        request.post = body.replace(/[\r\n]/g, '');
                        try{
                            json = JSON.parse(body);
                        } 
                        catch(err) {
                            throw err + `, Body: ${body}`
                        }
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

                if(request.method == 'POST') {
                    const buf = Buffer.from(body, 'utf8');
                    request.unshift(buf);
                    request.headers['content-length'] = body.length;
                }

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

    _validate(request, response) {
        return Promise.each(this.validators, (validator, index, length) => {
            return validator.validate(request, response);
        });
    }

    _startCache(request, response) {
        var This = this;

        var _write = response.write;
        var _end = response.end;

        response.cache = '';
        response.write = (chunk, encoding, callback) => {
            //this.logger.debug(`Request [${request.key}] write`, chunk.toString('utf8'));
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

    _proxy(request, response) {
        if(!this.proxies.length) {
            return Promise.reject('No proxy defined');
        }

        var promises = this.proxies.map(proxy => proxy.proxy(request, response));
        return Promise.any(promises)
        .then(() => Promise.resolve(), () => Promise.reject('No proxy found'));
    }

    _listen() {
        var This = this;

        let serversWaitingForListenEvent = 0;

        if(this.config.ports.http) {
            serversWaitingForListenEvent++;
            this.httpServer = http.createServer((request, response) => {
                This._onRequest(request, response);
            }).listen(this.config.ports.http, '127.0.0.1', () => {
                serversWaitingForListenEvent--;
                if(!serversWaitingForListenEvent) {
                    process.send('listening');
                }
            });
        }
        
        if(this.config.ports.https && this.config.sslOptions) {
            serversWaitingForListenEvent++;
            let options = {};
            for(let key in this.config.sslOptions) {
                options[key] = fs.readFileSync(this.config.sslOptions[key]);
            }

            this.httpsServer = https.createServer(options, (request, response) => {
                This._onRequest(request, response);
            }).listen(this.config.ports.https, '127.0.0.1', () => {
                serversWaitingForListenEvent--;
                if(!serversWaitingForListenEvent) {
                    process.send('listening');
                }
            });
        }
    }

    _reload() {
        this.logger.info(`Reloading server`);
        this.reloading = true;
        this.processesToKill = Object.keys(this.childProcesses);
        this._reloadNextChildProcess();
    }

    _reloadNextChildProcess() {
        if(!this.processesToKill.length) {
            this.logger.info(`Server reloaded`);
            return;
        }

        let nextChildProcess = this.processesToKill.pop();
        this.childProcesses[nextChildProcess].disconnect();
    }

    _spawn(callback) {
        const childProcess = cluster.fork();
        this.logger.info(`Worker ${childProcess.process.pid} started`);

        const This = this;
        childProcess.on('exit', (code) => {
            This._onProcessExit(childProcess, code);
        });

        if(callback) {
            childProcess.on('message', (message) => {
                if(message == 'listening') {
                    callback();
                }
            });
        }

        this.childProcesses[childProcess.process.pid] = childProcess;
        return childProcess;
    }

    _onRequest(request, response) {
        this._process(request, response)
        .then(() => this._validate(request, response))
        .then(() => this._startCache(request, response))
        .then(() => this._proxy(request, response))
        .catch((err) => {
            if(err) {
                response.writeHead(500, {'Content-Type': 'text/plain'});
                this.logger.error(err);
                if(typeof(err) == 'object' && err.message) {
                    
                    response.end(err.message);
                }
                else {
                    response.end(err);
                }
            }
        });
    }

    _onProcessExit (childProcess, code) {
        this.logger.info(`Worker ${childProcess.process.pid} died, exit code ${code}`);
        delete this.childProcesses[childProcess.process.pid];
        if(this.closing) {
            if(Object.keys(this.childProcesses).length == 0) {
                this.logger.info(`All workers closed`);
                process.exit(0);
            }
        }
        else if(this.reloading){
            this._spawn(() => {
                this._reloadNextChildProcess();
            });
        }
        else {
            this._spawn();
        }
    }


    start() {
        let This = this;

        if (cluster.isMaster) {
            let startedPorts = {};
            cluster.on('listening', (worker, address) => {
                if(address && !startedPorts[address.port]) {
                    startedPorts[address.port] = true;
                    this.logger.debug(`Server running at ${address.address}:${address.port}`);
                    This.emit('listening', address);
                    if(process.connected && Object.keys(startedPorts).length == 2) { // both http and https 
                        process.send('listening');
                    }
                }
            });
            This.childProcesses = {};
            const numCPUs = os.cpus().length;
            for (let i = 1; i <= numCPUs; i++) {
                This._spawn();
            }

            process.on('message', (message) => {
                if(message == 'stop') {
                    This.stop();
                }
            });
        }
        else {
            This._listen();
        }
    }

    stop() {
        this.logger.debug('Stopping server');
        this.closing = true;
        for(let pid in this.childProcesses) {
            this.childProcesses[pid].disconnect();
        }
    }
}

module.exports = Server;

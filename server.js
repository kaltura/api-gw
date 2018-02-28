const fs = require('fs');
const os = require('os');
const md5 = require('md5');
const path = require('path');
const http = require('http');
const https = require('https');
const dgram = require("dgram");
const chalk = require('chalk');
const logger = require("loglevel");
const prefix = require('loglevel-plugin-prefix');
const cluster = require("cluster");
const Promise = require('bluebird');
const kaltura = require('kaltura-ott-client');
const dateFormat = require('dateformat');
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

            this.preProcessValidators = this._initHelpers(this.config.preProcessValidators);
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
        const colors = {
            TRACE: chalk.magenta,
            DEBUG: chalk.cyan,
            INFO: chalk.blue,
            WARN: chalk.yellow,
            ERROR: chalk.red,
        };
        prefix.reg(logger);          
        prefix.apply(logger, {
            format(level, name, timestamp) {
                return `${chalk.gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](level)} ${chalk.green(`${name}:`)}`;
            },
        });


        this.logger = logger.getLogger('Server');
        if(this.config.logLevel) {
            this.logger.setLevel(this.config.logLevel);
        }
        if(this.config.logUdpPort) {
            const udpPort = this.config.logUdpPort;
            const socket = dgram.createSocket('udp4');
            let _consoleLog = console.log;
            let _consoleErr = console.error;
            console.log = (msg) => {
                _consoleLog.apply(console, [msg]);
                socket.send(Buffer.from(msg), udpPort, 'localhost');
            };
            console.error = (msg) => {
                _consoleErr.apply(console, [msg]);
                socket.send(Buffer.from(msg), udpPort, 'localhost');
            };
        }
        
        if (cluster.isMaster) {
            let accessLogDir = path.dirname(this.config.accessLogPath.replace(/"/, ''));
            if(!fs.existsSync(accessLogDir)) {
                fs.mkdirSync(accessLogDir);
            }
        }

        let matches;
        let accessLogPath = this.config.accessLogPath;
        if(null !== (matches = /\{([^\}]+)\}/.exec(accessLogPath))) {
            accessLogPath = accessLogPath.replace(matches[0], dateFormat(new Date(), matches[1]));
        }
        this.accessLogFile = fs.openSync(accessLogPath, 'a');
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
                var config = configs[i];
                var helperClass = require(config.require);
                config.client = this.client;
                config.logger = logger.getLogger(helperClass.name);
                if(config.logLevel) {
                    config.logger.setLevel(config.logLevel);
                }
                if(config.filters) {
                    var filters = config.filters.map(filterName => this.filters[filterName]);
                    config.filters = filters;
                }
                helpers.push(new helperClass(config, this));
            }
        }

        return helpers;
    }

    _accessLog(str) {
        fs.write(this.accessLogFile, str + "\n");
    }

    /**
     * Syncronic validator
     */
    _validatePreProcess(request, response) {
        for(let i in this.preProcessValidators) {
            if(!this.preProcessValidators[i].validate(request, response)) {
                return false;
            }
        }
        return true;
    }

    _process(request, response) {
        let This = this;

        request.originalUrl = request.url;
        let startDate = new Date();
        response.on('finish', () => {
            this.logger.debug(`Request [${request.key}]`);
            let endDate = new Date();
            let remote_addr = request.socket.address().address;
            let remote_user; // TODO
            let time_local = dateFormat(endDate, "dd/mmm/yyyy:HH:MM:ss ") + dateFormat(endDate, "Z").substr(3);
            let requestStr = `${request.method} ${request.originalUrl} HTTP/${request.httpVersion}`; // TODO
            let status = response.statusCode;
            let bytes_sent = (response.getHeader('content-length') ? response.getHeader('content-length') : '');
            let request_time = (endDate.getMilliseconds() - startDate.getMilliseconds()) / 1000;
            let http_referer = (request.headers.referer ? request.headers.referer : '');
            let http_user_agent = request.headers['user-agent'];
            let http_host = request.headers.host;
            let pid = process.pid;
            let upstream_cache_status; // TODO
            let request_length = request.headers['content-length'];
            let sent_http_content_range = (response.getHeader('content-range') ? response.getHeader('content-range') : '');
            let http_x_forwarded_for = (request.headers['x-forwarded-for'] ? request.headers['x-forwarded-for'] : '');
            let http_x_forwarded_server = (request.headers['x-forwarded-server'] ? request.headers['x-forwarded-server'] : '');
            let http_x_forwarded_host = (request.headers['x-forwarded-host'] ? request.headers['x-forwarded-host'] : '');
            let sent_http_cache_control = (response.getHeader('cache-control') ? response.getHeader('cache-control') : '');
            let connection; // TODO
            let partner_id = request.session ? request.session.partnerId : '';
            let ks = request.session ? request.session.ks : '';
            let raw_post = request.post;
            let stub_response; // TODO
            let sent_http_x_me = (response.getHeader('x-me') ? response.getHeader('x-me') : '');

            let log = `${remote_addr} - ${remote_user} [${time_local}] "${requestStr}" `;
            log += `${status} ${bytes_sent} ${request_time} "${http_referer}" `;
            log += `"${http_user_agent}"  `;
            log += `"${http_host}" ${pid} - `;
            log += `${upstream_cache_status} `;
            log += `${request_length} "${sent_http_content_range}" "${http_x_forwarded_for}" `;
            log += `"${http_x_forwarded_server}" "${http_x_forwarded_host}" "${sent_http_cache_control}" - `;
            log += `${connection} "${partner_id}" "${ks}" "${raw_post}" "${stub_response}" "${sent_http_x_me}"`;
            
            This._accessLog(log);
        });

        let ret = new Promise((resolve, reject) => {
            if(This._validatePreProcess(request, response)) {
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

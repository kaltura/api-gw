const fs = require('fs');
const os = require('os');
const md5 = require('md5');
const path = require('path');
const http = require('http');
const https = require('https');
const chalk = require('chalk');
const logger = require("loglevel");
const prefix = require('loglevel-plugin-prefix');
const cluster = require("cluster");
const Promise = require('bluebird');
const kaltura = require('kaltura-ott-client');
const dateFormat = require('dateformat');
const StringDecoder = require('string_decoder').StringDecoder;

class Server {
    constructor() {
        const json = fs.readFileSync('./config/config.json');
        this.config = JSON.parse(json);

        this._init();
    }

    _init() {
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
        
        if (cluster.isMaster) {
            let accessLogDir = path.dirname(this.config.accessLogPath.replace(/"/, ''));
            if(!fs.existsSync(accessLogDir)) {
                fs.mkdirSync(accessLogDir);
            }
        }

        let clientConfig = new kaltura.Configuration();
        clientConfig.serviceUrl = this.config.serviceUrl;
        this.client = new kaltura.Client(clientConfig);

        let matches;
        let accessLogPath = this.config.accessLogPath;
        if(null !== (matches = /\{([^\}]+)\}/.exec(accessLogPath))) {
            accessLogPath = accessLogPath.replace(matches[0], dateFormat(new Date(), matches[1]));
        }
        this.accessLogFile = fs.openSync(accessLogPath, 'a');

        this.preProcessValidators = this._initHelpers(this.config.preProcessValidators);
        this.processors = this._initHelpers(this.config.processors);
        this.validators = this._initHelpers(this.config.validators);
        this.cachers = this._initHelpers(this.config.cachers);
        this.proxies = this._initHelpers(this.config.proxies);
    }

    _initHelpers(configs) {
        var helpers = [];
        if(configs) {
            for(var i = 0; i < configs.length; i++) {
                var helperClass = require(configs[i].require);
                configs[i].client = this.client;
                configs[i].logger = logger.getLogger(helperClass.name);
                if(configs[i].logLevel) {
                    configs[i].logger.setLevel(configs[i].logLevel);
                }
                helpers.push(new helperClass(configs[i]));
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

        http.createServer((request, response) => {
            This._onRequest(request, response);
        }).listen(this.config.httpPort, '127.0.0.1');
        this.logger.log('Server running at http://127.0.0.1:' + this.config.httpPort);

        let options = {};
        for(let key in this.config.sslOptions) {
            options[key] = fs.readFileSync(this.config.sslOptions[key]);
        }

        https.createServer(options, (request, response) => {
            This._onRequest(request, response);
        }).listen(this.config.httpsPort, '127.0.0.1');
        this.logger.log('Server running at https://127.0.0.1:' + this.config.httpsPort);
    }

    _spawn() {
        const childProcess = cluster.fork();
        this.logger.log(`Worker ${childProcess.process.pid} started`);

        const This = this;
        childProcess.on('exit', (code) => {
            This._onProcessExit(childProcess, code);
        });

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
        this.logger.log(`Worker ${childProcess.process.pid} died, exit code ${code}`);
        delete this.childProcesses[childProcess.process.pid];
        this._spawn();
    }


    start() {
        if (cluster.isMaster) {
            this.childProcesses = {};
            const numCPUs = os.cpus().length;
            for (let i = 1; i <= numCPUs; i++) {
                this._spawn();
            }
        }
        else {
            this._listen();
        }
    }
}

const server = new Server();
server.start();
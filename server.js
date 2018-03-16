const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const cluster = require("cluster");
const Promise = require('bluebird');
const EventEmitter = require('events').EventEmitter;


const Filter = require('./lib/filter');
const Workflow = require('./lib/workflow');
const loggerProvider = require('./lib/logger');

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
            this._initFilter();
            this._initModules();
            this._initWorkflows();
        }
    }

    _initLogger() {

        let loggerOptions = {};
        if(this.config.logger) {
            loggerOptions = this.config.logger;
        }
        
        if(loggerOptions.require) {
            loggerProvider = require(loggerOptions.require);
        }
        this.logger = loggerProvider.getLogger(loggerOptions);
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

    _initModules() {
        this.modules = {};
        if(this.config.modules) {
            for(var moduleName in this.config.modules) {
                let config = this.config.modules[moduleName];
                let moduleClass = require(config.require);
                this.modules[moduleName] = new moduleClass(config, this);
            }
        }
    }

    _initWorkflows() {
        this.workflows = {};
        if(this.config.workflows) {
            for(var workflowName in this.config.workflows) {
                let config = this.config.workflows[workflowName];
                config.name = workflowName;
                this.workflows[workflowName] = new Workflow(config, this);
            }
        }
    }

    _listen() {
        var This = this;

        let serversWaitingForListenEvent = 0;

        if(this.config.ports.http) {
            serversWaitingForListenEvent++;
            this.httpServer = http.createServer((request, response) => {
                This._onRequest(request, response);
            })
            .listen(this.config.ports.http, () => {
                serversWaitingForListenEvent--;
                if(!serversWaitingForListenEvent) {
                    process.send('listening');
                }
            })
            .on('error', err => {
                this.logger.error('HTTP server error', err);
            });
        }
        
        if(this.config.ports.https && this.config.sslOptions) {
            serversWaitingForListenEvent++;
            let options = {};
            for(let key in this.config.sslOptions) {
                options[key] = fs.readFileSync(path.resolve(process.cwd(), this.config.sslOptions[key]));
            }

            this.httpsServer = https.createServer(options, (request, response) => {
                This._onRequest(request, response);
            })
            .listen(this.config.ports.https, () => {
                serversWaitingForListenEvent--;
                if(!serversWaitingForListenEvent) {
                    process.send('listening');
                }
            })
            .on('error', err => {
                this.logger.error('HTTPS server error', err);
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
        var now = new Date();
        request.startTime = now.getTime();
        
        let workflowNames = Object.keys(this.workflows);
        if(!workflowNames.length) {
            response.writeHead(404, {"Content-Type": "text/plain"});
            response.write("No workflow defined");
            response.end();
        }
        else {
            var promises = workflowNames.map(workflowName => this.workflows[workflowName].handle(request, response));
            Promise.any(promises)
            .then(() => {
                this.logger.info(`Request [${request.key}] handled`);
            }, (err) => {
                this.logger.info(`Request [${request.key}] error`, err);
            })
            .catch((err) => {
                this.logger.info(`Request [${request.key}] error`, err);
                response.writeHead(404, {"Content-Type": "text/plain"});
                response.write("No workflow matched request");
                response.end();
            });
        }
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
                    if(process.connected && Object.keys(startedPorts).length == Object.keys(This.config.ports).length) {
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

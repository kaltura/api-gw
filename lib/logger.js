
const chalk = require('chalk');
const logger = require('loglevel');
const prefix = require('loglevel-plugin-prefix');

const logMethods = [
    'trace',
    'debug',
    'info',
    'warn',
    'error'
];
const colors = {
    TRACE: chalk.magenta,
    DEBUG: chalk.cyan,
    INFO: chalk.blue,
    WARN: chalk.yellow,
    ERROR: chalk.red,
};
logger.setDefaultLevel('info');
prefix.reg(logger);          
prefix.apply(logger, {
    format(level, name, timestamp) {
        return `${chalk.gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](level)} ${chalk.green(`${name}:`)}`;
    },
});


class Logger {
    
    constructor(options) {
        if(!options.name) {
            options.name = 'Server';
        }

        this.logger = logger.getLogger(options.name);

        if(options.logLevel) {
            this.logger.setLevel(options.logLevel);
        }
        
        if(options.udpPort) {
            const socket = dgram.createSocket('udp4');
            let udpHost = 'localhost';
            if(options.udpHost) {
                udpHost = options.udpHost;
            }
            let _consoleLog = console.log;
            let _consoleErr = console.error;
            console.log = (msg) => {
                _consoleLog.apply(console, [msg]);
                socket.send(Buffer.from(msg), options.udpPort, udpHost);
            };
            console.error = (msg) => {
                _consoleErr.apply(console, [msg]);
                socket.send(Buffer.from(msg), options.udpPort, udpHost);
            };
        }

        for(let i = 0; i < logMethods.length; i++) {
            this.bindMethod(logMethods[i]);
        }
    }

    bindMethod(methodName) {
        let This = this;
        this[methodName] = function() {
            This.logger[methodName].apply(This.logger, arguments);
        };
    }

    getLogger(options) {
        return new Logger(options);
    }
}

module.exports = Logger;
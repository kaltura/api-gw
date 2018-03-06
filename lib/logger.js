
const chalk = require('chalk');
const dgram = require('dgram');
const logger = require('loglevel');
const prefix = require('loglevel-plugin-prefix');

const colors = {
    TRACE: chalk.magenta,
    DEBUG: chalk.cyan,
    INFO: chalk.blue,
    WARN: chalk.yellow,
    ERROR: chalk.red,
};
logger.setDefaultLevel('INFO');
prefix.reg(logger);          
prefix.apply(logger, {
    format(level, name, timestamp) {
        return `${chalk.gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](level)} ${chalk.green(`${name}:`)}`;
    },
});

module.exports.getLogger = (options) => {

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

    if(!options.name) {
        options.name = 'Server';
    }

    let ret = logger.getLogger(options.name);

    if(options.logLevel) {
        ret.setLevel(options.logLevel);
    }

    return ret;
};
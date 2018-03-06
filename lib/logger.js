
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
    if(!options.name) {
        options.name = 'Server';
    }

    let ret = logger.getLogger(options.name);

    if(options.logLevel) {
        ret.setLevel(options.logLevel);
    }

    if(options.udpPort) {
        const socket = dgram.createSocket('udp4');
        socket.unref();
        let udpHost = 'localhost';
        if(options.udpHost) {
            udpHost = options.udpHost;
        }
        //let _write = process.stdout.write;
        process.stdout.write = (msg) => {
            //_write.apply(process.stdout, [`UDP: ${msg}`]);
            socket.send(msg, options.udpPort, udpHost);
        };
        ret.info(`Logging to UDP ${udpHost}:${options.udpPort}`);
    }

    return ret;
};
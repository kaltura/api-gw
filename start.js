const Server = require('./server');

let configPath = null;
if(process.argv.length > 2) {
    configPath = process.argv[2];
}

const server = new Server(configPath);
server.start();
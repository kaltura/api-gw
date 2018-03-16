
const http = require('http');
const cluster = require("cluster");
const httpProxy = require('http-proxy');


if (cluster.isMaster && process.argv.length > 2) {
    for(var i = 0; i < process.argv[2]; i++) {
        cluster.fork();
    }
}
else {
    let proxyServer = httpProxy.createProxyServer({
        target: 'http://127.0.0.1:83'
    });

    http.createServer((request, response) => {
        let d = new Date();
        console.log('handle request', d.getTime());
        proxyServer.web(request, response);
    }).listen(84, () => {
        console.log('listening');
    });
}
const url = require('url');
const Helper = require('../helper');

class PathProcessor extends Helper {
    
    constructor(options, server) {
        super(options, server);

        this.path = options.path;
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process(data) {
        let {request, response, json} = data;
        let This = this;

        return new Promise((resolve, reject) => {
            if(this.filtersMatch(request)) {
                this._onStart(request, response);
                const newUrl = url.resolve(this.path, request.url.replace(/^\//, ''));
                this.logger.debug(`Request [${request.id}] path changed ${request.url} to ${newUrl}`);
                request.url = newUrl;
                this._onEnd(request, response);
            }
            
            resolve(data);
        });
    }
}

module.exports = PathProcessor;
const Promise = require('bluebird');
const Helper = require('../helper');

class AccessLogProcessor extends Helper {
    
    constructor(options) {
        super(options);

        this.overrides = options.overrides;
        this.regex = /^\/(v\d+_\d+)\//;
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process({request, response, json}) {
        let This = this;

        return new Promise((resolve, reject) => {

            if(this.filtersMatch(request)) {
                
            }
            
            resolve({
                request: request,
                response: response,
                json: json
            });
        });
    }
}

module.exports = AccessLogProcessor;
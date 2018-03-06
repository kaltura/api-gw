const Promise = require('bluebird');
const Helper = require('../../lib/helper');

class TestProcessor extends Helper {
    
    constructor(options) {
        super(options);

        this.testText = options.testText;
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process({request, response, json}) {
        let This = this;

        return new Promise((resolve, reject) => {

            if(This.filtersMatch(request)) { 
                This.logger.info(This.testText);
            }
            
            resolve({
                request: request,
                response: response,
                json: json
            });
        });
    }
}

module.exports = TestProcessor;
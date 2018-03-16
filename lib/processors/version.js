const Promise = require('bluebird');
const Helper = require('../helper');

class VersionProcessor extends Helper {
    
    constructor(options, server) {
        super(options, server);

        this.overrides = options.overrides;
        this.regex = /^\/(v\d+_\d+)\//;
        if(options.regex) {
            this.regex = new RegExp(options.regex);
        }
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process(data) {
        let {request, response} = data;
        let This = this;

        return new Promise((resolve, reject) => {

            if(this.filtersMatch(request)) {
                this._onStart(request, response);
                let matches;
                if(null !== (matches = this.regex.exec(request.url))) {
                    if(!request.session) {
                        request.session = {};
                    }

                    let version = matches[1];
                    request.session.version = version;
                    if(request.session.partnerId && this.overrides[request.session.partnerId]) {
                        let regexes = this.overrides[request.session.partnerId];
                        for(let re in regexes) {
                            let regex = new RegExp(re.replace(/x/, '.*'));
                            if(null !== (matches = regex.exec(version))) {
                                request.url = request.url.replace(this.regex, `/${regexes[re]}/`)
                                break;
                            }
                        }
                    }
                }
                this._onEnd(request, response);
            }
            
            resolve(data);
        });
    }
}

module.exports = VersionProcessor;
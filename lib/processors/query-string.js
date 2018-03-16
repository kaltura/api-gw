const fs = require('fs');
const url = require('url');
const querystring = require('querystring');
const Helper = require('../helper');

class QueryStringProcessor extends Helper {
    
    constructor(options, server) {
        super(options, server);

        this.paramsRegex = /^(.*\/service\/[^/]+\/action\/[^/]+)\/(.+)$/;
        if(options.paramsRegex) {
            this.paramsRegex = new RegExp(options.paramsRegex);
        }

        this.nestedRegex = /^([^\[]+)\[([^\[]+)\](.*)$/;
        if(options.nestedRegex) {
            this.nestedRegex = new RegExp(options.nestedRegex);
        }
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
                let parsedUrl = url.parse(request.url);
                request.url = parsedUrl.pathname;
                
                let matches;
                if(null !== (matches = this.paramsRegex.exec(request.url))) {
                    request.url = matches[1];
                    let params = matches[2].split('/');
                    if(params.length >= 2) {                    
                        if(!json) {
                            json = {};
                        }
                        for(let i = 0; i < params.length; i += 2) {
                            This.append(json, params[i], params[i + 1]);
                        }
                    }
                }

                let query = querystring.parse(parsedUrl.query);
                if(query) {
                    if(!json) {
                        json = {};
                    }
                    for(let key in query) {
                        This.append(json, key, query[key]);
                    }
                }
                this._onEnd(request, response);
            }
            
            resolve(data);
        });
    }

    append(json, key, value) {
        let matches;
        if(0 < (matches = key.indexOf(':'))) {
            let parent = key.substr(0, matches);
            let child = key.substr(matches + 1);            
            if(!json[parent]) {
                json[parent] = {};
            }
            this.append(json[parent], child, value);
        }
        else if(null !== (matches = this.nestedRegex.exec(key))) {
            let [all, parent, child, grandChild] = matches;
            if(!json[parent]) {
                json[parent] = {};
            }
            this.append(json[parent], child + grandChild, value);
        }
        else {
            json[key] = value;
        }
    }
}

module.exports = QueryStringProcessor;
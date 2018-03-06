const Promise = require('bluebird');
const Helper = require('../helper');

class JsonReducer extends Helper {
    
    constructor(options) {
        super(options);

        if(!options.paths || !options.paths.length) {
            throw 'Paths must be defined for ' + __filename;
        }

        this.paths = options.paths;
        this.delimiter = '.';

        if(options.delimiter) {
            this.delimiter = options.delimiter;
        }
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    enrich(request, response) {
        let This = this;

        return new Promise((resolve, reject) => {
            if(response.body && this.filtersMatch(request)) {
                let json = JSON.parse(response.body);
                for(var i = 0; i < this.paths.length; i++) {
                    json = This._reduce(json, this.paths[i].split(this.delimiter));
                }
                response.body = JSON.stringify(json, true, 2);
            }
            
            resolve();
        });
    }

    _reduce(json, paths) {
        let path = paths.shift();
        if(paths.length) {
            if(json[path]) {
                json[path] = this._reduce(json[path], paths);
            }
        }
        else {
            delete json[path];
        }

        return json;
    }
}

module.exports = JsonReducer;
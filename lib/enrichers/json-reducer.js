const Promise = require('bluebird');
const Helper = require('../helper');

class JsonReducer extends Helper {
    
    constructor(options, server) {
        super(options, server);

        if((!options.exclude || !options.exclude.length) && (!options.include || !options.include.length)) {
            throw 'Either exclude or include must be defined for ' + __filename;
        }
        
        if(options.exclude && options.include) {
            throw 'Either exclude or include can be defined for ' + __filename + ' but not both.';
        }

        if(options.exclude && options.exclude.length) {
            this.exclude = options.exclude;
        }
        else if(options.include && options.include.length) {
            this.include = options.include;
        }

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
                this._onStart(request, response);
                let json = JSON.parse(response.body);
                if(this.exclude) {
                    for(var i = 0; i < this.exclude.length; i++) {
                        json = This._reduce(json, this.exclude[i].split(this.delimiter));
                    }
                }
                else if(this.include) {
                    json = This._keep(json, this.include.map((path) => path.split(this.delimiter)));
                }
                response.body = JSON.stringify(json, true, 2);
                this._onEnd(request, response);
            }
            
            resolve();
        });
    }

    _merge(a, b) {
        for(let key in b) {
            if(a[key] === undefined) {
                a[key] = b[key];
            }
            else if(typeof(a[key]) === 'object') {
                this._merge(a[key], b[key]);
            }
        }
    }

    _keep(json, paths) {
        let ret = {};
        for(var i = 0; i < paths.length; i++) {
            let path = paths[i].shift();
            if(json[path] === undefined) {
                continue;
            }
            if(paths[i].length) {
                let kept = this._keep(json[path], [paths[i]]);
                if(ret[path] === undefined) {
                    ret[path] = kept;
                }
                else {
                    this._merge(ret[path], kept);
                }
            }
            else {
                ret[path] = json[path];
            }
        }
        return ret;
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
const ipRangeCheck = require('ip-range-check');

class Filter {
    
    constructor(name, options) {
        this.name = name;

        if(options.methods) {
            this.methods = options.methods;
        }
        
        if(options.contentTypes) {
            this.contentTypes = [];
            for(let i in options.contentTypes) {
                let regex = new RegExp(options.contentTypes[i]);
                this.contentTypes.push(regex);
            }
        }

        if(options.paths) {
            this.paths = [];
            for(let i in options.paths) {
                let regex = new RegExp(options.paths[i]);
                this.paths.push(regex);
            }
        }

        if(options.ipRange) {
            this.ipRange = options.ipRange;
        }

        if(options.not) {
            this.not = options.not;
        }
    }

    /**
     * @param {http.IncomingMessage} request 
     * @returns RequestFilter
     */
    get(request) {
        if(!request.filters) {
            request.filters = {};
        }
        if(request.filters[this.name]) {
            return request.filters[this.name];
        }
        var requestFilter = new RequestFilter(this, request);
        request.filters[this.name] = requestFilter;
        return requestFilter;
    }

    /**
     * @param {http.IncomingMessage} request 
     * @returns boolean
     */
    evaluate(request) {

        var methods = true;
        var contentTypes = true;
        var paths = true;
        var ipRange = true;

        if(this.methods) {
            methods = false;
            for(let i in this.methods) {
                if(request.method == this.methods[i]) {
                    methods = true;
                    break;
                }
            }
        }
        
        if(this.contentTypes) {
            contentTypes = false;
            for(let i in this.contentTypes) {
                let regex = this.contentTypes[i];
                if(regex.test(request.headers['content-type'])) {
                    contentTypes = true;
                    break;
                }
            }
        }
        
        if(this.paths) {
            paths = false;
            for(let i in this.paths) {
                let regex = this.paths[i];
                if(regex.test(request.url)) {
                    paths = true;
                    break;
                }
            }
        }

        if(this.ipRange) {
            var ip = request.headers['x-forwarded-for'].split(',').pop() || 
                request.connection.remoteAddress || 
                request.socket.remoteAddress || 
                request.connection.socket.remoteAddress;
            ipRange = ipRangeCheck(ip, this.ipRange);
        }
        
        let ret = methods && contentTypes && paths && ipRange;
        if(this.not) {
            ret = !ret;
        }

        return ret;
    }
}

class RequestFilter {

    constructor(filter, request) {
        this.value = null;
        this.filter = filter;
        this.request = request;
    }

    isFulfilled(reevaluate = false) {
        if(reevaluate || this.value === null) {
            this.value = this.filter.evaluate(this.request);
        }

        return this.value;
    }
}

module.exports = Filter;
/**
 * Base class to all helpers
 */
class Helper {
    
    constructor(options) {
        if(options.filters) {
            this.filters = options.filters;
        }

        if(options.client) {
            this.client = options.client;
        }

        if(options.logger) {
            this.logger = options.logger;
        }
        else {
            this.logger = console;
        }
    }

    filtersMatch(request) {
        if(this.filters) {
            for(var i = 0; i < this.filters.length; i++) {
                var requestFilter = this.filters[i].get(request);
                if(!requestFilter.isFulfilled()) {
                    return false;
                }
            }
        }

        return true;
    }
}

module.exports = Helper;
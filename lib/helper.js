/**
 * Base class to all helpers
 */
class Helper {
    
    constructor(options) {
        this.client = options.client;
        this.logger = options.logger;
        this.filters = options.filters;
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
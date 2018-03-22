const loggerProvider = require('./logger');

/**
 * Base class to all helpers
 */
class Helper {
    
    constructor(options, server) {
        
        let loggerOptions = {
            name: this.constructor.name
        };
        if(options.logLevel) {
            loggerOptions.logLevel = options.logLevel;
        }
        this.logger = loggerProvider.getLogger(loggerOptions);
        
        if(options.filters) {
            this.filters = options.filters.map(filterName => server.filters[filterName]);
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

    _onStart(request, response) {
        this.logger.info(`start [${request.id}]`);
    }

    _onEnd(request, response) {
        this.logger.info(`end [${request.id}]`);
    }

    _onError(request, response) {
        this.logger.info(`error [${request.id}]`);
    }
}

module.exports = Helper;
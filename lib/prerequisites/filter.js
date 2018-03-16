const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');
const Helper = require('../helper');

class FilterPrerequisite extends Helper {
    
    constructor(options, server) {
        super(options, server);

        if(options.validationFilters) {
            this.validationFilters = options.validationFilters.map(filterName => server.filters[filterName]);
        }
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    isFulfilled(request) {
        if(this.filtersMatch(request) && this.validationFilters) {
            this._onStart(request, response);
            for(var i = 0; i < this.validationFilters.length; i++) {
                var requestFilter = this.validationFilters[i].get(request);
                if(!requestFilter.isFulfilled()) {
                    this._onError(request, response);
                    throw `Filter [${this.validationFilters[i].name}] failed validation`;
                }
            }
            this._onEnd(request, response);
        }

        return true;
    }
}

module.exports = FilterPrerequisite;
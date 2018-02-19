/**
 * Base class to all helpers
 */
class Helper {
    
    constructor(options) {
        this.client = options.client;
        this.logger = options.logger;
    }
}

module.exports = Helper;
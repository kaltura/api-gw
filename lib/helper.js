/**
 * Base class to all helpers
 */
class Helper {
    
    constructor(options) {
        this.client = options.client;
    }
}

module.exports = Helper;
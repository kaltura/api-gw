const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');
const Helper = require('../helper');

class KsValidator extends Helper {
    
    constructor(options) {
        super(options);
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    validate(request) {
        return new Promise((resolve, reject) => {
            if(this.filtersMatch(request)) {
                // request.session - partnerId, expiry, type, userId, masterPartnerId, udid, createDate

                // if(expiry < now) reject
                
                // get group from CB
                
                // get revokedKsKeyFormat from group
                // if(revokedKsCbKey != null) reject

                // get userSessionsKeyFormat from group
                // get usersSessions from CB
                // if(usersSessions.UserRevocation > 0 && createDate < usersSessions.UserRevocation) reject
                // if(udid && usersSessions.UserWithUdidRevocations.ContainsKey(udid) && createDate < usersSessions.UserWithUdidRevocations[udid])  reject
                
                // if(sessionId)
                //  get revokedSessionKeyFormat from group
                //  get revokedSessionTime from CB
                //  if (revokedSessionTime > 0) reject
            }
            
            resolve();
        });
    }
}

module.exports = KsValidator;
const fs = require('fs');
const http = require('http');
const sha1 = require('sha1');
const MCrypt = require('mcrypt').MCrypt;
const Promise = require('bluebird');
const querystring = require('querystring');
const Helper = require('../helper');

class PartnerIdProcessor extends Helper {
    
    constructor(options) {
        super(options);
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process(data) {
        let {request, json} = data;
        let This = this;

        return new Promise((resolve, reject) => {
            if(This.filtersMatch(request)) {
                if(json.ks) {
                    request.session = This.crackKs(json.ks);
                    if(request.session) {
                        json.partnerId = request.session.partnerId;
                    }
                }
            }
            
            resolve(data);
        });
    }

    ksToBuffer(ks) {
        let base64 = ks.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(base64, 'base64');
    }

    crackKs(ks) {
        let buf = this.ksToBuffer(ks);
        let [version, partnerId] = buf.toString('binary').split('|', 2);
        
        if(version != 'v2') {
            throw `Only KS version 2 is supported, provided KS [${ks}]`;
        }

        return {
            ks: ks,
            partnerId: parseInt(partnerId)
        };
    }
}

module.exports = PartnerIdProcessor;
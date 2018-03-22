const fs = require('fs');
const http = require('http');
const sha1 = require('sha1');
const Promise = require('bluebird');
const querystring = require('querystring');
const Helper = require('../helper');

class PartnerIdProcessor extends Helper {
    
    constructor(options, server) {
        super(options, server);
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
                this._onStart(request, response);
                if(json.ks) {
                    request.session = This._crackKs(json.ks);
                    if(request.session) {
                        json.partnerId = request.session.partnerId;
                    }
                }
                this._onEnd(request, response);
            }
            
            resolve(data);
        });
    }

    _ksToBuffer(ks) {
        let base64 = ks.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(base64, 'base64');
    }

    _crackKs(ks) {
        let buf = this._ksToBuffer(ks);
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
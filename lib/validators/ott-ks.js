const fs = require('fs');
const md5 = require('md5');
const http = require('http');
const format = require('string-format')
const Promise = require('bluebird');
const couchbase = require('couchbase');

const Helper = require('../helper');

class OttKsValidator extends Helper {
    
    constructor(options, server) {
        super(options, server);

        this.requireKS = false;
        if(options.requireKS) {
            this.requireKS = options.requireKS;
        }

        this.cachePartnerConfigTime = 60 * 60 * 24;
        if(options.cachePartnerConfigTime) {
            this.cachePartnerConfigTime = options.cachePartnerConfigTime;
        }

        // TODO - take from TCM?
        this.partnerKeyFormat = 'group_{0}';
        if(options.partnerKeyFormat) {
            this.partnerKeyFormat = options.partnerKeyFormat;
        }
        this.partnerBucket = 'OTT_Apps';
        if(options.partnerBucket) {
            this.partnerBucket = options.partnerBucket;
        }

        this.cluster = new couchbase.Cluster(options.connectionString);
        this.buckets = {};
        if(!OttKsValidator.partners) {
            OttKsValidator.partners = {};
        }
    }

    _getBucket(name) {
        if(!this.buckets[name]) {
            this.buckets[name] = this.cluster.openBucket(name);
        }

        return this.buckets[name];
    }

    _getKey(bucketName, key) {
        return new Promise((resolve, reject) => {
            let bucket = this._getBucket(bucketName);
            bucket.get(key, (err, results) => {
                if(err) {
                    reject(err);
                }
                else {
                    resolve(results.value);
                }
            });
        });
    }

    _getPartner(partnerId) {
        return new Promise((resolve, reject) => {
            if(OttKsValidator.partners[partnerId]) {
                let now = Math.round((new Date()).getTime() / 1000);
                if(OttKsValidator.partners[partnerId].cache_time + this.cachePartnerConfigTime > now) {
                    resolve(OttKsValidator.partners[partnerId]);
                    return;
                }
            }

            let partnerKey = format(this.partnerKeyFormat, partnerId);
            this._getKey(this.partnerBucket, partnerKey)
            .then((partnerConfig) => {
                let revokedKsKeyFormat = 'r_ks_{0}';
                if(partnerConfig.revoked_ks_key_format) {
                    revokedKsKeyFormat = partnerConfig.revoked_ks_key_format;
                }

                let revokedSessionKeyFormat = 'r_session_{0}';
                if(partnerConfig.revoked_session_key_format) {
                    revokedSessionKeyFormat = partnerConfig.revoked_session_key_format;
                }

                let userSessionsKeyFormat = 'sessions_{0}';
                if(partnerConfig.users_sessions_key_format) {
                    userSessionsKeyFormat = partnerConfig.users_sessions_key_format;
                }
                
                let partner = {
                    id: partnerId,
                    cache_time: Math.round((new Date()).getTime() / 1000),
                    revokedKsKeyFormat: revokedKsKeyFormat,
                    revokedSessionKeyFormat: revokedSessionKeyFormat,
                    userSessionsKeyFormat: userSessionsKeyFormat,
                };
                OttKsValidator.partners[partnerId] = partner;
                resolve(partner);
            }, (err) => {
                reject(err);
            });
        });
    }

    _validateRevokedKs(revokedKsKey, ks) {
        return new Promise((resolve, reject) => {
            this._getKey(this.partnerBucket, revokedKsKey)
            .then(() => {
                reject(`KS [${ks}] revoked`);
            }, () => {
                resolve();
            });
        });
    }

    _validateRevokedUser(userSessionsKey, createDate, userId, udid) {
        return new Promise((resolve, reject) => {
            this._getKey(this.partnerBucket, userSessionsKey)
            .then((usersSessions) => {
                if(typeof(usersSessions) == 'string') {
                    usersSessions = JSON.parse(usersSessions);
                }
                if(usersSessions.user_revocation > 0 && createDate <= usersSessions.user_revocation) {
                    reject(`User [${userId}] sessions revoked`);
                }
                else if(udid && usersSessions.user_with_udid_revocations[udid] && createDate <= usersSessions.user_with_udid_revocations[udid]) {
                    reject(`User [${userId}] sessions for UDID [${udid}] revoked`);
                }
                else {
                    resolve();
                }
            }, () => {
                resolve();
            });
        });
    }

    _validateRevokedSession(revokedSessionKey, sessionid) {
        return new Promise((resolve, reject) => {
            this._getKey(this.partnerBucket, revokedSessionKey)
            .then((revokedSessionTime) => {
                if(revokedSessionTime > 0) {
                    reject(`Session [${sessionid}] revoked`);
                }
                else {
                    resolve();
                }
            }, () => {
                resolve();
            });
        });
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    validate(request, response) {
        return new Promise((resolve, reject) => {
            if(this.filtersMatch(request)) {
                this._onStart(request, response);
                if(!request.session || !request.session.ks) {
                    if(this.requireKS) {
                        reject('No session found');
                        this._onError(request, response);
                    }
                    else {
                        resolve();
                    }
                    return;
                }
                let {ks, partnerId, expiry, userId, udid, createDate, sessionid} = request.session;
                
                let now = Math.round((new Date()).getTime() / 1000);
                if(expiry < now) {
                    reject(`KS [${ks}] expired`);
                    this._onError(request, response);
                    return;
                }
                
                this._getPartner(partnerId)
                .then((partner) => {

                    let revokedKsKey = format(partner.revokedKsKeyFormat, md5(ks));
                    let userSessionsKey = format(partner.userSessionsKeyFormat, userId);                
                    let revokedSessionKey = format(partner.revokedSessionKeyFormat, sessionid);
                    
                    Promise.all([
                        this._validateRevokedKs(revokedKsKey, ks),
                        this._validateRevokedUser(userSessionsKey, createDate, userId, udid),
                        this._validateRevokedSession(revokedSessionKey, sessionid)
                    ])
                    .then(() => {
                        resolve();
                        this._onEnd(request, response);
                    }, (err) => {
                        reject(err);
                        this._onError(request, response);
                    });
                });
            }
            else {
                resolve();
            }
        });
    }

    close() {
        for(let name in this.buckets) {
            this.buckets[name].disconnect();
        }
    }
}

module.exports = OttKsValidator;
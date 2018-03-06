const fs = require('fs');
const http = require('http');
const sha1 = require('sha1');
const MCrypt = require('mcrypt').MCrypt;
const Promise = require('bluebird');
const querystring = require('querystring');
const PartnerIdProcessor = require('./partner-id');

class KsProcessor extends PartnerIdProcessor {
    
    constructor(options) {
        super(options);

        this.SHA1_SIZE = 20;
        this.RANDOM_SIZE = 16;
        this.FIELD_EXPIRY =              '_e';
        this.FIELD_TYPE =                '_t';
        this.FIELD_USER =                '_u';
        this.FIELD_MASTER_PARTNER_ID =   '_m';
        this.FIELD_ADDITIONAL_DATA =     '_d';
    
        this.secrets = options.secrets;
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process(data) {
        let {request, json} = data;
        let This = this;

        return new Promise((resolve, reject) => {
            if(this.filtersMatch(request)) {
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

    crackKs(ks) {
        let ret = super.crackKs(ks);
        let buf = this.ksToBuffer(ks);
        let indexOfSeperator = `v2|${ret.partnerId}|`.length;
        let encrypted = buf.slice(indexOfSeperator);
        
        if(!this.secrets[ret.partnerId]) {
            throw `Secret not found for partner id [${ret.partnerId}]`;
        }

        let key = this.sha1Raw(this.secrets[ret.partnerId]).slice(0, 16);
        let decrypted = this.decrypt(key, encrypted);
        let hash = decrypted.slice(0, this.SHA1_SIZE).toString('hex');
        let fields = decrypted.slice(this.SHA1_SIZE).toString('hex').replace(/0+$/, '');
        fields = Buffer.from(fields, 'hex');

        let fieldsHash = this.sha1Raw(fields).toString('hex');
        if (hash !== fieldsHash) {
			throw `Hash [${hash}] doesn't match sha1 on partner [${ret.partnerId}]`;
        }
        
        fields = fields.slice(this.RANDOM_SIZE).toString('utf8');
        fields = querystring.parse(fields);

        for(let key in fields) {
            // TODO handle privileges
            switch(key) {
                case this.FIELD_EXPIRY:
                    ret.expiry = parseInt(fields[key]);
                    break;

                case this.FIELD_TYPE:
                    ret.type = parseInt(fields[key]);
                    break;

                case this.FIELD_USER:
                    ret.userId = fields[key];
                    break;

                case this.FIELD_MASTER_PARTNER_ID:
                    ret.masterPartnerId = parseInt(fields[key]);
                    break;

                case this.FIELD_ADDITIONAL_DATA:
                    let data = querystring.parse(fields[key], ';');                    
                    for(let subKey in data) {
                        switch(subKey) {
                            case 'UDID':
                                ret.udid = data[subKey];
                                break;
                                
                            case 'CreateDate':
                                ret.createDate = parseInt(data[subKey]);
                                break;
                        }
                    }
                    break;
            }
        }

        return ret;
    }

    sha1Raw(str) {
        let sha = sha1(str);
        let codes = [];
        for(let i = 0; i < sha.length; i += 2) {
            codes.push(parseInt(sha.substr(i, 2), 16));
        }
        return Buffer.from(String.fromCharCode.apply(null, codes), 'binary');
    }

    decrypt(secret, encrypted) {
        let iv = '\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0';
        const decipher = new MCrypt('rijndael-128', 'cbc');
        decipher.open(secret, iv);
        return decipher.decrypt(encrypted);
    }
}

module.exports = KsProcessor;
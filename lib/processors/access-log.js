const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const dateFormat = require('dateformat');
const Helper = require('../helper');

class AccessLogProcessor extends Helper {
    
    constructor(options) {
        super(options);
        
        if(options.urlReplacements) {
            this.urlReplacements = options.urlReplacements;
        }

        let accessLogDir = path.dirname(options.path.replace(/"/, ''));
        if(!fs.existsSync(accessLogDir)) {
            fs.mkdirSync(accessLogDir);
        }

        let matches;
        let accessLogPath = options.path;
        if(null !== (matches = /\{([^\}]+)\}/.exec(accessLogPath))) {
            accessLogPath = accessLogPath.replace(matches[0], dateFormat(new Date(), matches[1]));
        }
        this.accessLogFile = fs.openSync(accessLogPath, 'a');
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    process({request, response, json}) {
        let This = this;

        return new Promise((resolve, reject) => {

            if(this.filtersMatch(request)) {                
                let originalUrl = request.url;
                if(this.urlReplacements) {
                    for(let regex in this.urlReplacements) {
                        let replace = this.urlReplacements[regex];
                        originalUrl = originalUrl.replace(new RegExp(regex), replace);
                    }
                }
                let startDate = new Date();
                response.on('finish', () => {
                    this.logger.debug(`Request [${request.key}] finished`);
                    let endDate = new Date();
                    let remote_addr = request.socket.address().address;
                    let remote_user; // TODO
                    let time_local = dateFormat(endDate, "dd/mmm/yyyy:HH:MM:ss ") + dateFormat(endDate, "Z").substr(3);
                    let requestStr = `${request.method} ${originalUrl} HTTP/${request.httpVersion}`; // TODO
                    let status = response.statusCode;
                    let bytes_sent = (response.getHeader('content-length') ? response.getHeader('content-length') : '');
                    let request_time = (endDate.getMilliseconds() - startDate.getMilliseconds()) / 1000;
                    let http_referer = (request.headers.referer ? request.headers.referer : '');
                    let http_user_agent = request.headers['user-agent'];
                    let http_host = request.headers.host;
                    let pid = process.pid;
                    let upstream_cache_status; // TODO
                    let request_length = request.headers['content-length'];
                    let sent_http_content_range = (response.getHeader('content-range') ? response.getHeader('content-range') : '');
                    let http_x_forwarded_for = (request.headers['x-forwarded-for'] ? request.headers['x-forwarded-for'] : '');
                    let http_x_forwarded_server = (request.headers['x-forwarded-server'] ? request.headers['x-forwarded-server'] : '');
                    let http_x_forwarded_host = (request.headers['x-forwarded-host'] ? request.headers['x-forwarded-host'] : '');
                    let sent_http_cache_control = (response.getHeader('cache-control') ? response.getHeader('cache-control') : '');
                    let connection; // TODO
                    let partner_id = request.session ? request.session.partnerId : '';
                    let ks = request.session ? request.session.ks : '';
                    let raw_post = request.post;
                    let stub_response; // TODO
                    let sent_http_x_me = (response.getHeader('x-me') ? response.getHeader('x-me') : '');

                    let log = `${remote_addr} - ${remote_user} [${time_local}] "${requestStr}" `;
                    log += `${status} ${bytes_sent} ${request_time} "${http_referer}" `;
                    log += `"${http_user_agent}"  `;
                    log += `"${http_host}" ${pid} - `;
                    log += `${upstream_cache_status} `;
                    log += `${request_length} "${sent_http_content_range}" "${http_x_forwarded_for}" `;
                    log += `"${http_x_forwarded_server}" "${http_x_forwarded_host}" "${sent_http_cache_control}" - `;
                    log += `${connection} "${partner_id}" "${ks}" "${raw_post}" "${stub_response}" "${sent_http_x_me}"`;
                    
                    This._log(log);
                });
            }
            
            resolve({
                request: request,
                response: response,
                json: json
            });
        });
    }

    _log(str) {
        fs.write(this.accessLogFile, str + "\n");
    }
}

module.exports = AccessLogProcessor;
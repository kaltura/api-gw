const Promise = require('bluebird');
const xpath = require('xpath');
const filterxml = require('filterxml');
const {DOMParser, XMLSerializer} = require('xmldom');
const Helper = require('../helper');

const ELEMENT_NODE                   = 1;
const ATTRIBUTE_NODE                 = 2;
const TEXT_NODE                      = 3;
const CDATA_SECTION_NODE             = 4;
const ENTITY_REFERENCE_NODE          = 5;
const ENTITY_NODE                    = 6;
const PROCESSING_INSTRUCTION_NODE    = 7;
const COMMENT_NODE                   = 8;
const DOCUMENT_NODE                  = 9;
const DOCUMENT_TYPE_NODE             = 10;
const DOCUMENT_FRAGMENT_NODE         = 11;
const NOTATION_NODE                  = 12;

class XmlReducer extends Helper {
    
    constructor(options) {
        super(options);

        if((!options.exclude || !options.exclude.length) && (!options.include || !options.include.length)) {
            throw 'Either exclude or include must be defined for ' + __filename;
        }
        
        if(options.exclude && options.include) {
            throw 'Either exclude or include can be defined for ' + __filename + ' but not both.';
        }

        if(options.exclude && options.exclude.length) {
            this.exclude = options.exclude;
        }
        else if(options.include && options.include.length) {
            this.include = options.include;
        }

        this.namespaces = options.namespaces;
        this.xmlSerializer = new XMLSerializer();
    }

    /**
     * @param {http.IncomingMessage} request
     * @returns {Promise}
     */
    enrich(request, response) {
        let This = this;

        return new Promise((resolve, reject) => {
            if(response.body && this.filtersMatch(request)) {
                if(this.exclude) {
                    filterxml(response.body, this.exclude, this.namespaces, (err, output) => {
                        if(err) {
                            reject(err);
                        }
                        else {
                            response.body = output;
                            resolve();
                        }
                    });
                }
                else if(this.include) {
                    var doc = new DOMParser().parseFromString(response.body);
                    this._keep(doc, this.include);
                    response.body = this.xmlSerializer.serializeToString(doc);
                    resolve();
                }
            }
            else {
                resolve();
            }
        });
    }

    _keep(doc, paths) {
        var select = xpath.useNamespaces(this.namespaces);

        let add = (node) => {
            if(node.keep || node === doc) {
                return;
            }
            node.keep = true;
            if(node.parentNode) {
                add(node.parentNode);
            }
            if(node.ownerElement) {
                add(node.ownerElement);
            }
        };

        for(var i = 0; i < paths.length; i++) {
            let existingNodes = select(paths[i], doc);
            for(let j = 0; j < existingNodes.length; j++) {
                add(existingNodes[j]);
            }
        }

        let scan = (node) => {
            if(node.nodeType != ATTRIBUTE_NODE && node.nodeType != ELEMENT_NODE) {
                return;
            }
            if(!node.keep) {
                if(node.nodeType == ATTRIBUTE_NODE) {
                    node.ownerElement.removeAttribute(node.name);
                }
                else {
                    node.parentNode.removeChild(node);
                }
            }
            else {
                if(node.childNodes) {
                    for(let i = 0; i < node.childNodes.length; i++) {
                        scan(node.childNodes[i]);
                    }
                }
                if(node.attributes) {
                    for(let i = 0; i < node.attributes.length; i++) {
                        scan(node.attributes[i]);
                    }
                }
            }
        };

        scan(doc.documentElement);
    }
}

module.exports = XmlReducer;
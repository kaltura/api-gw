const expect = require("chai").expect;
const kaltura = require('kaltura-ott-client');
const KsProcessor = require('../lib/ks-processor');

describe("ks-processor", () => {
    describe("crack", () => {
    	let ks = 'djJ8MjAzfMvEqu4HezrDJfIF_726hVYCvtU0OH_nWAQd4e3kwtfHj7t2-7UPLXPEYwCnE7HOLS8EgBiM8SRqzDPmwZdYrBrZzrdLtGpOqvJJbhHrfajYG2VCjS-t6nx6I59bQozT81479NcOZGc9vOsJHuCDMpI0r1PEzrYOgkq--xiInHW3HZOCLrSXS8c8mWvHngSZQg==';

		
        let clientConfig = new kaltura.Configuration();
        let client = new kaltura.Client(clientConfig);
		let ksProcessor = new KsProcessor({
			client: client,
			secrets: {
				203: '12345'
			}
		});

    	it('cracked', (done) => {
			
			let details = ksProcessor.crackKs(ks)
			expect(details.partnerId).to.equal(203);
			done();
        });
    });
});

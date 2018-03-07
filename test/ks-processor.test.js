const expect = require('chai').expect;
const kaltura = require('kaltura-ott-client');
const KsProcessor = require('../lib/processors/ks');

describe('ks-processor', () => {
    describe('crack-partner-id', () => {
    	let ks = 'djJ8MjAzfMvEqu4HezrDJfIF_726hVYCvtU0OH_nWAQd4e3kwtfHj7t2-7UPLXPEYwCnE7HOLS8EgBiM8SRqzDPmwZdYrBrZzrdLtGpOqvJJbhHrfajYG2VCjS-t6nx6I59bQozT81479NcOZGc9vOsJHuCDMpI0r1PEzrYOgkq--xiInHW3HZOCLrSXS8c8mWvHngSZQg==';

		let ksProcessor = new KsProcessor({
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
	
    describe('crack-session-id', () => {
    	let ks = 'djJ8MjAzfIAd3BGyQiWiTNR2c8yTjIIVE6-JUV2g9vsGOf1i0-QyA7K3yAlxzfYC1UJ6cE54AmgH5SQwHAu_MBKSj4VFLWybRXHL-UP1R86khXn6PKlf6Z-uftT0-HDb4PH1X83x9sgPs5FER91uuAhvJ3Lw3L3HZRvOY9iH2nQ40RUPSZ6_U_sR6O9RhkrRtfEfdxv-JtDpcqHf_nYVVcH_xE2oLTxMQ0kt4F42EapKPgZfDtmQfgDvqwtn_UOiUq7K8kxI6g==';

		let ksProcessor = new KsProcessor({
			secrets: {
				203: '12345'
			}
		});

    	it('cracked', (done) => {
			
			let details = ksProcessor.crackKs(ks)
			expect(details.sessionid).to.equal('efbf789cb6384739b82769e17b128fee');
			done();
        });
	});
	
});

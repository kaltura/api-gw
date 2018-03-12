const expect = require('chai').expect;
const shortid = require('shortid');
const kaltura = require('kaltura-ott-client');
const JsonReducer = require('../lib/enrichers/json-reducer');

describe('JSON reducer', () => {
    describe('Exclude', () => {
		let jsonReducer = new JsonReducer({
			exclude: [
				'aaa',
				'bbb.ccc',
				'ddd.eee.fff',
				'ddd.eee.ggg',
				'ddd.eee.hhh',
				'ddd.eee.iii',
				'ddd.eee.jjj'
			]
		});

		let json = {
			aaa: shortid.generate(),
			bbb: {
				bbb: shortid.generate(),
				ccc: [shortid.generate(), shortid.generate()]
			},
			ddd: {
				ddd: shortid.generate(),
				eee: {
					eee: shortid.generate(),
					fff: {
						fff: shortid.generate(),
						ggg: shortid.generate()
					},
					ggg: false,
					hhh: true,
					iii: 0,
					jjj: 1
				}
			}
		};
		let expectedOutput = {
			bbb: {
				bbb: json.bbb.bbb
			},
			ddd: {
				ddd: json.ddd.ddd,
				eee: {
					eee: json.ddd.eee.eee
				}
			}
		};

    	it('Excluded', (done) => {
			let response = {
				body: JSON.stringify(json)
			};
			jsonReducer.enrich({}, response);
			let output = JSON.parse(response.body);
			expect(output).to.deep.equal(expectedOutput);
			done();
        });
	});
	
    describe('Include', () => {
		let jsonReducer = new JsonReducer({
			include: [
				'a1',
				'a2.b22',
				'a3.b32.c32',
				'a3.b32.c33',
				'a3.b32.c34',
				'a3.b32.c35',
				'a3.b32.c36',
				'x1'
			]
		});

		let json = {
			a1: shortid.generate(),
			a2: {
				b21: shortid.generate(),
				b22: [shortid.generate(), shortid.generate()]
			},
			a3: {
				b31: shortid.generate(),
				b32: {
					c31: shortid.generate(),
					c32: {
						d31: shortid.generate(),
						d32: shortid.generate()
					},
					c33: false,
					c34: true,
					c35: 0,
					c36: 1
				}
			},
			a4: shortid.generate()
		};
		let expectedOutput = {
			a1: json.a1,
			a2: {
				b22: json.a2.b22
			},
			a3: {
				b32: {
					c32: json.a3.b32.c32,
					c33: json.a3.b32.c33,
					c34: json.a3.b32.c34,
					c35: json.a3.b32.c35,
					c36: json.a3.b32.c36
				}
			}
		};

    	it('Included', (done) => {
			let response = {
				body: JSON.stringify(json)
			};
			jsonReducer.enrich({}, response);
			let output = JSON.parse(response.body);
			expect(output).to.deep.equal(expectedOutput);
			done();
        });
	});
});

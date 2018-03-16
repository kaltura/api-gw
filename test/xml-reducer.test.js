const expect = require('chai').expect;
const shortid = require('shortid');
const kaltura = require('kaltura-ott-client');
const {DOMParser, XMLSerializer} = require('xmldom');
const XmlReducer = require('../lib/enrichers/xml-reducer');

describe('JSON reducer', () => {
    describe('Exclude', () => {
		let xmlReducer = new XmlReducer({
			exclude: [
				'./xml/a1',
				'//a2',
				'xml/a3',
				'xml/a4/b41',
				'xml/a4/b42/@c41',
				'xml/a4/b43',
				'xml/a4/b44',
				'xml/a4/b45',
				'xml/a4/b46',
				'x1'
			]
		});

		let json = {
			a1: shortid.generate(),
			a21: shortid.generate(),
			a22: shortid.generate(),
			a3: shortid.generate(),
			a4: {
				b411: shortid.generate(),
				b412: shortid.generate(),
				b42: {
					c41: shortid.generate(),
					c42: shortid.generate()
				},
				b43: true,
				b44: false,
				b45: 0,
				b46: 1,
				b471: shortid.generate(),
				b472: shortid.generate(),
				b473: shortid.generate()
			}
		};

		let xml = '<xml>';
		xml += `	<a1>${json.a1}</a1>`;
		xml += `	<a2>${json.a21}</a2>`;
		xml += `	<a2>${json.a22}</a2>`;
		xml += `	<a3>${json.a3}</a3>`;
		xml += `	<a4>`;
		xml += `		<b41>${json.a4.b411}</b41>`;
		xml += `		<b42 c41="${json.a4.b42.c41}" c42="${json.a4.b42.c42}"/>`;
		xml += `		<b43>${json.a4.b43}</b43>`;
		xml += `		<b44>${json.a4.b44}</b44>`;
		xml += `		<b45>${json.a4.b45}</b45>`;
		xml += `		<b46>${json.a4.b46}</b46>`;
		xml += `		<b47>${json.a4.b471}</b47>`;
		xml += `		<b47>${json.a4.b472}</b47>`;
		xml += `	</a4>`;
		xml += `	<a4>`;
		xml += `		<b41>${json.a4.b412}</b41>`;
		xml += `		<b47>${json.a4.b473}</b47>`;
		xml += `	</a4>`;
		xml += '</xml>';

		let expectedOutput ='<xml>';
		expectedOutput += `	<a4>`;
		expectedOutput += `		<b42 c42="${json.a4.b42.c42}"/>`;
		expectedOutput += `		<b47>${json.a4.b471}</b47>`;
		expectedOutput += `		<b47>${json.a4.b472}</b47>`;
		expectedOutput += `	</a4>`;
		expectedOutput += `	<a4>`;
		expectedOutput += `		<b47>${json.a4.b473}</b47>`;
		expectedOutput += `	</a4>`;
		expectedOutput += '</xml>';

    	it('Excluded', (done) => {
			let response = {
				body: xml
			};
			xmlReducer.enrich({}, response);
			expect(response.body).to.equal(expectedOutput);
			done();
		});		
	});
	
	// TODO test namespaces

    describe('Include', () => {
		let xmlReducer = new XmlReducer({
			include: [
				'./xml/a1',
				'//a2',
				'xml/a3',
				'xml/a4/b41',
				'xml/a4/b42/@c41',
				'xml/a4/b43',
				'xml/a4/b44',
				'xml/a4/b45',
				'xml/a4/b46',
				'x1'
			]
		});

		let json = {
			a1: shortid.generate(),
			a21: shortid.generate(),
			a22: shortid.generate(),
			a3: shortid.generate(),
			a4: {
				b411: shortid.generate(),
				b412: shortid.generate(),
				b42: {
					c41: shortid.generate(),
					c42: shortid.generate()
				},
				b43: true,
				b44: false,
				b45: 0,
				b46: 1,
				b471: shortid.generate(),
				b472: shortid.generate(),
				b473: shortid.generate()
			}
		};

		let xml = '<xml>';
		xml += `	<a1>${json.a1}</a1>`;
		xml += `	<a2>${json.a21}</a2>`;
		xml += `	<a2>${json.a22}</a2>`;
		xml += `	<a3>${json.a3}</a3>`;
		xml += `	<a4>`;
		xml += `		<b41>${json.a4.b411}</b41>`;
		xml += `		<b42 c41="${json.a4.b42.c41}" c42="${json.a4.b42.c42}"/>`;
		xml += `		<b43>${json.a4.b43}</b43>`;
		xml += `		<b44>${json.a4.b44}</b44>`;
		xml += `		<b45>${json.a4.b45}</b45>`;
		xml += `		<b46>${json.a4.b46}</b46>`;
		xml += `		<b47>${json.a4.b471}</b47>`;
		xml += `		<b47>${json.a4.b472}</b47>`;
		xml += `	</a4>`;
		xml += `	<a4>`;
		xml += `		<b41>${json.a4.b412}</b41>`;
		xml += `		<b47>${json.a4.b473}</b47>`;
		xml += `	</a4>`;
		xml += '</xml>';

		let expectedOutput ='<xml>';
		expectedOutput += `<a1>${json.a1}</a1>`;
		expectedOutput += `<a2>${json.a21}</a2>`;
		expectedOutput += `<a2>${json.a22}</a2>`;
		expectedOutput += `<a3>${json.a3}</a3>`;
		expectedOutput += `<a4>`;
		expectedOutput += `<b41>${json.a4.b411}</b41>`;
		expectedOutput += `<b42 c41="${json.a4.b42.c41}"/>`;
		expectedOutput += `<b43>${json.a4.b43}</b43>`;
		expectedOutput += `<b44>${json.a4.b44}</b44>`;
		expectedOutput += `<b45>${json.a4.b45}</b45>`;
		expectedOutput += `<b46>${json.a4.b46}</b46>`;
		expectedOutput += `</a4>`;
		expectedOutput += `<a4>`;
		expectedOutput += `<b41>${json.a4.b412}</b41>`;
		expectedOutput += `</a4>`;
		expectedOutput += '</xml>';

		var doc = new DOMParser().parseFromString(expectedOutput.replace(/^\s+(.+)\s+$/, '$1'));
		var xmlSerializer = new XMLSerializer();
		expectedOutput = xmlSerializer.serializeToString(doc);

		var doc = new DOMParser().parseFromString(xml.replace(/^\s+(.+)\s+$/, '$1'));
		var xmlSerializer = new XMLSerializer();
		xml = xmlSerializer.serializeToString(doc);

    	it('Included', (done) => {
			let response = {
				body: xml
			};
			xmlReducer.enrich({}, response);
			output = response.body.replace(/>[\s\t\r\n]+</g, '><');
			expect(output).to.equal(expectedOutput);
			done();
        });
	});

	// TODO test namespaces
	
});

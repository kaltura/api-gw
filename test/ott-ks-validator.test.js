const fs = require('fs');
const md5 = require('md5');
const expect = require('chai').expect;
const shortid = require('shortid');
const kaltura = require('kaltura-ott-client');

const KsValidator = require('../lib/validators/ott-ks');

let debug = false;
let partnerId = 203;
let serviceUrl = 'http://34.249.122.223:8080/v4_8';
let connectionString = 'couchbase://couchbase1,couchbase2,couchbase3';

const configPath = './config/test.json';
if(fs.existsSync(configPath)) {
	const testConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
	debug = testConfig.debug;
	partnerId = testConfig.partnerId;
	serviceUrl = testConfig.serviceUrl;
	connectionString = testConfig.connectionString;
}

let config = new kaltura.Configuration();
config.serviceUrl = serviceUrl;

if(!debug) {
	config.setLogger({		
		error: console.error,
		log: (msg) => {},
		debug: (msg) => {}
	});
}

const client = new kaltura.Client(config);

const username = shortid.generate();
const password = shortid.generate();

describe('OTT KS validator', () => {
    describe('Expiry', () => {

    	it('Valid', (done) => {		
			let ksValidator = new KsValidator({
				connectionString: connectionString
			});
		
			ksValidator.validate({
				session: {
					ks: shortid.generate(),
					partnerId: partnerId,
					userId: shortid.generate(),
					expiry: Math.round((new Date()).getTime() / 1000) + 5000
				}
			})
			.then(() => {
				done();
				ksValidator.close();
			}, (err) => {
				done(new Error('Session exipry expect to be valid: ' + err));
				ksValidator.close();
			});
		});
		
    	it('Expired', (done) => {	
			let ksValidator = new KsValidator({
			});
			
			ksValidator.validate({
				session: {
					ks: shortid.generate(),
					expiry: Math.round((new Date()).getTime() / 1000) - 5000
				}
			})
			.then(() => {
				done(new Error('Session exipry expect to be invalid'));
				ksValidator.close();
			}, () => {
				done();
				ksValidator.close();
			});
        });
	});
	
    describe("API", () => {
    	const user = new kaltura.objects.OTTUser({
    		username: username,
    		firstName: shortid.generate(),
    		lastName: shortid.generate(),
    		email: shortid.generate() + "@test.com"
    	});

    	it('Creates user', (done) => {
    		kaltura.services.ottUser.register(partnerId, user, password)
        	.completion((success, response) => {
				const {executionTime, result} = response;
				const user = result;
        		expect(success).to.equal(true);
        		expect(user).to.not.be.a('null');
        		expect(user.id).to.not.be.a('null');
        		done();
        	})
        	.execute(client);
		});
		
		it('Login', (done) => {
			kaltura.services.ottUser.login(partnerId, username, password)
			.completion((success, response) => {
				const {executionTime, result} = response;
				const loginResponse = result;
				expect(success).to.equal(true);
				expect(loginResponse).to.not.be.a('null');
				expect(loginResponse.loginSession).to.not.be.a('null');
				expect(loginResponse.loginSession.ks).to.not.be.a('null');
				client.setKs(loginResponse.loginSession.ks);
				done();
			})
			.execute(client);
		});
		
		it('Revoke KS', (done) => {
			kaltura.services.session.get()
			.completion((success, response) => {
				const {executionTime, result} = response;
				const session = result;
				expect(success).to.equal(true);
				expect(session).to.not.be.a('null');
				expect(session.ks).to.not.be.a('null');
				expect(session.userId).to.not.be.a('null');
					
				kaltura.services.ottUser.logout()
				.completion((success, response) => {
					const {executionTime, result} = response;
					expect(success).to.equal(true);
					expect(result).to.equal(true);

					let ksValidator = new KsValidator({
						connectionString: connectionString
					});
				
					ksValidator.validate({
						session: {
							ks: client.getKs(),
							partnerId: partnerId,
							userId: session.userId,
							expiry: session.expiry,
							udid: session.udid,
							createDate: session.createDate
						}
					})
					.then(() => {
						done(new Error('Session expected to be revoked'));
						ksValidator.close();
					}, (err) => {
						done();
						ksValidator.close();
					});
				})
				.execute(client);
			})
			.execute(client);
		});
		
		it('Revoke user', (done) => {
			kaltura.services.ottUser.login(partnerId, username, password)
			.completion((success, response) => {
				const {executionTime, result} = response;
				const loginResponse = result;
				client.setKs(loginResponse.loginSession.ks);
				
				kaltura.services.session.get()
				.completion((success, response) => {
					const {executionTime, result} = response;
					const session = result;
					expect(success).to.equal(true);
					expect(session).to.not.be.a('null');
					expect(session.ks).to.not.be.a('null');
					expect(session.userId).to.not.be.a('null');
						
					kaltura.services.session.revoke()
					.completion((success, response) => {
						const {executionTime, result} = response;
						expect(success).to.equal(true);
						expect(result).to.equal(true);
	
						let ksValidator = new KsValidator({
							connectionString: connectionString
						});
					
						ksValidator.validate({
							session: {
								ks: client.getKs(),
								partnerId: partnerId,
								userId: session.userId,
								expiry: session.expiry,
								udid: session.udid,
								createDate: session.createDate
							}
						})
						.then(() => {
							done(new Error('User sessions expected to be revoked'));
							ksValidator.close();
						}, (err) => {
							done();
							ksValidator.close();
						});
					})
					.execute(client);
				})
				.execute(client);
			})
			.execute(client);
		});

		it('Revoke user with UDID', (done) => {
			let udid = shortid.generate();
			kaltura.services.ottUser.login(partnerId, username, password, null, udid)
			.completion((success, response) => {
				const {executionTime, result} = response;
				const loginResponse = result;
				client.setKs(loginResponse.loginSession.ks);
				
				kaltura.services.session.get()
				.completion((success, response) => {
					const {executionTime, result} = response;
					const session = result;
					expect(success).to.equal(true);
					expect(session).to.not.be.a('null');
					expect(session.ks).to.not.be.a('null');
					expect(session.userId).to.not.be.a('null');
						
					kaltura.services.ottUser.login(partnerId, username, password, null, udid)
					.completion((success, response) => {
						const {executionTime, result} = response;
						expect(success).to.equal(true);
	
						let ksValidator = new KsValidator({
							connectionString: connectionString
						});
					
						ksValidator.validate({
							session: {
								ks: client.getKs(),
								partnerId: partnerId,
								userId: session.userId,
								expiry: session.expiry,
								udid: session.udid,
								createDate: session.createDate
							}
						})
						.then(() => {
							done(new Error('User sessions expected to be revoked'));
							ksValidator.close();
						}, (err) => {
							done();
							ksValidator.close();
						});
					})
					.execute(client);
				})
				.execute(client);
			})
			.execute(client);
		});
		
		describe("App-Token", () => {		
			var appToken = new kaltura.objects.AppToken({
				hashType: kaltura.enums.AppTokenHashType.MD5
			});
			
			it('App-Token created', (done) => {	
				
				kaltura.services.ottUser.login(partnerId, username, password)
				.completion((success, response) => {
					const {executionTime, result} = response;
					const loginResponse = result;
					client.setKs(loginResponse.loginSession.ks);
							
					kaltura.services.appToken.add(appToken)
					.completion((success, response) => {
						const {executionTime, result} = response;
						appToken = result;
						expect(success).to.equal(true);
						expect(appToken).to.not.be.a('null');
						expect(appToken.id).to.not.be.a('null');
						expect(appToken.token).to.not.be.a('null');
						expect(appToken.sessionUserId).to.not.be.a('null');
						done();
					})
					.execute(client);
				})
				.execute(client);	
			});
			
			it('KS created', (done) => {
				
				client.setKs(null);
				kaltura.services.ottUser.anonymousLogin(partnerId)
				.completion((success, response) => {
					const {executionTime, result} = response;
					const loginSession = result;
					expect(success).to.equal(true);
					expect(loginSession).to.not.be.a('null');
					expect(loginSession.ks).to.not.be.a('null');
					
					client.setKs(loginSession.ks);
					
					const tokenHash = md5(loginSession.ks + appToken.token);
					kaltura.services.appToken.startSession(appToken.id, tokenHash)
					.completion((success, response) => {
						const {executionTime, result} = response;
						const sessionInfo = result;
						expect(success).to.equal(true);
						expect(sessionInfo).to.not.be.a('null');
						expect(sessionInfo.ks).to.not.be.a('null');
						expect(sessionInfo.userId).to.not.be.a('null');
						
						client.setKs(sessionInfo.ks);
						
						done();
					})
					.execute(client);
				})
				.execute(client);
				
			});
			
			it('KS valid', (done) => {
				
				kaltura.services.session.get()
				.completion((success, response) => {
					const {executionTime, result} = response;
					const session = result;
					expect(success).to.equal(true);
					expect(session).to.not.be.a('null');
					expect(session.ks).to.not.be.a('null');
					expect(session.userId).to.not.be.a('null');
					
					let ksValidator = new KsValidator({
						connectionString: connectionString
					});
				
					ksValidator.validate({
						session: {
							ks: client.getKs(),
							partnerId: partnerId,
							userId: session.userId,
							expiry: session.expiry,
							udid: session.udid,
							createDate: session.createDate,
							sessionid: appToken.token
						}
					})
					.then(() => {
						done();
						ksValidator.close();
					}, (err) => {
						done(new Error('Session exipry expect to be valid: ' + err));
						ksValidator.close();
					});
				})
				.execute(client);
				
			});

			it('App-Token deleted', (done) => {
					
				kaltura.services.session.get()
				.completion((success, response) => {
					const {executionTime, result} = response;
					const session = result;
					expect(success).to.equal(true);
					expect(session).to.not.be.a('null');
					expect(session.ks).to.not.be.a('null');
					expect(session.userId).to.not.be.a('null');
					
					kaltura.services.appToken.deleteAction(appToken.id)
					.completion((success, response) => {
						const {executionTime, result} = response;
						expect(success).to.equal(true);
						expect(result).to.equal(true);

						let ksValidator = new KsValidator({
							connectionString: connectionString
						});
					
						ksValidator.validate({
							session: {
								ks: client.getKs(),
								partnerId: partnerId,
								userId: session.userId,
								expiry: session.expiry,
								udid: session.udid,
								createDate: session.createDate,
								sessionid: appToken.token
							}
						})
						.then(() => {
							done(new Error('App-Token expected to be deleted'));
							ksValidator.close();
						}, (err) => {
							done();
							ksValidator.close();
						});
					})
					.execute(client);
				})
				.execute(client);
			});

		});
    });
});

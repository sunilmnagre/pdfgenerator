let chai      = require('chai'),
    chaiHttp  = require('chai-http'),
    should    = chai.should(),
    expect    = chai.expect,
    config    = require('config'),
    location  = require('../helpers/geo-location');

chai.use(chaiHttp);

// /*
//  * Test the /location
//  */
//  describe('Unit Test - ', function (){
//        it('it should return the location of provided IP address', function (done) {
//          location.getNameByIP(1, '192.168.1.1').then(function (result){
//              var input = 'India';
//              var output = (result === null ? null : result.location);
//              expect(input).to.be.equal(output);
//              done();
//          })
//        });
//});

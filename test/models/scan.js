var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();
var expect = chai.expect;
var scanModel = require('../../models/scan');
var _ = require('lodash');
var moment = require('moment');

chai.use(chaiHttp);

/**
 * Tests to make sure the "overlap" function for schedules works
 * 
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 */
describe('Testing overlapping schedule function', function () {
    var overlappingTestCases = {
        '2017-03-27T13:00:00.000Z': '2017-03-27T13:00:00.000Z', // Same time
        '2017-03-27T13:29:00.000Z': '2017-03-27T13:00:00.000Z', // 29 minutes difference
        '2017-03-27T12:31:00.000Z': '2017-03-27T13:00:00.000Z', // 29 minutes difference
        '2017-03-27T12:30:00.000Z': '2017-03-27T13:00:00.000Z', // 30 minutes difference
        '2017-03-27T13:30:00.000Z': '2017-03-27T13:00:00.000Z', // 30 minutes difference
        '2017-02-27T13:30:00.000Z': '2017-03-27T13:00:00.000Z', // 1 month, 30 minutes difference
        '2017-01-27T13:30:00.000Z': '2017-03-27T13:00:00.000Z', // 1 month, 30 minutes difference
        '2017-04-27T13:30:00.000Z': '2017-03-27T13:00:00.000Z', // 1 month, 30 minutes difference
        '2017-02-27T13:29:00.000Z': '2017-03-27T13:00:00.000Z', // 1 month, 29 minutes difference
        '2017-02-27T12:31:00.000Z': '2017-03-27T13:00:00.000Z' // 1 month, 29 minutes difference
    };

    var notOverlappingTestCases = {
        '2017-03-27T13:31:00.000Z': '2017-03-27T13:00:00.000Z', // 31 minutes difference
        '2017-03-27T12:29:00.000Z': '2017-03-27T13:00:00.000Z', // 31 minutes difference
        '2017-02-27T12:29:00.000Z': '2017-03-27T13:00:00.000Z', // 1 month, 31 minutes difference
        '2017-04-27T12:29:00.000Z': '2017-03-27T13:00:00.000Z' // 1 month, 31 minutes difference
    };

    // Test the true cases
    _.each(overlappingTestCases, function (time1, time2) {
        it('it should consider ' + time1 + ' and ' + time2 + ' to overlap', function (done) {
            result = scanModel.doSchedulesOverlap(time1, time2, 30);
            expect(result).to.be.equal(true);
            done();
        });
    });

    // Test the false cases
    _.each(notOverlappingTestCases, function (time1, time2) {
        it('it should consider ' + time1 + ' and ' + time2 + ' to not overlap', function (done) {
            result = scanModel.doSchedulesOverlap(time1, time2, 30);
            expect(result).to.be.equal(false);
            done();
        });
    });
});


describe('Testing overlapping targets function', function () {

    var overlappingTestCases = [
        {
            'targetGroup1': ['1.1.1.1'],
            'targetGroup2': ['1.1.1.1']
        },
        {
            'targetGroup1': ['192.168.1.1'],
            'targetGroup2': ['192.168.1.1']
        },
        {
            'targetGroup1': ['192.168.1.1 '],
            'targetGroup2': ['192.168.1.1']
        },
        {
            'targetGroup1': ['192.168.1.1 '],
            'targetGroup2': ['192.168.1.1 ']
        },
        {
            'targetGroup1': ['1.1.1.1', '2.2.2.2'],
            'targetGroup2': ['1.1.1.1']
        },
        {
            'targetGroup1': ['1.1.1.1', '2.2.2.2'],
            'targetGroup2': ['2.2.2.2']
        }
    ];

    var notOverlappingTestCases = [
        {
            'targetGroup1': ['1.1.1.1'],
            'targetGroup2': ['1.1.1.2']
        },
        {
            'targetGroup1': ['192.168.1.1'],
            'targetGroup2': ['192.168.1.2']
        },
        {
            'targetGroup1': ['192.168.1.1 '],
            'targetGroup2': ['192.168.1.2']
        },
        {
            'targetGroup1': ['192.168.1.1 '],
            'targetGroup2': ['192.168.1.2 ']
        },
        {
            'targetGroup1': ['1.1.1.1', '2.2.2.2'],
            'targetGroup2': ['1.1.1.2']
        },
        {
            'targetGroup1': ['1.1.1.1', '2.2.2.2'],
            'targetGroup2': ['2.2.2.1']
        }
    ];

    // Test the true cases
    _.each(overlappingTestCases, function (testCase) {

        it('it should consider these two target objects to overlap', function (done) {
            result = scanModel.doTargetsOverlap(testCase['targetGroup1'], testCase['targetGroup2']);
            expect(result).to.be.equal(true);
            done();
        });
    });

    // Test the true cases
    _.each(notOverlappingTestCases, function (testCase) {

        it('it should consider these two target objects to not overlap', function (done) {
            result = scanModel.doTargetsOverlap(testCase['targetGroup1'], testCase['targetGroup2']);
            expect(result).to.be.equal(false);
            done();
        });
    });
});

describe('Test doesScheduleOverlap function to see if a single schedule overlaps a list of schedules', function () {

    var overlappingTestCases = {
        '2017-05-31T15:00:00.000Z': ['2017-05-31T15:00:00.000Z', '2017-05-31T14:00:00.000Z', '2017-05-31T13:00:00.000Z'],
        '2017-05-31T15:30:00.000Z': ['2017-05-31T15:00:00.000Z', '2017-05-31T14:00:00.000Z', '2017-05-31T13:00:00.000Z'],
        '2017-05-31T12:30:00.000Z': ['2017-05-31T15:00:00.000Z', '2017-05-31T14:00:00.000Z', '2017-05-31T13:00:00.000Z']
    };

    var notOverlappingTestCases = {
        '2017-05-31T15:31:00.000Z': ['2017-05-31T15:00:00.000Z', '2017-05-31T14:00:00.000Z', '2017-05-31T13:00:00.000Z'],
        '2017-05-31T12:29:00.000Z': ['2017-05-31T15:00:00.000Z', '2017-05-31T14:00:00.000Z', '2017-05-31T13:00:00.000Z'],
        '2017-05-30T12:30:00.000Z': ['2017-05-31T15:00:00.000Z', '2017-05-31T14:00:00.000Z', '2017-05-31T13:00:00.000Z']
    };

    // Test the true cases
    _.each(overlappingTestCases, function (existingTimes, proposedTime) {

        it('it should consider these two times objects to overlap', function (done) {
            result = scanModel.doesScheduleOverlap(existingTimes, proposedTime, 30);
            expect(result).to.be.equal(true);
            done();
        });
    });

    _.each(notOverlappingTestCases, function (existingTimes, proposedTime) {

        it('it should consider these two times objects to not overlap', function (done) {
            result = scanModel.doesScheduleOverlap(existingTimes, proposedTime, 30);
            expect(result).to.be.equal(false);
            done();
        });
    });
});

describe('Test isScanRunning function to see if a scan is currently running or not', function () {

    var trueTestCases = [
        {
            scans: [{'status': scanModel.constants.STATUS_RUNNING, 'id': 5}],
            scanId: 5
        },
        {
            scans: [{'status': scanModel.constants.STATUS_RUNNING, 'id': 9}, {'status': scanModel.constants.STATUS_RUNNING, 'id': 5}],
            scanId: 5
        }
    ];

    var notOverlappingTestCases = [
        {
            scans: [{'status': scanModel.constants.STATUS_CANCELLED, 'id': 5}],
            scanId: 5
        },
        {
            scans: [{'status': scanModel.constants.STATUS_COMPLETED, 'id': 5}],
            scanId: 5
        },
        {
            scans: [{'status': scanModel.constants.STATUS_RUNNING, 'id': 2}, {'status': scanModel.constants.STATUS_RUNNING, 'id': 9}],
            scanId: 5
        }
    ];

    // Test the true cases
    _.each(trueTestCases, function (testCase) {

        it('it should think this scan is running', function (done) {
            result = scanModel.isScanRunning(testCase.scans, testCase.scanId);
            expect(result).to.be.equal(true);
            done();
        });
    });

    _.each(notOverlappingTestCases, function (testCase) {

        it('it should think this scan is not running', function (done) {
            result = scanModel.isScanRunning(testCase.scans, testCase.scanId);
            expect(result).to.be.equal(false);
            done();
        });
    });
});

describe('Test scanCanEdit function works', function () {

    var falseTestCases = [moment().add(28, 'minutes'), moment().subtract(28, 'minutes')];
    var trueTestCases = [moment().add(32, 'minutes'), moment().subtract(32, 'minutes')];
    
    // Test the true cases
    _.each(trueTestCases, function (testCase) {

        it('This scan is far enough away from runtime to be edited', function (done) {
            result = scanModel.canEditScan(testCase);
            expect(result).to.be.equal(true);
            done();
        });
    });

    _.each(falseTestCases, function (testCase) {

        it('This scan is too close to runtime to be edited', function (done) {
            result = scanModel.canEditScan(testCase);
            expect(result).to.be.equal(false);
            done();
        });
    });
});
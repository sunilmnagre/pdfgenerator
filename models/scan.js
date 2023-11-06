const config = require('config');
const mongo = require('../helpers/mongo');
const moment = require('moment');
const _ = require('lodash');
const mongoObjectId = require('mongodb').ObjectID;
const tenableHelper = require('../helpers/tenable');
const constantErrors = require('../helpers/constant-errors');
const BSRIdentifier = config.globals.tenable.Repository.BSR_Identifier;
const [BSR_Prefix, BSR_Suffix] = [`${BSRIdentifier}_`, `_${BSRIdentifier}`];

/**
 * Creates Scan Model for Business Logic.
 */
var scan = function () {


    // Array of fields to map to the API
    this.mapApi = {
        '_id': 'id',
        'name': 'name',
        'type': 'scan_type',
        'tenable_scan_id': 'tenable_scan_id',
        'timezone': 'timezone',
        'repeat_rules': 'repeat_rules',
        'starttime': 'start_time',
        'status': 'status',
        'enabled': 'enabled',
        'schedule': 'schedule',
        'targets': 'targets',
        'scanner_name': 'scanner_name',
        "scan_start": "scan_start",
        "scan_end": "scan_end",
        "scan_domain": "scan_domain",
        'scanner': 'scanner',
        'folder_name': 'folder_name',
        'reports': 'reports',
        'is_tenable_deleted': 'is_tenable_deleted',
        'policy_id': 'policy_id',
        'scanzone_id': 'scanzone_id',
        'repository_id': 'repository_id',
        'credentials': 'credentials',
        'locked': function (notUsed, object) {
            if (('schedule' in object) && (object.schedule !== null)) {
                if ('start_time_utc' in object.schedule) {
                    return { 'locked': !canEditScan(object.schedule.start_time_utc) };
                }
            }

            return { 'locked': false };
        }
    };

    // Fields that can be updated through API
    this.writableFields = [
        'name',
        'scanner_name',
        'schedule',
        'targets',
        'scan_type',
        'scanner',
        'location_id',
        'scan_domain'
    ];
    return this;
}

/**
 * Checks if any targets in the two groups overlap
 *
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {Object} targetGroup1 - Group of targets
 * @param {Object} targetGroup2 - Group of targets
 * @return {Boolean} - True if any of the target groups overlap
 */
function doTargetsOverlap(targetGroup1, targetGroup2) {
    var targetsOverlap = false;

    _.each(targetGroup1, function (target) {
        _.each(targetGroup2, function (target2) {
            if ((target) && (target2) && (target.trim() === target2.trim())) {
                targetsOverlap = true;
                return;
            }
        });

        // Break out of the outside loop if a target is found
        if (targetsOverlap) {
            return;
        }
    });

    return targetsOverlap;
};

/**
 * Checks if the given schedules overlap each other in any way, and therefore
 *  can't be added
 *
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {Object} utcTime1 - The first schedule to check, in our own format
 * @param {Object} utcTime2 - The second schedule to check, in our own format
 * @param {Number} bufferInMinutes - Buffer either side of the run time to block
 *  out (for safety). Defaults to the default buffer time in the config file
 * @return {Boolean} - True if the schedules overlap
 */
const doSchedulesOverlap = (utcTime1, utcTime2, bufferInMinutes = config.tenable_scans.schedule_buffer_minutes) => {
    // Convert this time to upper and lower values
    let utcTime1MomentUpper = moment(utcTime1).add(bufferInMinutes, 'minutes');
    let utcTime1MomentLower = moment(utcTime1).subtract(bufferInMinutes, 'minutes');
    let scheduleTime = moment(utcTime2).format('YYYY-MM-DD HH:mm');
    utcTime1MomentUpper = moment(utcTime1MomentUpper).format('YYYY-MM-DD HH:mm');
    utcTime1MomentLower = moment(utcTime1MomentLower).format('YYYY-MM-DD HH:mm');

    if (moment(scheduleTime).isBetween(utcTime1MomentLower, utcTime1MomentUpper)) {
        console.log("scheduleTime", scheduleTime);
        console.log("utcTime1MomentLower", utcTime1MomentLower);
        console.log("utcTime1MomentUpper", utcTime1MomentUpper);
        console.log("Schedule Time overlapped");
        return true;
    }
    return false;
}

/**
 * Gets the schedules set up for this scanner
 *
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {Number} scans - List of scans from Nessus
 * @return {Object} - Scanner schedules set up for this scanner
 */
const getScheduleTimesFromTenable = (scans, currentScanId) => {
    var scanIdAndTimesAsUtcs = [];

    _.each(scans, function (scan) {
        // See if there are any RRules, and parse them if so
        if (scan.schedule && currentScanId != scan.id) {
            let startTime = scan.schedule.start.split(":")[1];
            if (startTime && startTime.length > 13 && startTime.length < 15) {
                scan.starttime = startTime + "0";
            } else {
                scan.starttime = startTime;
            }

            // Collect scanId and their schedule-time
            scanIdAndTimesAsUtcs.push({
                scanId: scan.id,
                scheduleTime: moment(scan.starttime).toISOString()
            });
        }
    });

    return scanIdAndTimesAsUtcs;
}



/**
 * Checks if any of the given schedules overlaps with the proposed schedule
 *
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {param_type} param_name - param_description
 * @return {return_type} - return_description
 */
const doesScheduleOverlap = (existingSchedules, proposedSchedule, bufferInMinutes = config.tenable_scans.schedule_buffer_minutes) => {
    let scheduleOverlaps = {
        result: false,
        scanIds: []
    };

    // Loop through the existing schedules
    _.each(existingSchedules, function (existingSchedule) {
        if (existingSchedule) {
            if (doSchedulesOverlap(existingSchedule.scheduleTime, proposedSchedule, bufferInMinutes)) {
                scheduleOverlaps.result = true;
                scheduleOverlaps.scanIds.push(existingSchedule.scanId);
            }
        }
    });

    return scheduleOverlaps;
}

/**
 * Checks if the proposed scan overlaps with any of those scans already in Tenable
 *
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {Number} repositoryScans - The scans already set up in Tenable, fetched from the API
 * @param {Object} proposedSchedule - The schedule we're thinking of adding
 * @return {Boolean} - True if the proposed schedule overlaps any existing schedule
 */
const doesScheduleOverlapTenableSchedules = (repositoryScans, proposedSchedule, currentScan, organisationId) => {
    let currentScanId = currentScan.tenable_scan_id;

    let doesOverlap = doesScheduleOverlap(getScheduleTimesFromTenable(repositoryScans, currentScanId), proposedSchedule);

    if (doesOverlap.result) {
        return Promise.resolve(true);
    } else {
        return Promise.resolve(false);
    }
}

/**
 * Splits a given string by commas, assuming they're targets from Nessus
 *
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {String} targetString - The string of targets from Nessus to be split
 * @return {Array} - An array of targets
 */
function splitTargets(targetString) {
    if (targetString) {
        return targetString.split(',').map(function (str) {
            return str.trim();
        });
    }
};


/**
 * Checks if the given scan ID is running within the given list of Nessus scans
 *
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {Object} nessusScans - A group of Nessus scans (straight from the API)
 * @param {Number} nessusScanId - ID of the scan ID to check
 * @return {Boolean} - True if the given scan ID is currently running in the list of scans
 */
function isScanRunning(nessusScans, nessusScanId) {
    var scanIsRunning = false;

    _.each(nessusScans, function (nessusScan) {
        if ((nessusScan.id === nessusScanId) && (nessusScan.status === constants.STATUS_RUNNING)) {
            scanIsRunning = true;
            return;
        }
    });

    return scanIsRunning;
}

/**
 * Checks if the given scan is valid by checking if it overlaps any schedules or targets
 *
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {Number} organisationId - Organisation ID to check against
 * @param {String} scanId - Scan of the ID to validate
 * @return {Promise} - True if the schedule is okay to be updated
 */
const scanIsValid = (organisationId, scanId, scan, callback) => {
    // Check if we're updating the scan. If not, no need to validate
    if ((scan.schedule.start_time) && (scan.schedule.timezone)) {

        let startTime = scan.schedule.start_time;
        if (startTime.length > 13 && startTime.length < 15) {
            scan.schedule.start_time = scan.schedule.start_time + "0";
        }

        // First, grab the organisation folder ID and the current scan data
        return mongo.findOne(organisationId, config.mongo.tables.scans, { _id: mongoObjectId(scanId) }).then((currentScan) => {
            const startTimeUTC = moment(scan.schedule.start_time).toISOString();
            const scanResultQueryString = '?filter=usable,running&fields=status,running,name,createdTime,startTime,finishTime,id,repository,owner,scan';

            return tenableHelper.requestTenable(organisationId, 'scanResult' + scanResultQueryString, {}, 'GET', {}, (tenableError, scanResults) => {
                if (scanResults) {
                    let runningScans = scanResults && scanResults.response && scanResults.response.usable ? scanResults.response.usable : [];
                    let scanData = {};

                    if (runningScans && runningScans.length > 0) {
                        _.each(runningScans, (scanResult) => {
                            if (scanResult && scanResult.scan && scanResult.scan.id && currentScan && currentScan.tenable_scan_id &&
                                scanResult.scan.id.toString() === currentScan.tenable_scan_id.toString()) {
                                scanData = scanResult;
                            }
                        });
                    }

                    // Check if it overlaps any other schedules
                    // First check if the scan is currently being run. It should be
                    //  locked down if so
                    if (!(_.isEmpty(scanData))) {
                        return callback('Scan is currently running. Cannot update when in progress');
                    } else {
                        let scanQueryString = '?filter=usable&fields=schedule,name,scanner,repository';

                        return tenableHelper.requestTenable(organisationId, 'scan' + scanQueryString, {}, 'GET', {}, (tenableError, scans) => {
                            if (scans) {

                                let repositoryScans = scans && scans.response && scans.response.usable ? scans.response.usable : [];

                                return doesScheduleOverlapTenableSchedules(repositoryScans, startTimeUTC, currentScan, organisationId).then(function (overlapResult) {

                                    if (!overlapResult) {
                                        return callback(false);
                                    } else {
                                        // doesScheduleOverlapTenableSchedules function saying its overlap
                                        return callback(true);
                                    }
                                });
                            } else {
                                const errorMessage = tenableError ? (constantErrors.tenable.scansError + " due to: " + tenableError.error_msg) : constantErrors.tenable.scansError;
                                console.log(errorMessage);
                                return callback('Cannot get scan details. Please try again.');
                            }
                        });
                    }
                } else {
                    console.log(tenableError);
                    return callback('Cannot get scan details. Please try again.');
                }
            });
        }).catch((mongoError) => {
            console.log("mongoError when fething scans..", mongoError);
        });
    } else {
        return callback(true);
    }
}

/**
 * Takes our MSSP way of formatting targets and converts it to an array of targets
 *
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {Object} msspTargets - The targets using our internal MSSP object format
 * @return {Array} - An array of just the targets
 */
function convertMsspTargetsToArray(msspTargets) {
    var targets = _.map(msspTargets, function (target) {
        return target.host;
    });

    return targets;
}

/**
 * Checks we can edit this scan given the current time and when the scan should
 *  be run
 *
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {Datetime} scanDatetime - Time of the scan to check against
 * @param {Number} bufferInMinutes - Buffer either side of the run time to block
 *  out (for safety). Defaults to the default buffer time in the config file
 * @return {Boolean} - True if the schedule isn't within the 30 minute buffer
 *  time that disallows updates
 */
function canEditScan(scanDatetime, bufferInMinutes = config.tenable_scans.schedule_buffer_minutes) {
    // Convert this time to upper and lower values
    var currentTime = moment();
    var currentTimeMomentUpper = moment(currentTime).add(bufferInMinutes, 'minutes');
    var currentTimeMomentLower = moment(currentTime).subtract(bufferInMinutes, 'minutes');
    var scanDateTime = moment(scanDatetime);

    // Let's see if the second time falls between these two times
    return (scanDateTime.isSameOrBefore(currentTimeMomentLower) || scanDateTime.isSameOrAfter(currentTimeMomentUpper));
};


/**
 * Constants for the scan class
 */
var constants = Object.freeze({
    STATUS_COMPLETED: 'completed',
    STATUS_ABORTED: 'aborted',
    STATUS_IMPORTED: 'imported',
    STATUS_PENDING: 'pending',
    STATUS_RUNNING: 'running',
    STATUS_CANCELLING: 'canceling',
    STATUS_CANCELLED: 'canceled',
    STATUS_PAUSING: 'pausing',
    STATUS_RESUMING: 'resuming',
    STATUS_PAUSED: 'paused',
    STATUS_STOPPING: 'stopping',
    STATUS_STOPPED: 'stopped'
});

const getFormattedScanObjects = (scans) => {
    let formattedScans = [];

    if (scans && scans.length > 0) {
        _.each(scans, (scan) => {
            if (scan.repository && scan.repository.name.indexOf(BSR_Suffix) < 0 && scan.repository.name.indexOf(BSR_Prefix) < 0) {
                let repeatRule = scan.schedule.repeatRule.split(';')[0];
                let scanType = tenableHelper.getScanScheduleInfoFormatted(scan.schedule);
                let scanSchedule = tenableHelper.tenableToMSSPParams(scan.schedule)
                let scanObject = {
                    tenable_scan_id: parseInt(scan.id),
                    name: scan.name,
                    scan_domain: null,
                    policy_id: scan.policy.id,
                    scan_type: scanType,
                    repeat_rules: repeatRule,
                    scan_start: null,
                    scan_end: scan.modifiedTime,
                    status: scan.status,
                    enabled: scan.enabled,
                    repository_id: scan.repository.id,
                    schedule: scanSchedule,
                    credentials: scan.credentials,
                    targets: scan.ipList ? scan.ipList.replace('\r', ',') : '',
                    is_tenable_deleted: false,
                    is_fetch_vm_required: false,
                };

                if (scan && scan.zone) {
                    scanObject.scanzone_id = scan.zone.id
                }

                formattedScans.push(scanObject);
            }
        });
    }

    return formattedScans;
};

const getExistingScans = (organisationId, scanQuery, scanProjection = {}) => {
    return mongo.find(organisationId, config.mongo.tables.scans, scanQuery, scanProjection);
};

const findScan = async (organisationId, scanQuery, scanProjection = {}) => {
    return await mongo.findOne(organisationId, config.mongo.tables.scans, scanQuery, scanProjection);
};

const getLastCompletedScanTime = (organisationId) => {
    return mongo.collection(organisationId, config.mongo.tables.scans).then((scanCollection) => {
        if (scanCollection) {
            return scanCollection.aggregate([
                {
                    $match: {
                        "is_fetch_vm_required": false
                    }
                },
                {
                    $sort: {
                        "scan_end": -1
                    }
                },
                {
                    $limit: 1
                },
                {
                    $project: {
                        "scan_end": 1
                    }
                }
            ]);
        } else {
            return null;
        }
    }).catch((mongoError) => {
        return Promise.reject(mongoError);
    });
};

module.exports = {
    scan: scan,
    doesScheduleOverlapTenableSchedules: doesScheduleOverlapTenableSchedules,
    doTargetsOverlap: doTargetsOverlap,
    doSchedulesOverlap: doSchedulesOverlap,
    scanIsValid: scanIsValid,
    doesScheduleOverlap: doesScheduleOverlap,
    isScanRunning: isScanRunning,
    constants: constants,
    canEditScan: canEditScan,
    getFormattedScanObjects,
    getExistingScans,
    getLastCompletedScanTime,
    findScan
};

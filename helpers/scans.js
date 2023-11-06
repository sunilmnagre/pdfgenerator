const _ = require('lodash');
const config = require('config');
const tenableHelper = require('../helpers/tenable');

/**
* check and remove duplicate targets
* @param {String} targets Request target
* @return {Boolean} True or False 
*/
const removeDuplicateTargets = (targets) => {
    const array = targets.split(',');
    const targetsData = [];
    array.map(item => {
        const target = item.split('||');
        targetsData.push(target[0])
    })
    return _.uniq(targetsData).toString();
}


/**
* Validate scan mandatory fields
* @param {String} params Request params
* @return {Array} Error
*/
const validateMondatoryParams = (params) => {
    const erros = [];
    const attributes = ['scan_name', 'policy_id', 'repository_id', 'targets'];

    attributes.forEach(attribute => {
        if (!params.hasOwnProperty(attribute) || !params[attribute]) {
            erros.push(attribute);
        }
    });

    return erros;
}


/**
* Map MSS param for Tenable
* @param {Object} params Request params
* @return {Object} Mapped
*/
const mapTenableScanParams = (params) => {
    // Map Scan schedule object to work with old code
    let mappedSchedule = mapScanScheduleForTenable(params.schedule);

    let tenableScanParams = {
        "name": params.scan_name,
        "policy": { "id": params.policy_id },
        "type": "policy",
        "description": "",
        "repository": { "id": params.repository_id },
        "dhcpTracking": "false",
        "classifyMitigatedAge": 0,
        "schedule": mappedSchedule,
        "reports": [],
        "assets": [],
        "credentials": params.credentials,
        "emailOnLaunch": false,
        "emailOnFinish": false,
        "timeoutAction": "import",
        "scanningVirtualHosts": false,
        "rolloverType": "template",
        "ipList": params.targets,
        "maxScanTime": "3600"
    };
    if(params.scanzone_id){
        tenableScanParams.zone = { id: params.scanzone_id }
    }
 return tenableScanParams;
};

/**
* Map Scan param to store into Mongo
* @param {Object} params Request params
* @return {Object} Mapped
*/
const mapDBScanParams = (params) => {    
    let repeatRule = params.schedule.frequency != 'ad-hoc' ? 'FREQ=' + _.upperCase(params.schedule.frequency) : '';
    let scanStartTime = params.schedule && params.schedule.start_schedule_time ? params.schedule.start_schedule_time : null;
    if(scanStartTime != "" && scanStartTime != null) {
        if (scanStartTime.split('T')[1].length === 5) {
            scanStartTime += '0';
            params.schedule.start_schedule_time = scanStartTime;
        }
    }
    let dBScanParams = {
        "tenable_scan_id": parseInt(params.tenable_scan_id),
        "name": params.scan_name,
        "scan_domain": params.scan_domain,
        "policy_id": params.policy_id,
        "description": "",
        "scan_type": params.schedule.frequency,
        "repeat_rules": repeatRule,
        "scan_start": null,
        "scan_end": params.scan_end, // It will update after getting data from Tenable
        "status": params.status, // It will update after getting data from Tenable
        "enabled": null,
        "repository_id": params.repository_id,
        "schedule": params.schedule,
        "credentials": params.credentials,
        "targets": params.targets,
        "is_tenable_deleted": false,
        "is_fetch_vm_required": false
    };
    if (params.scanzone_id) {
        dBScanParams.scanzone_id = params.scanzone_id;
    }
    return dBScanParams;
};

const mapScanScheduleForTenable = (scheduleObject) => {

    // Get the schedule launch and rrules

    if (scheduleObject && scheduleObject.frequency === 'ad-hoc') {
        return { type: 'template' };
    }
    let scanSchedule = getScanScheduleParamsFormatted(scheduleObject);
    let scanStartTime = scheduleObject.start_schedule_time;

    if (scanStartTime.split('T')[1].length === 5) {
        scanStartTime += '0';
    }
    if (scheduleObject && scheduleObject.frequency === 'ad-hoc-with-schedule') {
        return {
            start: 'TZID=' + scheduleObject.timezone + ':' + scanStartTime,
            repeatRule: '',
            type: 'ical'
        };
    }

    return {
        enabled: 'true',
        start: "TZID=" + scheduleObject.timezone + ':' + scanStartTime,
        repeatRule: getRepeatRules(scheduleObject.frequency, scanSchedule.rrule, new Date(scheduleObject.start_time_utc), scheduleObject.week_day, scheduleObject.interval),
        type: "ical"
    };
}

/**
 * Format scan schedule parameters according to Nessus
 * @param {Object} schedule Scan schedule object
 * @return {Object} Formatted scan schedule object
 */
const getScanScheduleParamsFormatted = (schedule) => {
    let [frequency, formattedSchedule, duration] = '';
    _.each(config.globals.launchDuration, function (object, key) {
        duration = object.value;
        if (key === schedule.frequency) {
            frequency = (duration.split(';'))[0];
            formattedSchedule = 'FREQ=' + duration;
        }
    });

    return { launch: frequency, rrule: formattedSchedule };
}

const getRuleForMonthlyScans = (rrule, currentDay) => {
    return rrule + ';' + tenableHelper.TENABLE_MONTH_BY_PREFIX + currentDay;
};

const getRuleForWeeklyScans = (rrule, currentDay, week_day) => {
    let weekDay = tenableHelper.TENABLE_DAY_BY_PREFIX;
    weekDay += week_day ? week_day : tenableHelper.TENABLE_WEEK_DAYS[currentDay];
    return rrule + ';' + weekDay;
};

const getRepeatRules = (frequency, rrule, dayObject = new Date(), week_day, interval) => {
    let rruleObject = rrule;
    switch (frequency) {
        case tenableHelper.LAUNCH_DURATION_DAILY:
            rruleObject = rrule;
            rruleObject += ';'
            rruleObject += parseInt(interval) > 0 ? 'INTERVAL=' + parseInt(interval) : tenableHelper.LAUNCH_FREQUENCY_INTERVAL_ONE;
            break;
        case tenableHelper.LAUNCH_DURATION_MONTHLY:
        case tenableHelper.LAUNCH_DURATION_QUARTERLY:
        case tenableHelper.LAUNCH_DURATION_SEMI_ANNUAL:
            rruleObject = getRuleForMonthlyScans(rrule, dayObject.getDate());
            break;
        case tenableHelper.LAUNCH_DURATION_ANNUAL:
            rruleObject = getRuleForMonthlyScans(tenableHelper.LAUNCH_FREQUENCY_ANNUAL, dayObject.getDate());
            break;
        case tenableHelper.LAUNCH_DURATION_WEEKLY:
            rruleObject = rrule;
            rruleObject += ';';
            rruleObject += parseInt(interval) > 0 ? 'INTERVAL=' + parseInt(interval) : tenableHelper.LAUNCH_FREQUENCY_INTERVAL_ONE;
            rruleObject = getRuleForWeeklyScans(rruleObject, dayObject.getDay(), week_day);
            break;
        case tenableHelper.LAUNCH_DURATION_ONETIME:
            rruleObject = '';
            break;
    }
    return rruleObject;
};

const getScanResultQuery = () => {
    return "scanResult?filter=usable&fields=canUse,canManage,owner,groups,ownerGroup,status,name,details,diagnosticAvailable,importStatus,createdTime,startTime,finishTime,importStart,importFinish,running,totalIPs,scannedIPs,completedIPs,completedChecks,totalChecks,dataFormat,downloadAvailable,downloadFormat,repository,resultType,resultSource,scanDuration";
};

/**
* Validate scan mandatory fields
* @param {String} params Request params
* @return {Array} Error
*/
const validateDiagnoseMondatoryParams = (params) => {
    const errors = [];
    const attributes = ['diagnosticTarget', 'diagnosticPassword'];

    attributes.forEach(attribute => {
        if (!params.hasOwnProperty(attribute) || !params[attribute]) {
            errors.push(attribute);
        }
    });

    return errors;
}

module.exports = {
    removeDuplicateTargets,
    validateMondatoryParams,
    mapTenableScanParams,
    mapDBScanParams,
    getRepeatRules,
    getScanResultQuery,
    validateDiagnoseMondatoryParams
};
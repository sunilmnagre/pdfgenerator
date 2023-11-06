var _ = require('underscore');
var moment = require('moment');
var vulnerabilityModel = require('../models/vulnerability').vulnerability();
var vulnerabilityModelFile = require('../models/vulnerability');
var hasProperty = require('./general').hasProperty;

/**
 * get SLA Date for given severity type
 * @param {String} reportUtcTime - Time vulnerability was reported
 * @param {String} noOfDays - SLA for given severity type
 * @return {Object} SLA date
 */
function getSLADateForSeverity(reportUtcTime, noOfDays) {
  return moment(reportUtcTime).add(noOfDays, 'days');
}

/**
 * check if SLA is breached for particular vulnerability
 * @param {Object} currentVulnerability - vulnerability object to check for breach
 * @return {Boolean} returns true if SLA is breached, false otherwise
 */
function isSlaBreachedForVulnerability(currentVulnerability) {
  if (!Object.prototype.hasOwnProperty.call(currentVulnerability, 'false_positive')
     && !Object.prototype.hasOwnProperty.call(currentVulnerability, 'security_exception')
     && !(Object.prototype.hasOwnProperty.call(currentVulnerability, 'proposed_close_date')
     && (currentVulnerability.proposed_close_date.confirmed_closed === 1))) {
    if (currentVulnerability.history && currentVulnerability.history > 0) {
      return (_.some(currentVulnerability.history, { status: 'proposed' })
         || _.some(currentVulnerability.history, { status: 'pending' }));
    }

    return true;
  }
  return false;
}

/**
 * Filter vulnerabilities that breach SLA for given SLA rules
 * @param {Object} slasForVulnerabilties - SLA for each type of severity
 * @param {Object} vulnerabilities - vulnerabilities to check
 * @param {String} reportUtcTime - report time for vulnerabilities
 * @return {Array} list of vulnerabilities breaching SLA
 */
function getBreachedVulnerabilitiesFromList(slasForVulnerabilties, vulnerabilities, reportUtcTime) {
  var slaBreachedVulnerabilities = [];
  var currentDate = moment();
  var severityName;
  var severitiesByName = _.invert(vulnerabilityModel.severities);

  // get SLA Date for Critical vulnerabilities
  var slaDateForCritical = getSLADateForSeverity(reportUtcTime, slasForVulnerabilties.critical);
  const severityNumberCritical = parseInt(severitiesByName.Critical, 10);

  // get SLA Date for High vulnerabilities
  var slaDateForHigh = getSLADateForSeverity(reportUtcTime, slasForVulnerabilties.high);
  const severityNumberHigh = parseInt(severitiesByName.High, 10);

  // get SLA Date for Medium vulnerabilities
  var slaDateForMedium = getSLADateForSeverity(reportUtcTime, slasForVulnerabilties.medium);
  const severityNumberMedium = parseInt(severitiesByName.Medium, 10);

  // get SLA Date for Low vulnerabilities
  var slaDateForLow = getSLADateForSeverity(reportUtcTime, slasForVulnerabilties.low);
  const severityNumberLow = parseInt(severitiesByName.Low, 10);

  // Check if dates for SLA date has passed
  var isSLADatePassedForCritical = slaDateForCritical.isBefore(currentDate);
  var isSLADatePassedForHigh = slaDateForHigh.isBefore(currentDate);
  var isSLADatePassedForMedium = slaDateForMedium.isBefore(currentDate);
  var isSLADatePassedForLow = slaDateForLow.isBefore(currentDate);
  var slaObject;

  if (isSLADatePassedForCritical || isSLADatePassedForHigh || isSLADatePassedForMedium
    || isSLADatePassedForLow) {
    _.each(vulnerabilities, function (currentVulnerability) {
      const vulnerabilitySeverity = currentVulnerability.severity;

      if ((vulnerabilitySeverity === severityNumberLow && isSLADatePassedForLow)
          || (vulnerabilitySeverity === severityNumberMedium && isSLADatePassedForMedium)
          || (vulnerabilitySeverity === severityNumberHigh && isSLADatePassedForHigh)
          || (vulnerabilitySeverity === severityNumberCritical && isSLADatePassedForCritical)) {
        if (isSlaBreachedForVulnerability(currentVulnerability)) {
          // construct sla object with days & expiry date
          slaObject = {};
          severityName = vulnerabilityModel.severities[vulnerabilitySeverity];
          slaObject.days = slasForVulnerabilties[severityName.toLowerCase()];

          let slaExpiryDate = slaObject.expiry_date;

          if (vulnerabilitySeverity === severityNumberCritical) {
            slaExpiryDate = slaDateForCritical;
          } else if (vulnerabilitySeverity === severityNumberHigh) {
            slaExpiryDate = slaDateForHigh;
          } else if (vulnerabilitySeverity === severityNumberMedium) {
            slaExpiryDate = slaDateForMedium;
          } else if (vulnerabilitySeverity === severityNumberLow) {
            slaExpiryDate = slaDateForLow;
          }

          slaObject.expiry_date = slaExpiryDate;

          currentVulnerability.sla = slaObject;
          slaBreachedVulnerabilities.push(currentVulnerability);
        }
      }
    });
  }

  return slaBreachedVulnerabilities;
}

/**
 * Filter vulnerabilities that breach SLA for given SLA rules for given report
 * @param {Object} slasForVulnerabilties - SLA for each type of severity
 * @param {Object} reportWithVulnerabilities - report object containing vulnerabilities
 * @return {Object} report object containing vulnerabilities with SLA breached
 */
function removeVulnerabilitiesWithinSlaInReport(slasForVulnerabilties
  , reportWithVulnerabilities) {
  var responseObject = {};
  var slaBreachedVulnerabilities = [];

  responseObject = {
    report_id: reportWithVulnerabilities._id,
    report_name: reportWithVulnerabilities.report_name,
    utc_time_created: reportWithVulnerabilities.utc_time,
  };

  slaBreachedVulnerabilities = getBreachedVulnerabilitiesFromList(slasForVulnerabilties
    , reportWithVulnerabilities.vulnerabilities, reportWithVulnerabilities.utc_time);
  responseObject.vulnerabilities = slaBreachedVulnerabilities;
  return responseObject;
}

/**
 * Checks if vulnerability was closed within SLA
 * @param {Object} vulnerabilityObject - vulnerability to check SLA
 * @param {Integer} slaDays - no. of days for SLA
 * @param {Object} reportUtcTime - time when vulnerability was reported
 * @return {Boolean} true if vulnerability was closed inside SLA false otherwise
 */
function wasVulnerabilityClosedWithinSLA(vulnerabilityObject, slaDays, reportUtcTime) {
  let updatedAt;
  let indexOfHistoryObject = -1;
  let wasClosedWithinSLA = false;

  // get SLA Date for vulnerability
  var slaExpiryDate = getSLADateForSeverity(reportUtcTime, slaDays);

  // check for the FP or PCD
  if (hasProperty(vulnerabilityObject, 'false_positive')) {
    // find the index of history item containing false_positive as approved
    indexOfHistoryObject = _.findIndex(vulnerabilityObject.history, { status: 'approved',
      action: 'false_positive' });
  } else if (hasProperty(vulnerabilityObject, 'proposed_close_date')) {
    // find the index of history item containing proposed_close_date as approved
    indexOfHistoryObject = _.findIndex(vulnerabilityObject.history, { status: 'approved',
      action: 'proposed_close_date' });
  }

  if (indexOfHistoryObject !== -1) {
    updatedAt = vulnerabilityObject.history[indexOfHistoryObject].updated_at;
    // check whether vulnerability was closed inside SLA Date or not
    wasClosedWithinSLA = moment(updatedAt).isBefore(slaExpiryDate);
  }

  return wasClosedWithinSLA;
}

/**
 * Checks if the given vulnerability is closed and outside the SLA
 * @param {Object} vulnerabilityObject The vulnerability object to check
 * @param {Number} slaDays The number of days that is allowed for the SLA
 * @param {String} reportUtcTime The datetime for the given report
 * @returns {Boolean} 
 */
function wasVulnerabilityClosedOutsideSla(vulnerabilityObject, slaDays, reportUtcTime) {
  let updatedAt;
  let indexOfHistoryObject = -1;
  let wasClosedOutsideSLA = false;

  // get SLA Date for vulnerability
  var slaExpiryDate = getSLADateForSeverity(reportUtcTime, slaDays);

  // check for the FP or PCD
  if (hasProperty(vulnerabilityObject, 'false_positive')) {
    // find the index of history item containing false_positive as approved
    indexOfHistoryObject = _.findIndex(vulnerabilityObject.history, { status: 'approved',
      action: 'false_positive' });
  } else if (hasProperty(vulnerabilityObject, 'proposed_close_date')) {
    // find the index of history item containing proposed_close_date as approved
    indexOfHistoryObject = _.findIndex(vulnerabilityObject.history, { status: 'approved',
      action: 'proposed_close_date' });
  }

  if (indexOfHistoryObject !== -1) {
    updatedAt = vulnerabilityObject.history[indexOfHistoryObject].updated_at;
    // check whether vulnerability was closed inside SLA Date or not
    wasClosedOutsideSLA = moment(updatedAt).isAfter(slaExpiryDate);
  }

  return wasClosedOutsideSLA;
}

/**
 * Checks if the given vulnerability is still open but outside SLA
 * @param {Object} vulnerabilityObject The vulnerability object to check
 * @param {Number} slaDays The number of days that is allowed for the SLA
 * @param {String} reportUtcTime The datetime for the given report
 * @returns {Boolean}
 */
function isVulnerabilityOpenAndOutsideSla(vulnerabilityObject, slaDays, reportUtcTime) {
  const vulnerabilityClosed = vulnerabilityModelFile.isClosed(vulnerabilityObject);
  const slaExpiryDate = getSLADateForSeverity(reportUtcTime, slaDays);
  const hasSlaDatePassed = moment().isAfter(slaExpiryDate);
  return vulnerabilityClosed === false && hasSlaDatePassed === true;
}

/**
 * Takes a vulnerability and adds in the SLA information for it
 * @param {Object} vulnerabilityObject The vulnerability object to check
 * @param {Number} slaDays The number of days that is allowed for the SLA
 * @param {String} reportUtcTime The datetime for the given report
 * @returns {Object} The updated vulnerability
 */
function appendSlaInformationToVulnerability(vulnerabilityObject, slaDays, reportUtcTime) {
  const slaExpiryDate = getSLADateForSeverity(reportUtcTime, slaDays);

  vulnerabilityObject.sla = {
    days: slaDays,
    expiry_date: slaExpiryDate,
  };

  return vulnerabilityObject;
}

module.exports = {
  getBreachedVulnerabilitiesFromList,
  isSlaBreachedForVulnerability,
  getSLADateForSeverity,
  removeVulnerabilitiesWithinSlaInReport,
  wasVulnerabilityClosedWithinSLA,
  wasVulnerabilityClosedOutsideSla,
  isVulnerabilityOpenAndOutsideSla,
  appendSlaInformationToVulnerability,
};

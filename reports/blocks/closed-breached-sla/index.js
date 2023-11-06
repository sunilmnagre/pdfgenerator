const vulnerabilityModel = require('../../../models/vulnerability');
const handlebars = require('handlebars');
const reportConfigurableHelper = require('../../../helpers/report-configurable');
const slaHelper = require('../../../helpers/sla');
var orgServicesModel = require('../../../models/org-service');
const _ = require('lodash');
const hasProperty = require('../../../helpers/general').hasProperty;
var moment = require('moment');

const partialName = 'closed-breached-sla';


/**
 * Amends the SLA priority totals, adding reports and report counts so we can display which ones
 *  contribute to the vulnerability reports
 * @param {Object} slaTotals This is the main SLA totals object that contains all the necessary
 *  info to send back to the view
 * @param {Number} priority The priority/severity number for the vulnerability
 * @param {String} slaType The type of SLA we're amending: `openBreached`, `closedBreached` 
 *  and `closedNotBreached`
 * @param {String} reportId The report ID we're adding
 * @param {String} reportName The name of the report we're adding
 * @returns {Object} slaTotals, updated with the report information
 */
function incrementPrioritySlaReportCount(slaTotals, priority, slaType, reportId, reportName) {
  // Check if there are reports set up for this severity
  if (!hasProperty(slaTotals[priority], slaType)) {
    slaTotals[priority][slaType] = {};
  }

  // Check if the report exists already
  if (!hasProperty(slaTotals[priority][slaType], reportId)) {
    slaTotals[priority][slaType][reportId] =
                        { count: 0,
                          name: reportName
                        };
  }

  slaTotals[priority][slaType][reportId].count += 1;

  return slaTotals;
}

/**
 * Prepare data before populating into PDF report
 * @param {Object} data - The data to prepare
 * @return {Object} Prepared data
 */
const prepare = (reportsAndSlas, organisationId) => {
  const finalVulnerabilities = {};
  const responseObject = {};
  const vulnerabilityNotes = reportsAndSlas.vulnerabilityNotes;
  let noOfClosedAndBreachedVulerabilities = 0;
  let noOfClosedAndNonBreachedVulerabilities = 0;
  let noOfOpenAndBreachedVulerabilities = 0;
  let totalCount = 0;
  const slaTotals = {};

  // Loop through the severities and create an object we can use to collect the counts
  _.each(vulnerabilityModel.vulnerability().severities, function (name, severityNumber) {
    slaTotals[severityNumber] = {
      severityName: name,
      openBreached: 0,
      closedBreached: 0,
      closedNotBreached: 0
    };
  });

  _.each(reportsAndSlas.reports, (report) => {
    let reportUtcTime = {};
    totalCount += report.vulnerabilities.length;
    reportUtcTime = report.utc_time;
    const reportId = report._id;
    const reportName = report.report_name;

    // Loop through each report and parse the vulnerabilities
    _.each(report.vulnerabilities, function (vulnerability) {
      if (vulnerability.severity === 0) {
        return;
      }

      const vulnerabilityId = vulnerability._id;
      const vulnerabilitySeverity = vulnerability.severity;
      // get name of severity for curernt vulnerability
      const severityByName = vulnerabilityModel.vulnerability().severities[vulnerabilitySeverity];
      // get name of days for SLA for current vulnerability
      const noOfDays = severityByName ? reportsAndSlas.slasForVulnerabilties[severityByName.toLowerCase()] : 0;
      const slaExpiryDate = slaHelper.getSLADateForSeverity(reportUtcTime, noOfDays);

      // Check if the vulnerability is already listed
      if (hasProperty(finalVulnerabilities, vulnerabilityId)) {
        // Check to see which of the report SLAs is the shortest and use that
        if (finalVulnerabilities[vulnerabilityId].sla_expiry_date > slaExpiryDate) {
          finalVulnerabilities[vulnerabilityId].sla_expiry_date = slaExpiryDate;
        }
      } else {
        vulnerability.sla_expiry_date = slaExpiryDate;
        vulnerability.reports = {};

        vulnerability.severityName = vulnerabilityModel.vulnerability()
          .severities[vulnerability.severity];

        // Check if there's a note for this vulnerability
        _.each(vulnerabilityNotes, function (vulnerabilityNote, vulnerabilityNoteId) {
          if (vulnerabilityId.toString() === vulnerabilityNoteId.toString()) {
            vulnerability.note = vulnerabilityNote;
          }
        });

        // Check if vulnerability is closed
        const vulnerabilityClosed = vulnerabilityModel.isClosed(vulnerability);
        const vulnerabilityClosedWithinSla =
                slaHelper.wasVulnerabilityClosedWithinSLA(vulnerability, noOfDays, reportUtcTime);
        const slaBreached =
                slaHelper.getSLADateForSeverity(reportUtcTime, noOfDays).isBefore(moment());

        vulnerability.closed = vulnerabilityClosed;
        vulnerability.closedWithinSla = vulnerabilityClosedWithinSla;
        vulnerability.slaBreached = slaBreached;

        if (slaTotals[vulnerabilitySeverity]) {
          if (slaBreached) {
            if (vulnerabilityClosed) {
              slaTotals[vulnerabilitySeverity].closedBreached += 1;
              noOfClosedAndBreachedVulerabilities += 1;
              incrementPrioritySlaReportCount(slaTotals, vulnerabilitySeverity, 'closedBreachedReports', reportId, reportName);
            } else {
              slaTotals[vulnerabilitySeverity].openBreached += 1;
              noOfOpenAndBreachedVulerabilities += 1;
              incrementPrioritySlaReportCount(slaTotals, vulnerabilitySeverity, 'openBreachedReports', reportId, reportName);
            }

            finalVulnerabilities[vulnerabilityId] = vulnerability;
          } else if (vulnerabilityClosed) {
            slaTotals[vulnerabilitySeverity].closedNotBreached += 1;
            noOfClosedAndNonBreachedVulerabilities += 1;

            incrementPrioritySlaReportCount(slaTotals, vulnerabilitySeverity, 'closedNotBreachedReports', reportId, reportName);
          }
        }
      }
      if (finalVulnerabilities[vulnerabilityId]) {
        finalVulnerabilities[vulnerabilityId].reports[report._id] = report.report_name;
      }
    });
  });

  responseObject.closed_after_sla = noOfClosedAndBreachedVulerabilities;
  responseObject.closed_before_sla = noOfClosedAndNonBreachedVulerabilities;
  responseObject.open_after_sla = noOfOpenAndBreachedVulerabilities;

  if (totalCount > 0) {
    responseObject.closed_after_sla_percentage = Math.round((100 / totalCount) *
            noOfClosedAndBreachedVulerabilities);
    responseObject.closed_before_sla_percentage = Math.round((100 / totalCount) *
            noOfClosedAndNonBreachedVulerabilities);
    responseObject.open_after_sla_percentage = Math.round((100 / totalCount) *
            noOfOpenAndBreachedVulerabilities);
  }

  responseObject.total_vulnerabilities = totalCount;
  responseObject.slaTotals = slaTotals;
  responseObject.organisationId = organisationId;

  if (Object.keys(finalVulnerabilities).length > 0) {
    responseObject.vulnerabilities = finalVulnerabilities;
  }

  return responseObject;
};

/**
 * Build the Vulnerabilities table block
 * @param {Number} organisationId - Organisation Id
 * @param {Array} reportIds - Array of report Ids to generate the block for
 * @return {Object} Vulnerabilities
 */
const build = (organisationId, reportIds, additionalParameters) => {
  handlebars.registerPartial(partialName,
    reportConfigurableHelper.fsReadBlockTemplate(partialName));
  return vulnerabilityModel
    .getVulnerabiltiesByReports(organisationId, reportIds)
    .then(function (cursor) {
      return cursor.toArray().then(function (result) {
        result = vulnerabilityModel.formatReportFields(result);
        
        return orgServicesModel.getOrgSlasForVulnerabilities(organisationId)
          .then((slasForVulnerabilties) => {
            const reports = result;
            const reportsAndSlas = { slasForVulnerabilties: slasForVulnerabilties.data,
              reports,
              vulnerabilityNotes: additionalParameters.vulnerabilityNotes };
            return prepare(reportsAndSlas, organisationId);
          });
      });
    });
};

module.exports.build = build;
module.exports.partialName = partialName;

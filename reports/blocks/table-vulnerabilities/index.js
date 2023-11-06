const vulnerabilityModel = require('../../../models/vulnerability');
const handlebars = require('handlebars');
const reportConfigurableHelper = require('../../../helpers/report-configurable');
const dbSortingHelper = require('../../../helpers/db/sorting');
const _ = require('lodash');
const hasProperty = require('../../../helpers/general').hasProperty;

const partialName = 'table-vulnerabilities';

const FP = "FP";
const SE = "SE";
const PCD = "PCD";
const APPROVED ="approved";

/**
 * Prepare data before populating into PDF report
 * @param {Object} reports - The data to prepare
 * @param {Number} organisationId - The organisationId
 * @return {Object} Prepared data
 */
const prepare = (reports, organisationId) => {
  const severities = vulnerabilityModel.vulnerability().severities;
  let sorted;
  const combinedVulnerabilities = {};

  _.each(reports, (preparingData) => {
    sorted = dbSortingHelper.sortArrayElements(preparingData.vulnerabilities, '-severity');
    preparingData.vulnerabilities = sorted;

    _.each(sorted, (vulnerability) => {
      vulnerability.severity = _.lowerCase(severities[vulnerability.severity]);
    });
  });

  // Combine the vulnerabilities
  _.each(reports, (report) => {
    _.each(report.vulnerabilities, function (vulnerability) {

      if (vulnerability.security_exception) {
        vulnerability.action_status = vulnerability.security_exception.status === APPROVED ? SE : SE + "-" + vulnerability.security_exception.status;
        vulnerability.action_status_flag = SE.toLowerCase();
      } else if (vulnerability.false_positive) {
        vulnerability.action_status_flag = FP.toLowerCase();
        vulnerability.action_status = vulnerability.false_positive.status === APPROVED ? FP : FP + "-" + vulnerability.false_positive.status
      } else if (vulnerability.proposed_close_date) {
        vulnerability.action_status_flag = PCD.toLowerCase();
        vulnerability.action_status = PCD
      }

      if(vulnerability.history && vulnerability.history[0] && vulnerability.history[0].action){
        const action = vulnerability.history[0].action;
        const actionStatus = vulnerability.history[0].status;
        if(action === "security_exception"){
            vulnerability.action_status = actionStatus === APPROVED ? SE : SE + "-" + actionStatus;
            vulnerability.action_status_flag = SE.toLowerCase();
        } else if(action === "false_positive"){
              vulnerability.action_status = actionStatus === APPROVED ? FP: FP + "-"+ actionStatus;
              vulnerability.action_status_flag = FP.toLowerCase();
          } else if(action === "proposed_close_date"){
            vulnerability.action_status = PCD;
            vulnerability.action_status_flag = PCD.toLowerCase();
        }
      }

      if (!hasProperty(combinedVulnerabilities, vulnerability._id)) {
        combinedVulnerabilities[vulnerability._id] = vulnerability;
        combinedVulnerabilities[vulnerability._id].reports = {};
      }

      combinedVulnerabilities[vulnerability._id].reports[report._id] = report.report_name;
    });
  });

  return { vulnerabilities: combinedVulnerabilities, organisationId };
};

/**
 * Build the Vulnerabilities table block
 * @param {Number} organisationId - Organisation Id
 * @param {Array} reportIds - Array of report Ids to generate the block for
 * @return {Object} Vulnerabilities
 */
const build = (organisationId, reportIds) => {
  handlebars.registerPartial(partialName,
    reportConfigurableHelper.fsReadBlockTemplate(partialName));
  return vulnerabilityModel
    .getVulnerabiltiesByReports(organisationId, reportIds)
    .then(function (cursor) {
      return cursor.toArray().then(function (result) {
        result = vulnerabilityModel.formatReportFields(result);
        return prepare(result, organisationId);
      });
    });
};

module.exports.build = build;
module.exports.partialName = partialName;

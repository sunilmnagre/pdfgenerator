const vulnerabilityModel = require('../../../models/vulnerability');
const handlebars = require('handlebars');
const reportConfigurableHelper = require('../../../helpers/report-configurable');
const dbSortingHelper = require('../../../helpers/db/sorting');
const _ = require('lodash');
const hasProperty = require('../../../helpers/general').hasProperty;

const partialName = 'table-vulnerabilities-se';

/**
 * Prepare data before populating into PDF report
 * @param {Object} data - The data to prepare
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
      if (hasProperty(vulnerability, 'security_exception')) {
        if (!hasProperty(combinedVulnerabilities, vulnerability._id)) {
          combinedVulnerabilities[vulnerability._id] = vulnerability;
          combinedVulnerabilities[vulnerability._id].reports = {};
        }

        combinedVulnerabilities[vulnerability._id].reports[report._id] = report.report_name;
      }
    });
  });

  const responseObject = { organisationId };

  if (Object.keys(combinedVulnerabilities).length > 0) {
    responseObject.vulnerabilities = combinedVulnerabilities;
  }

  return responseObject;
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

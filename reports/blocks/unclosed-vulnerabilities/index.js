const vulnerabilityModel = require('../../../models/vulnerability');
const configurableHelper = require('../../../helpers/report-configurable');
const slaHelper = require('../../../helpers/sla');
const hasProperty = require('../../../helpers/general').hasProperty;
const orgServicesModel = require('../../../models/org-service');
const handlebars = require('handlebars');
const _ = require('lodash');
const config = require('config');

const partialName = 'unclosed-vulnerabilities';

/**
 * Build the Unclosed vulnerabilities table block
 * @param {Number} organisationId - Organisation Id
 * @param {Array} reportIds - Array of report Ids to generate the block for
 * @return {Object} Vulnerabilities
 */
const build = (organisationId, reportIds) => {
  let allVulerabilities;
  let outSideSLA;
  let vulnerabilities;

  const severities = vulnerabilityModel.vulnerability().severities;
  const invertSeverites = _.invert(vulnerabilityModel.vulnerability().severities);
  const criticalSeverity = parseInt(invertSeverites.Critical, 10);
  let finalVulnerabilities;
  handlebars.registerPartial(partialName, configurableHelper.fsReadBlockTemplate(partialName));

  return vulnerabilityModel
    .getVulnerabiltiesByReports(organisationId, reportIds)
    .then(function (cursor) {
      return cursor.toArray().then(function (result) {
        result = vulnerabilityModel.formatReportFields(result);
        
        // Get SLA's of Organisation
        return orgServicesModel.getOrgSlasForVulnerabilities(organisationId)
          .then((slasForVulnerabilties) => {
            // Process the report(s) vulnerabilities
            _.each(result, function (reportWithVulnerability) {
              const slaBreachedParams = [];
              slaBreachedParams.push(slasForVulnerabilties.data);
              slaBreachedParams.push(reportWithVulnerability);
              const seExpire = [];
              const pcdResumedVulnerabilities = [];

              vulnerabilities = reportWithVulnerability.vulnerabilities;

              // check for SE expiry
              _.each(vulnerabilities, (vulnerability) => {
                const vulnerabilityType = vulnerabilityModel.getVulnerabilityType(vulnerability);


                if (vulnerabilityModel.doesSecurityExceptionExprireSoon(vulnerability)) {
                  vulnerability.high_priority_marker_expiry = true;
                  seExpire.push(vulnerability);
                }

                // Check if the vulnerability has repeated
                if (vulnerabilityType ===
                        vulnerabilityModel.vulnerabilityTypeProposedClosedResume) {
                  vulnerability.high_priority_marker_pcd_resumed = true;
                  pcdResumedVulnerabilities.push(vulnerability);
                }
              });

              // Filter all critical vulnerabilities
              allVulerabilities = _.filter(vulnerabilities, { severity: criticalSeverity });
              outSideSLA = slaHelper.removeVulnerabilitiesWithinSlaInReport(...slaBreachedParams);

              finalVulnerabilities = _.unionBy(outSideSLA.vulnerabilities, allVulerabilities, '_id');
              finalVulnerabilities = _.unionBy(seExpire, finalVulnerabilities, '_id');
              finalVulnerabilities = _.unionBy(pcdResumedVulnerabilities, finalVulnerabilities, '_id');

              // Set severity lable to vulnerabilities
              _.each(finalVulnerabilities, (vulnerability) => {
                const reason = [];
                if (vulnerability.severity === criticalSeverity) {
                  reason.push(_.upperFirst(severities[vulnerability.severity]));
                }

                if (hasProperty(vulnerability, 'sla')) {
                  reason.push('outside SLA');
                }

                if (hasProperty(vulnerability, 'high_priority_marker_pcd_resumed')) {
                  reason.push('proposed closed but resumed');
                }

                if (hasProperty(vulnerability, 'high_priority_marker_expiry')) {
                  reason.push('SE will expire soon (' +
                          config.vulnerabilities.types.securityException.daysToAlertBeforeEnd +
                          ' days)');
                }

                vulnerability.why = _.upperFirst(_.join(reason, ', '));
                vulnerability.severityName = severities[vulnerability.severity];
              });

              reportWithVulnerability.vulnerabilities = finalVulnerabilities;
            });

            return { reports: result, organisationId };
          });
      });
    });
};

/**
 * Prepare data before populating into PDF report
 * @param {Object} reports - The data to prepare
 * @return {Promise} Prepared data
 */
function prepare(data) {
  const reports = data.reports;
  const organisationId = data.organisationId;
  const combinedVulnerabilities = {};

  _.each(reports, function (report) {
    const reportVulnerabilities = report.vulnerabilities;

    _.each(reportVulnerabilities, function (vulnerability) {
      // Only add this vulnerability if it's not closed
      if (!vulnerabilityModel.isClosed(vulnerability)) {
        if (!hasProperty(combinedVulnerabilities, vulnerability._id)) {
          combinedVulnerabilities[vulnerability._id] = vulnerability;
          combinedVulnerabilities[vulnerability._id].reports = {};
        }

        combinedVulnerabilities[vulnerability._id].reports[report._id] = report.report_name;
      }
    });
  });

  const vulnerabilityCount = Object.keys(combinedVulnerabilities).length;
  const returnObject = {
    count: vulnerabilityCount,
    organisationId
  };

  if (vulnerabilityCount > 0) {
    returnObject.vulnerabilities = combinedVulnerabilities;
  }

  return returnObject;
}

module.exports.build = build;
module.exports.partialName = partialName;
module.exports.prepare = prepare;

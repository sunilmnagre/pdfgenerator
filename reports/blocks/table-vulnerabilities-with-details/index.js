const vulnerabilityModel = require('../../../models/vulnerability');
const handlebars = require('handlebars');
const reportConfigurableHelper = require('../../../helpers/report-configurable');
const userModel = require('../../../helpers/api/users');
const moment = require('moment');

const partialName = 'table-vulnerabilities-with-details';
const pluginModel = vulnerabilityModel.vulnerability();
const severities = vulnerabilityModel.vulnerability().severities;
const Promise = require('bluebird');

/**
 * Prepare data before populating into PDF report
 * @param {Object} reports - The data to prepare
 * @return {Promise} Prepared data
 */
function prepare(reports) {
  // Processing each reports to get vulnerabilities
  return Promise.map(reports, function (report) {
    // Processing each vulnerability to get notes and do some extra modifications
    return Promise.map(report.vulnerabilities, function (vulnerability) {
      // Making external Promise to get the result
      return new Promise(function (resolve) {
        // Adding plugin information into every vulnerability
        pluginModel
          .appendPluginInformation(vulnerability)
          .then(function () {
            // Replace serverity number into severity name.
            vulnerability.severity = severities[vulnerability.severity];
            //check risk factor for none , if none make it as null
            vulnerability.risk_factor=vulnerability&&vulnerability.risk_factor&&(vulnerability.risk_factor.toLowerCase()==="none"?null:vulnerability.risk_factor);
             //check solution for N/A , if n/a make it as null
            vulnerability.solution=vulnerability&&vulnerability.solution&&(vulnerability.solution.toLowerCase()==="n/a"?null:vulnerability.solution);
            //remove html from plugin-output
             vulnerability.plugin_output=vulnerability.plugin_output.replace(/<[^>]*>?/gm, '');
             //remove html from plugin-output if it is encoded
             vulnerability.plugin_output=vulnerability.plugin_output.replace(/(&lt([^>]+)&gt;)/gi, '');
            // Check if vulnerability object has notes?
            if (Object.prototype.hasOwnProperty.call(vulnerability, 'notes')) {
              // Get User info by passing userId
              userModel
                .filloutObjectsWithUserInfo(vulnerability.notes)
                .then(function (updatedNotes) {
                  updatedNotes.map((note) => {
                    // Converts ISO string into readable format
                    note.created_at = moment(note.created_at).format('MMM DD, YYYY, h:mm:ss a');
                    if (note.updated_at) {
                      note.updated_at = moment(note.updated_at).format('MMM DD, YYYY, h:mm:ss a');
                    }
                    return note;
                  });
                  vulnerability.notes = updatedNotes;
                  resolve(vulnerability);
                });
            } else {
              resolve(vulnerability);
            }
          });
      });
    });
  });
}

/**
 * Build the Vulnerabilities table block
 * @param {Number} organisationId - Organisation Id
 * @param {Array} reportIds - Array of report Ids to generate the block for
 * @return {Object} Vulnerabilities
 */
const build = (organisationId, reportIds) => {
  handlebars.registerPartial(partialName,
    reportConfigurableHelper.fsReadBlockTemplate(partialName));
  // Getting all vulnerabilities of selected reports
  return vulnerabilityModel
    .getVulnerabiltiesByReports(organisationId, reportIds)
    .then(function (cursor) {
      return cursor.toArray().then(function (reports) {
        reports = vulnerabilityModel.formatReportFields(reports);
        
        return Promise.all(prepare(reports)).then(() => reports);
      });
    });
};

module.exports.build = build;
module.exports.partialName = partialName;

const vulnerabilityModel = require('../../../models/vulnerability');
const handlebars = require('handlebars');
const configurableHelper = require('../../../helpers/report-configurable');
const userModel = require('../../../models/user');
const _ = require('lodash');
const Promise = require('bluebird');

const partialName = 'sla-breached-vulnerabilities-with-notes';
const severities = vulnerabilityModel.vulnerability().severities;

/**
 * Prepare data before populating into PDF report
 * @param {Object} data - The data to prepare
 * @return {Object} Prepared data
 */
const prepare = function (data, slaVulnerabilities) {
  const mappedVulnerabilities = data.map((vulnerability) => {
    vulnerability.severity = severities[vulnerability.severity];
    vulnerability.user_note = slaVulnerabilities[vulnerability._id];
    return vulnerability;
  });

  return mappedVulnerabilities;
};

/**
* Get vulnerabilities from Database
* @param {Number} organisationId - Organisation Id
* @param {Array} vulnerabilityIds - Array of vulnerabilities
* @return {Object} Vulnerabilities
*/
const getVulnerabilties = (organisationId, vulnerabilityIds) => vulnerabilityModel
  .getVulnerabiltiesByIds(organisationId, vulnerabilityIds)
  .then(function (cursor) {
    return cursor.toArray().then(function (vulnerabilities) {
      return vulnerabilities;
    });
  });

/**
 * Get userInfo from Database
 * @param {Number} userId - user ID
 * @return {Object} User Information
 */
const getUserInfo = userId => userModel.getUserById(userId).then(user => user);

/**
 * Build the Vulnerabilities table block
 * @param {Number} organisationId - Organisation Id
 * @param {Number} reportIds - Array of reportIds
 * @param {Array} slaVulnerabilities - Array of vulnerabilities to generate the block
 * @return {Object} Vulnerabilities
 */
const build = (organisationId, reportIds, additionalParameters) => {
  const slaVulnerabilities = additionalParameters.vulnerabilityNotes;
  const vulnerabilityIds = _.keys(slaVulnerabilities);
  const userId = additionalParameters.userId;
  handlebars.registerPartial(partialName, configurableHelper.fsReadBlockTemplate(partialName));

  // Getting all vulnerabilities
  return Promise.all([getVulnerabilties(organisationId, vulnerabilityIds), getUserInfo(userId)])
    .spread((rawVulnerabilities, userInfo) => {
      const vulnerabilities = prepare(rawVulnerabilities, slaVulnerabilities);
      return {
        userInfo,
        vulnerabilities
      };
    });
};

module.exports.build = build;
module.exports.partialName = partialName;

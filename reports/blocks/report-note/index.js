const partialName = 'report-note';
const reportConfigurableHelper = require('../../../helpers/report-configurable');
const hasProperty = require('../../../helpers/general').hasProperty;
const handlebars = require('handlebars');

/**
 * Prepare data before populating into PDF report
 * @param {Object} data - The data to prepare
 * @return {Object} Prepared data
 */
const build = (organisationId, reportIds, additionalParameters) => {
  handlebars.registerPartial(partialName,
    reportConfigurableHelper.fsReadBlockTemplate(partialName));

  if (hasProperty(additionalParameters, 'reportNote')) {
    return additionalParameters.reportNote;
  }
  return null;
};

/**
 * Prepare data before populating into PDF report
 * @param {Object} data - The data to prepare
 * @return {Object} Prepared data
 */
const prepare = (data) => {
  if (data !== null) {
    return { note: data };
  }
  return null;
};

module.exports.build = build;
module.exports.partialName = partialName;
module.exports.prepare = prepare;

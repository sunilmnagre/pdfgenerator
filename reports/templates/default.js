const blockHeader = require('../blocks/header');
const blockSummaryVulnerabilitySeverity = require('../blocks/summary-vulnerability-severity');
const blockTableVulnerabilities = require('../blocks/table-vulnerabilities');
const blockUnclosedVulnerabilities = require('../blocks/unclosed-vulnerabilities');
const blockSummaryVulnerabilityTypes = require('../blocks/summary-vulnerability-types');
const blockReportInformation = require('../blocks/report-information');
const blockSubHeader = require('../blocks/sub-header');
const blockVulnerabilityRepeated = require('../blocks/summary-vulnerability-repeated');
const blockClosedBreachedSLA = require('../blocks/closed-breached-sla');
const blockTableVulnerabilitiesSe = require('../blocks/table-vulnerabilities-se');
const blockTableVulnerabilitiesWithDetails = require('../blocks/table-vulnerabilities-with-details');

/**
 * Returns the preloadable blocks that will be included but need to be explictly displayed
 * @type {Array}
 */
function getPreloadBlocks() {
  return [blockSubHeader.partialName];
}

/**
 * Returns the blocks for this report
 * @returns {Array} Array of blocks for this report
 */
function getBlocks() {
  const blocksToInclude = [
    blockHeader.partialName,
    blockReportInformation.partialName,
    blockSummaryVulnerabilitySeverity.partialName,
    blockSummaryVulnerabilityTypes.partialName,
    blockVulnerabilityRepeated.partialName,
    blockTableVulnerabilities.partialName,
    blockTableVulnerabilitiesSe.partialName,
    blockUnclosedVulnerabilities.partialName,
    blockClosedBreachedSLA.partialName,
    blockTableVulnerabilitiesWithDetails.partialName
  ];

  return blocksToInclude;
}

const templateName = 'Default';

module.exports.getBlocks = getBlocks;
module.exports.getPreloadBlocks = getPreloadBlocks;
module.exports.name = templateName;

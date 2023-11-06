const blockHeader = require('../blocks/header');
const blockReportNotes = require('../blocks/report-note');
const blockSummaryVulnerabilitySeverity = require('../blocks/summary-vulnerability-severity');
const blockTableVulnerabilities = require('../blocks/table-vulnerabilities');
const blockTableVulnerabilitiesSe = require('../blocks/table-vulnerabilities-se');
const blockUnclosedVulnerabilities = require('../blocks/unclosed-vulnerabilities');
const blockSummaryVulnerabilityTypes = require('../blocks/summary-vulnerability-types');
const blockReportInformation = require('../blocks/report-information');
const blockSubHeader = require('../blocks/sub-header');
const blockClosedBreachedSLA = require('../blocks/closed-breached-sla');
const blockSlaVulnerabilityNotes = require('../blocks/sla-breached-vulnerabilities-with-notes');
const blockTableVulnerabilitiesWithDetails = require('../blocks/table-vulnerabilities-with-details');
var _ = require('lodash');


/**
 * Returns the preloadable blocks that will be included but need to be explictly displayed
 * @type {Array}
 */
function getPreloadBlocks() {
  return [blockSubHeader.partialName];
}

/**
 * Returns the blocks for this report
 * @param {Array} blocks The blocks to include (for a configurable report)
 * @returns {Array} Array of blocks for this report
 */
function getBlocks(blocks = []) {
  const blocksToInclude = [];

  blocksToInclude.push(blockHeader.partialName);
  blocksToInclude.push(blockReportInformation.partialName);
  blocksToInclude.push(blockReportNotes.partialName);

  if (_.includes(blocks, blockSummaryVulnerabilitySeverity.partialName)) {
    blocksToInclude.push(blockSummaryVulnerabilitySeverity.partialName);
  }

  if (_.includes(blocks, blockSummaryVulnerabilityTypes.partialName)) {
    blocksToInclude.push(blockSummaryVulnerabilityTypes.partialName);
  }

  if (_.includes(blocks, blockUnclosedVulnerabilities.partialName)) {
    blocksToInclude.push(blockUnclosedVulnerabilities.partialName);
  }

  if (_.includes(blocks, blockClosedBreachedSLA.partialName)) {
    blocksToInclude.push(blockClosedBreachedSLA.partialName);
  }

  if (_.includes(blocks, blockTableVulnerabilitiesSe.partialName)) {
    blocksToInclude.push(blockTableVulnerabilitiesSe.partialName);
  }

  if (_.includes(blocks, blockTableVulnerabilities.partialName)) {
    blocksToInclude.push(blockTableVulnerabilities.partialName);
  }

  if (_.includes(blocks, blockSlaVulnerabilityNotes.partialName)) {
    blocksToInclude.push(blockSlaVulnerabilityNotes.partialName);
  }

  if (_.includes(blocks, blockTableVulnerabilitiesWithDetails.partialName)) {
    blocksToInclude.push(blockTableVulnerabilitiesWithDetails.partialName);
  }

  return blocksToInclude;
}

const templateName = 'Configurable';

module.exports.getBlocks = getBlocks;
module.exports.getPreloadBlocks = getPreloadBlocks;
module.exports.name = templateName;

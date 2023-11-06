const fs = require('fs');
const path = require('path');
const config = require('config');
const _ = require('lodash');

const appRoot = path.dirname(require.main.filename);

function getRootDirectory() {
  return path.resolve(path.dirname(require.main.filename), config.paths.reportsConfigurableDirectory) + '/';
}

function getRootDirectoryFromHost(host) {
  return host + config.paths.reportsConfigurableDirectoryForHost;
}

/**
 * Reads in and returns the contents of the given report block template file
 * @param {String} blockName The name of the block to read and return
 * @returns String
 */
function fsReadBlockTemplate(blockName) {
  return fs.readFileSync(path.resolve(getRootDirectory(), 'blocks/' + blockName + '/index.html'), 'utf8');
}

/**
 * Gets the javascript file location for a given report block
 * @param {String} blockName The name of the block to find
 * @returns {String} The absolute file location for the block's JS file
 */
function getBlockJsLocation(blockName) {
  return path.resolve(getRootDirectory(), 'blocks/' + blockName + '/index.js');
}

/**
 * Returns a temporary file location for this PDF file
 * @param {String} filename The file name (without suffix)
 * @returns {String} An absolute filename location
 */
function getReportTempFileLocation(filename) {
  const tempFileName = path.resolve(appRoot, config.paths.tmpDirectory + '/reports/' + filename + '.pdf');
  return tempFileName;
}

/**
 * Gets the location of the given file name (like an image, relative to the template directory)
 * @param {String} fileName The file name to get the location for
 * @returns {String} The file location for the given file name
 */
function getFileLocation(fileName) {
  return path.resolve(appRoot, getRootDirectory() + fileName);
}

/**
 * Gets the location of the given file name (like an image, relative to the template directory)
 * @param {String} host The host address to get the file
 * @param {String} fileName The file name to get the location for
 * @returns {String} The file location for the given file name
 */
function getFileLocationFromHost(host, fileName) {
  return getRootDirectoryFromHost(host) + fileName;
}

/**
 * Returns the location of the template for a report template
 * @param {String} templateName The file name to find the location for
 * @returns {String} The absolute location for this template file name
 */
function getReportTemplateLocation(templateName) {
  return getFileLocation('templates/' + templateName + '.html');
}

/**
 * Gets the javascript (configuration) file for a given report name
 * @param {String} templateName The file location for the config file for a given template
 * @returns {String} The file location for the given template name
 */
function getTemplateJsLocation(templateName) {
  return getFileLocation('templates/' + templateName + '.js');
}

const csvHeaders = () => {
  let fields = [
    { label: 'Name', value: 'name' },
    { label: 'Scan Id', value: 'tenable_scan_id' },
    { label: 'Host Id', value: 'tenable_host_id' },
    { label: 'Severity', value: 'severity' },
    { label: 'Description', value: 'description' }, { label: 'Solution', value: 'solution' },
    { label: 'Risk Fatcor', value: 'risk_factor' }, { label: 'Target', value: 'target' }, { label: 'Protocol', value: 'protocol' },
    { label: 'PortInfo', value: 'portInfo' }, { label: 'CVSS', value: 'cvss' }, { label: 'Port', value: 'port' },
    { label: 'Plugin Id', value: 'tenable_plugin_id' },
    { label: 'See also', value: 'see_also' }, { label: 'Synopsis', value: 'synopsis' }, { label: 'Repeat Count', value: 'count' },
    { label: 'Searchable Id ', value: 'searchable_id' }, { label: 'Plugin Output', value: 'plugin_output' }];
  fields = _.orderBy(fields, ['label'], ['asc']);
  return fields
}
const filterFields = (incomeFields) => {
  let filterFields = [];
  try {
    const fields = csvHeaders();
    filterFields = incomeFields.filter((elem) => fields.find(({ value }) => elem.value === value));
    let tenable_plugin_id = filterFields.find(field => field.value === 'tenable_plugin_id');
    let name = filterFields.find(field => field.value === 'name');
    if (!name) {
      filterFields.unshift({ label: 'Name', value: 'name' });
    }
    if (!tenable_plugin_id) {
      filterFields.unshift({ label: 'Plugin Id', value: 'tenable_plugin_id' });
    }
    return filterFields;
  } catch (error) {
    filterFields.unshift({ label: 'Name', value: 'name' });
    filterFields.unshift({ label: 'Plugin Id', value: 'tenable_plugin_id' });
    return []
  }
}

module.exports = {
  fsReadBlockTemplate,
  getReportTempFileLocation,
  getTemplateJsLocation,
  getReportTemplateLocation,
  getBlockJsLocation,
  getFileLocation,
  getRootDirectory,
  getFileLocationFromHost,
  filterFields,
  csvHeaders
};

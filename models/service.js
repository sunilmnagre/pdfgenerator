const models = require('../db_models');

/**
 * Array of fields to be mapped when responding to an API
 * @type {Object}
 */
const mapApi = {
  id: 'id',
  name: 'name',
  short: 'short'
};

/**
 * Mapping for the authentication module (that should be refactored)
 * @type {Object}
 */
const mapApiLegacy = {
  id: 'value',
  name: 'label',
  short: 'module',
  service_type: 'type'
};

/**
 * Gets all the services in the system
 * @returns Promise of a list of services
 */
function getAllServices() {
  var allServicesQuery = { raw: true };
  return models.Service.findAll(allServicesQuery);
}

module.exports.mapApi = mapApi;
module.exports.mapApiLegacy = mapApiLegacy;
module.exports.getAllServices = getAllServices;

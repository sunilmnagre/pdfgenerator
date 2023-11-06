var _ = require('lodash');

/**
 * Maps a Sequelize object to specific fields
 * @param {Object} object - Sequelize object to be mapped
 * @param {Array} fieldMap - Associative array of fields that need to be mapped, with from and 
 *  to fields
 * @return {Array} - Mapped data
 *
 * How to use the functions. The functions (if set in a mapper) are passed the original
 *  value that would be mapped, along with the entire object as a second parameter if
 *  it needs to be used.
 *
 * Inside the function, make the changes you need to make, then return an object
 *  that contains the key that you want to return in the final object along with
 *  the value.
 *
 * E.g. scans.js
 *  this.mapApi = {
 *      'name': 'name',
 *      'last_updated_time': function(existingLastUpdated, object) {
 *          var newLastUpdated = existingLastUpdated + 5; // Add 5 to the time (for some reason)
 *          return {'scan_last_updated_time': newLastUpdated};
 *      }
 *  }
 *
 * This will return a mapped object that looks like:
 *  {
 *     'name': 'Name of the scan',
 *   'scan_last_updated_time' : 100000005
 *  }
 */
function mapSequelize(object, fieldMap) {
  let mappedFields = {};

  _.each(fieldMap, function (toField, fromField) {
    if ((fromField in object) || (typeof toField === 'function')) {
      // If the "to" field is a function, run it
      if (typeof toField === 'function') {
        const functionValue = toField(object[fromField], object);
        mappedFields = _.merge(mappedFields, functionValue);
      } else {
        mappedFields[toField] = object[fromField];
      }
    }
  });

  return mappedFields;
}

/**
* Maps a Sequelize object to specific fields
* @param {Object} object - Sequelize objects to be mapped
 * @param {Array} fieldMap - Associative array of fields that need to be mapped, with from and 
 *  to fields
 * @return {Array} - Mapped data
 */
function mapSequelizeObjects(objects, fieldMap) {
  return objects.map(function (objectToMap) {
    return mapSequelize(objectToMap, fieldMap);
  });
}

module.exports.mapSequelize = mapSequelize;
module.exports.mapSequelizeObjects = mapSequelizeObjects;

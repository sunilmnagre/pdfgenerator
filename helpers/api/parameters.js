var modelsHelper = require('../models');
var config = require('config');
var _ = require('lodash');
var hasProperty = require('../general').hasProperty;

var parameterHelpers;
/**
 * Extracts any pagination parameters from a given request, ready for pagination
 * @param {Request} request - Request object
 * @return {Array} - Array of pagination parameters
 */
function extractPaginationParameters(request) {
  // Default the pagination parameters
  var paginationParameters = {
    itemsPerPage: config.pagination.itemsPerPage,
    pageNumber: 1
  };

  if (request.query && request.query.limit) {
    paginationParameters.itemsPerPage = parseInt(request.query.limit, 10);
  }

  if (request.query && request.query.page) {
    paginationParameters.pageNumber = parseInt(request.query.page, 10);
  }

  return paginationParameters;
}

/**
 * Extracts any sorting parameters from a given request, and returns them in
 *  an assocative array with the column and direction
 * @param {Request} request - Request object
 * @return {Array} - Assocative array with the column and direction
 */
function extractSortingParameters(request) {
  // Default the pagination parameters
  var sortFields = {};
  var sortOptions = {};
  if (request.query['sort-by']) {
    // Split the sorting into bits
    sortOptions = request.query['sort-by'].split(',');

    _.each(sortOptions, function (sortOption) {
      var sortDirection = 'asc';
      var sortOptionSubString = sortOption;
      // Check if the first item is a "minus", which denotes a descending sort
      if (sortOption[0] === '-') {
        sortDirection = 'desc';
        sortOptionSubString = sortOption.substring(1, sortOption.length);
      }

      sortFields[sortOptionSubString] = sortDirection;
    });
  }

  return sortFields;
}

/**
 * Extracts group-by parameters from a given request, and returns them in
 *  an array
 * @param {Request} request - Request object
 * @return {Array} - Array of group-by options
 */
function extractGroupByParameters(request) {
  var groupByArray = [];

  if (request.query['group-by']) {
    // Split the group-by into bits
    groupByArray = request.query['group-by'].split(',');
  }

  return groupByArray;
}

/**
 * Checks if the given object name is included in the "expand" parameter in the URL
 * @param {Request} request - Request object
 * @param {String} objectToSearchFor - The name of the object to search for
 * @return {Boolean} - True if the user has asked to expand this object
 */
function hasExpand(request, objectToSearchFor) {
  var expandObjects = {};
  if (request.query.expand === undefined) {
    return false;
  }

  expandObjects = request.query.expand.split(',');
  return expandObjects.includes(objectToSearchFor);
}

/**
 * Extracts the given query parameter from the request and returns it
 * @param {Request} request - Request object
 * @param {String} parameterName - The name of the parameter to search for
 * @param {Mixed} defaultValue If null is found, it will be replaced with this default value
 * @return {String|null} - String if the parameter name is found, null if not
 */
function getQueryParameter(request, parameterName, defaultValue = null) {
  if (request.query[parameterName]) {
    return request.query[parameterName];
  }

  return defaultValue;
}

/**
 * Extracts the given body parameter from the request and returns it
 * @param {Request} request - Request object
 * @param {String} parameterName - The name of the parameter to search for
 * @param {Mixed} defaultValue If null is found, it will be replaced with this default value
 * @return {String|null} - String if the parameter name is found, null if not
 */
function getBodyParameter(request, parameterName, defaultValue = null) {
  if (request.body[parameterName]) {
    return request.body[parameterName];
  }

  return defaultValue;
}

/**
 * Extracts the given URL parameter from the request and returns it
 * @param {Request} request Request object
 * @param {String} parameterName The name of the parameter to search for
 * @param {Mixed} defaultValue If null is found, it will be replaced with this default value
 * @return {String|null} String if the parameter name is found, null if not
 */
function getParamsParameter(request, parameterName, defaultValue = null) {
  if (hasProperty(request.params, parameterName)) {
    return request.params[parameterName];
  }

  return defaultValue;
}

/**
 * Check given parameters against writableFields & filter non writable params
 * @param {Request} request Request object
 * @param {Array} writableFields List of the writable fields
 * @return {Object|null} - Object with writable key:value pairs, null if non found
 */
function getWritableParameters(request, writableFields) {
  return modelsHelper.filterFieldsFromObject(request.body, writableFields);
}

/**
 * Format scan schedule parameters according to Nessus
 * @param {Object} schedule Scan schedule object
 * @return {Object} Formatted scan schedule object
 */
function getScanScheduleParamsFormatted(schedule) {
  var frequency;
  var formattedSchedule;
  var duration;
  _.each(config.globals.launchDuration, function (object, key) {
    duration = object.value;
    if (key === schedule.frequency) {
      frequency = (duration.split(';'))[0];
      formattedSchedule = 'FREQ=' + duration;
    }
  });

  return { launch: frequency, rrule: formattedSchedule };
}

module.exports = {
  extractPaginationParameters,
  hasExpand,
  extractSortingParameters,
  getQueryParameter,
  getWritableParameters,
  extractGroupByParameters,
  getScanScheduleParamsFormatted,
  getBodyParameter,
  getParamsParameter
};

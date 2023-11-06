// Packages
const config = require('config');
const MongoObjectId = require('mongodb').ObjectID;
const _ = require('lodash');

// Models
const historyModel = require('./history');
const vulnerabilityModel = require('./vulnerability').vulnerability();

// Helpers
const mongo = require('../helpers/mongo');
const modelsHelper = require('../helpers/models');
const { buildFilterByAttributeQuery } = require('../helpers/query');
const constantErrors = require('../helpers/constant-errors');

// Constants
const vulnerabilityTable = config.mongo.tables.vulnerabilities;


/**
 *
 * @param {String} fieldValue
 * @param {Boolean} includeTarget
 */
const filterByAttributeQuery = (fieldValue,
  includeTarget = false) => {
  const targetsFields = { textFields: ['target'] };
  const vulnerabilitiesFields = {
    textFields: ['protocol', 'port', 'name', 'severity'],
    numericFields: ['count', 'portInfo']
  };
  return buildFilterByAttributeQuery(fieldValue,
    includeTarget ? vulnerabilitiesFields : targetsFields, !!includeTarget);
}

/**
 * Build Query to find the vulnerbailites 
 * @param {Object} fieldsToSet
 */
const buildQueryBasedOnActionParameters = (fieldsToSet) => {
  const query = {};
    const {
      portInfo, protocol, pluginIds, targets
    } = fieldsToSet[fieldsToSet.actionsToMark];

    if (portInfo && portInfo !== 'any') {
      query.portInfo = { $in: portInfo.split(',') };
    }
    if (protocol !== 'any') {
      query.protocol = protocol;
    }
    query.tenable_plugin_id = { $in: pluginIds };
    if (targets && targets !== 'all') {
      query.target = { $in: targets.split(',') };
    }
  return query;
};

/**
 * Format the actions fields like date.
 * @param {Object} fieldsToSet 
 */
const formatActionsFields = (fieldsToSet) => {
  const actionType = fieldsToSet.actionsToMark;
  const { date, start_date, end_date } = fieldsToSet[fieldsToSet.actionsToMark];

  if (date) {
    fieldsToSet[fieldsToSet.actionsToMark].date = modelsHelper.convertMillisecondsToISOString(date);
  }
  if (start_date) {
    fieldsToSet[fieldsToSet.actionsToMark].start_date = modelsHelper.convertMillisecondsToISOString(start_date);
  }
  if (end_date) {
    fieldsToSet[fieldsToSet.actionsToMark].end_date = modelsHelper.convertMillisecondsToISOString(end_date);
  }
  return { fieldsToSet, actionType };
};

/**
 *  Create new Fields Object for the actions to mark
 * @param {*} fields 
 */
const getTheActionsFields = (fields) => {
  const fieldsToSetData = formatActionsFields(JSON.parse(JSON.stringify(fields)));
  const { fieldsToSet, actionType } = fieldsToSetData;
  return { fieldsToSet, actionType };
};

/**
 * 
 * @param {*} organisationId 
 * @param {*} vulnerability 
 * @param {*} actionType 
 * @param {*} queryParams 
 */
const markTheActionToRemove = async (organisationId, vulnerability, actionType, queryParams) => {
  const historyActionList = historyModel.historyAction;
  // Remove current action when change for one action to the
  let actionToBeRemoved = null;
  _.each(historyActionList, (action) => {
    if (vulnerability[action] && action !== actionType) {
      actionToBeRemoved = {};
      actionToBeRemoved[action] = 1;
    }
  });

  if (actionToBeRemoved) {
    return await mongo.deleteObject(organisationId, vulnerabilityTable, queryParams,
      actionToBeRemoved);
  }
  return true;
};

/**
 * Update the history Object with new and prvious values And Insert
 * @param {Object} req 
 * @param {String} actionType 
 * @param {Number} organisationId 
 * @param {Object} historyFields 
 * @param {String} actionStatus 
 * @param {Object} queryParams 
 * @param {Object} fieldsToSet 
 * @param {Object} vulnerability 
 */
const updateAndInsertAction = async (req, actionType, organisationId, historyFields, actionStatus, queryParams, fieldsToSet, vulnerability) => {
  let [newValues] = [{}];
  const [previousValues] = [{}];
  // Update the object
  const result = await mongo.updateOne(organisationId, vulnerabilityTable, queryParams,
    fieldsToSet);
  if (result !== null && !(!modelsHelper.doObjectFieldsOverlap(vulnerabilityModel.typeFields,
    historyFields))) {
    // Check to see which fields have changed, and add them to the history
    // Get previous  vaules
    _.each(historyFields, (value, key) => {
      if (Object.prototype.hasOwnProperty.call(vulnerability, key)) {
        previousValues[key] = vulnerability[key];
      }
    });

    // Assign history fields
    newValues = historyFields;
    // Insert history object
    return await historyModel.addHistoryItem(organisationId,
      vulnerabilityTable, queryParams, actionStatus, actionType, req.decoded.id,
      previousValues, newValues);
  }
  return false;
};

/**
 * 
 * @param {Object} req 
 * @param {Object} fieldsToSet 
 * @param {String} actionStatus 
 * @param {Object} fields 
 */
const updateHistory = (req,vulnerability, fieldsToSet, actionStatus, fields) => {
  const isHistoryUpdate = modelsHelper.doObjectFieldsOverlap(vulnerabilityModel.typeFields,
    fieldsToSet);
  if (isHistoryUpdate) {
    // Based on user login set the status
    if (req.decoded.user_type === config.user_type.Customer) {
      actionStatus = fieldsToSet[fields.actionsToMark] === 'proposed_close_date'
        ? historyModel.statuses.proposed : historyModel.statuses.pending;
      if (Object.prototype.hasOwnProperty.call(vulnerability, 'history')) {
        fieldsToSet = { history: vulnerability.history };
      } else {
        fieldsToSet = { history: [] };
      }
    } else {
      fieldsToSet[fields.actionsToMark].status;
      actionStatus = fieldsToSet[fields.actionsToMark] === 'proposed_close_date'
        ? historyModel.statuses.proposed : historyModel.statuses.approved;
    }
  }
  return { fieldsToSet, actionStatus };
};

/**
 * Perform action on vulnerabilities
 * @param {Object} req
 * @param {Number} organisationId
 * @param {Object} fields
 */
const performActionOnVulnerabilities = async (req, organisationId, fields) => {

  try {
    // Query to find the vulnerabilities to mark with action
    const queryFields = buildQueryBasedOnActionParameters(fields);
    const projection = {
      _id: 1, false_positive: 1, security_exception: 1, proposed_close_date: 1, history: 1
    };

    // Get the all vulnerabilities
    const vulnerabilitiesCursor = await mongo.find(organisationId, vulnerabilityTable, queryFields, projection);
    const vulnerabilities = await vulnerabilitiesCursor.toArray();

    if (vulnerabilities && vulnerabilities.length == 0) {
      return { match: false, message: constantErrors.vulnerabilities.markActionNotMacth }
    }

    // Iterate through the all vulenerabilites and mark the action
    for (const vulnerability of vulnerabilities) {
      let [actionStatus, historyFields] = ['', {}];

      // Query to the  vulnerability
      const queryParams = { _id: new MongoObjectId(vulnerability._id) };
      let { fieldsToSet = {}, actionType = '' } = getTheActionsFields(fields);

      // Remove current action when change for one action to the
      await markTheActionToRemove(organisationId, vulnerability, actionType,
        queryParams);

      // Copies by value input fields to history fields
      historyFields = JSON.parse(JSON.stringify(fieldsToSet));

      // Update the history field
      const historyUpdate = updateHistory(req,vulnerability, fieldsToSet, actionStatus, fields);
      fieldsToSet = historyUpdate.fieldsToSet;
      actionStatus = historyUpdate.actionStatus;

      // Update the history and Insert
      await updateAndInsertAction(req, actionType, organisationId, historyFields, actionStatus,
        queryParams, fieldsToSet, vulnerability);
    }
    return true;
  }
  catch (err) {
    return err
  }
};

module.exports = {
  filterByAttributeQuery,
  performActionOnVulnerabilities
};

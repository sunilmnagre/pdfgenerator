var mongo = require('../helpers/mongo');
var config = require('config');
var MongoObjectId = require('mongodb').ObjectID;
var moment = require('moment');

var historyAction = {
  actionFalsePositive: 'false_positive',
  actionSecurityException: 'security_exception',
  actionProposedCloseDate: 'proposed_close_date',
};

/**
 * Possible statuses for a history item
 */
var statuses = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  proposed: 'proposed',
};

/**
 * The fields that a user can set to be saved to the DB
 */
var writableFields = [
  'status',
  'reject_reason',
  'approved_reason',
];

/**
 * Adds a history object inside vulnerability
 * @param {Number} organisationId - Unique ID of the organisation.
 * @param {String} collectionName - collection to be updated.
 * @param {String} queryParams - Filter criteria for update.
 * @param {String} action - summary of the action taken.
 * @param {String} updatedBy - ID of the user updating vulnerability
 * @param {String} updatedAt - Time of action
 * @param {Object} previousValues - key,value pair of the fields before update.
 * @param {Object} newValues - key,value pair of the fields after update.
 */
var addHistoryItem = function (organisationId, collectionName, queryParams,
  status, action, updatedBy, previousValues, newValues) {
  var historyObj = {};
  var historyObjAttributes = {};
  historyObjAttributes._id = new MongoObjectId();
  historyObjAttributes.action = action;
  historyObjAttributes.status = status;
  historyObjAttributes.previous_values = previousValues;
  historyObjAttributes.new_values = newValues;

  if (updatedBy !== config.user_type.Customer) {
    historyObjAttributes.updated_by = updatedBy;
    historyObjAttributes.updated_at = moment().toISOString();
  } else {
    historyObjAttributes.requested_by = updatedBy;
    historyObjAttributes.requested_at = moment().toISOString();
  }
  historyObj = { history: historyObjAttributes };

  return mongo.upsertArray(organisationId, collectionName,
    queryParams, historyObj);
};

module.exports = {
  addHistoryItem,
  historyAction,
  statuses,
  writableFields,
};

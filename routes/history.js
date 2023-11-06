var config = require('config');
var parameterHelper = require('../helpers/api/parameters');
var historyModel = require('../models/history');
var mongoHelper = require('../helpers/mongo');
var mongoObjectId = require('mongodb').ObjectID;
var _ = require('lodash');
var moment = require('moment');
var modelsHelper = require('../helpers/models');


/**
 * @api {patch}
/api/v1/organisations/:id/reports/:reportId/vulnerabilities/:vulnerability_id/history/:history_id
Allows updating of a history item
 * @apiVersion 1.0.0
 * @apiName UpdateVulnerabilityHistory
 * @apiGroup Vulnerability
 *
 * @apiParam (URL) {Number} organisation_id Organisation ID
 * @apiParam (URL) {Number} reportId Report ID
 * @apiParam (URL) {Number} vulnerabilityId Vulnerability ID
 * @apiParam (URL) {Number} historyId History ID
 * @apiParam (JSON) {String} status Status of the history item. Can be `rejected` or `approved`
 * @apiParam (JSON) {String} [reject_reason] If rejected, the reason for the rejection
 * @apiParamExample {json} Example PATCH JSON:
 {
   "status": "rejected",
   "reject_reason": "Not enough information given"
 }
 */

/**
 * Allows the updating of a vulnerability history object
 * @param {Object} request - The Standard ExpressJS request variable.
 * @param {Object} response - The Standard ExpressJS response variable.
 */
function updateHistory(request, response) {
  var fieldsToUpdate = {};
  var organisationId = request.params.id;
  var vulnerabilityId = request.params.vulnerabilityId;
  var historyId = request.params.historyId;
  var newStatus = historyModel.statuses.pending;
  var newVulnerabilityFields = {};
  var newHistoryFields = {};
  var hasApproveOrReject = false;
  var ifRejectHasReason = false;

  // Get the vulnerability item by ID and history ID
  var vulnerabilityQuery = {
    _id: mongoObjectId(vulnerabilityId),
    history: {
      $elemMatch: {
        _id: mongoObjectId(historyId),
        status: historyModel.statuses.pending
      }
    }
  };

  // This gets the vulnerability and only the history object with the given ID
  mongoHelper.findOne(organisationId, config.mongo.tables.vulnerabilities,
    vulnerabilityQuery, { history: { $elemMatch: { _id: mongoObjectId(historyId) } } })
    .then(function (vulnerability) {
      // Vulnerability or history item not found
      if (vulnerability === null) {
        response.status(404);
        return response.jsend.fail([]);
      }

      // Check the fields for those that can be updated
      fieldsToUpdate = parameterHelper.getWritableParameters(request,
        historyModel.writableFields);

      if (Object.keys(fieldsToUpdate).length === 0) {
        response.status(422);
        return response.jsend.fail(['No fields to update']);
      }

      // Validate the updated fields
      hasApproveOrReject = !((fieldsToUpdate.status !== historyModel.statuses.approved) &&
        (fieldsToUpdate.status !== historyModel.statuses.rejected));

      ifRejectHasReason = !((fieldsToUpdate.status === historyModel.statuses.rejected) &&
        ((!Object.prototype.hasOwnProperty.call(fieldsToUpdate, 'reject_reason')) ||
          (_.trim(fieldsToUpdate.reject_reason) === '')));

      if (!hasApproveOrReject || !ifRejectHasReason) {
        response.status(422);
        return response.jsend.fail(['Missing status or status reason']);
      }

      newStatus = fieldsToUpdate.status;
      newVulnerabilityFields = vulnerability.history[0].new_values;
      if (newVulnerabilityFields.proposed_close_date) {
        const extendDate = modelsHelper.convertMillisecondsToISOString(request.body.date);
        newVulnerabilityFields.proposed_close_date.date = extendDate;
      }

      newHistoryFields = {
        'history.$.status': newStatus,
        'history.$.updated_by': request.decoded.id,
        'history.$.updated_at': moment().toISOString()
      };

      // If the history item is approved, then update the vulnerability
      if (newStatus === historyModel.statuses.approved) {
        if (Object.prototype.hasOwnProperty.call(fieldsToUpdate, 'approved_reason')) {
          newHistoryFields['history.$.approved_reason'] = _.trim(fieldsToUpdate.approved_reason);
        }

        mongoHelper.updateOne(organisationId, config.mongo.tables.vulnerabilities,
          vulnerabilityQuery, newVulnerabilityFields).then(() => {
          }, (error) => {
            response.status(500);
            return response.jsend.fail(['The following error occured: ' + error]);
          });
      } else {
        newHistoryFields['history.$.reject_reason'] = fieldsToUpdate.reject_reason;
      }
      // Let's update the history object
      return mongoHelper.updateMany(organisationId, config.mongo.tables.vulnerabilities,
        vulnerabilityQuery, { $set: newHistoryFields }).then(() => {
          response.status(200);
          response.jsend.success([]);
        }, (error) => {
          response.status(500);
          response.jsend.fail(['The following error occured: ' + error]);
        });
    });
}

module.exports = {
  updateHistory
};

var express = require('express');
var config = require('config');
var paginationHelper = require('../helpers/db/pagination');
var apiParametersHelper = require('../helpers/api/parameters');
var mapperHelper = require('../helpers/mapper');
var reportsModel = require('../models/reports');
var organisationModel = require('../models/organization');
var mongoObjectId = require('mongodb').ObjectID;
var apiValidators = require('../helpers/api/validators');
var vulnerabilityModel = require('../models/vulnerability');
var dbSortingHelper = require('../helpers/db/sorting');
var _ = require('lodash');
var mongo = require('../helpers/mongo');
var modelHelper = require('../helpers/models');
const reportConfigurableHelper = require('../helpers/report-configurable');
const reportFormatHtml = 'html';
const Promise = require('bluebird');
const fs = require('fs');
const servicesHelper = require('../helpers/services');
const constantErrors = require('../helpers/constant-errors');

const router = express.Router();

/**
 * Add readFileAsync function in fs object
 * @param {Object} report - downloadable report object
 * @return {Object} return the promise
 */
fs.readFileAsync = function (report) {
  const reportFileName = reportConfigurableHelper.getFileLocation(report.report_path
    + '/' + report.report_name + '.' + reportFormatHtml);

  return new Promise((resolve, reject) => {
    try {
      fs.readFile(reportFileName, (err) => {
        if (err) {
          resolve(null);
        } else {
          resolve(report);
        }
      });
    } catch (err) {
      // Do nothing.
    }
  });
};

/**
 * Get List of downloadable report promise
 * @param {Object[]} reports - List of downloadable report objects
 * @return {Object[]} return the List of downloadable report promise
 */
function getDownloadableReports(reports) {
  const filePromises = [];

  reports.forEach((report) => {
    filePromises.push(fs.readFileAsync(report));
  });

  return Promise.all(filePromises);
}

/**
 * @api {get} /api/v1/organisations/:organisation_id/reports/:report_id?expand=vulnerabilities
 *  Get report for organisation
 * @apiVersion 1.0.0
 * @apiName GetReport
 * @apiGroup Reports
 *
 * @apiParam {Number} organisation_id Organisation ID
 * @apiParam {Number} report_id Report ID
 * @apiParam {Number} [expand] Includes vulnerabilities if required
 *
 * @apiSuccess {Object} report The requested report
 *
 * @apiSuccessExample Successful request:
 {
   "status": "success",
   "data": {
     "report": {
       "id": "58c5351bbe601713e41082c6",
       "nessus_report_id": 35,
       "report_name": "Website scan",
       "scanner_name": "Local scanner",
       "location": {
         "name": "San Francisco"
       },
       "target": "192.168.20.29",
       "vulnerabilities": [
         {
           "id": "58b67ef22b69950065366673",
           "name": "WMI QuickFixEngineering (QFE) Enumeration",
           "severity": 0,
           "count": 1
         },
         {
           "id": "58b67ef22b69950065366674",
           "name": "Windows Product Key Retrieval",
           "severity": 0,
           "count": 1
         }
       ],
       "archived": true,
       "date_archived": "2017-06-24T07:10:04.000Z",
            "downloadable_reports": [
                {
                "_id": "597f25ff7209a948f03900b2",
                "report_ids": [
                "58c5351bbe601713e41082c6",
                "597f162ebf2fbc44fbea2230"
              ],
          "report_name": "20th_July_2017_to_23rd_July_2017_generated_at_31st_July_2017_12:43PM.pdf",
          "report_path": "./reports/downloads/organisations/2/",
          "utc_time": "2017-07-31T12:43:43.476Z"
            }
          
     }
   }
 }
 */
/*
 * Exposes the report to the API
 */
function getReport(req, res) {
  var organisationId = req.params.id;
  var reportId = req.params.reportId;

  // Create a query cursor
  var reportPromise = reportsModel.getById(organisationId, reportId);

  reportPromise.then(function (report) {
    // Map the report to return
    var reportToReturn = mapperHelper.map(report, reportsModel.mapApi);

    // Find downloadable reports for current report ID
    mongo.find(organisationId, config.mongo.tables.downloadableReports, { report_ids: reportId })
      .then(function (reportsCursor) {
        // order-by latest
        const orderByParameter = { utc_time: -1 };
        reportsCursor.sort(orderByParameter);

        reportsCursor.toArray(function (err, downloadableReports) {

          reportToReturn.downloadable_reports = downloadableReports;

          // Check if we need to include vulnerabilities
          if (apiParametersHelper.hasExpand(req, 'vulnerabilities')) {
            // Query Mongo for the vulnerabilities
            vulnerabilityModel.vulnerability().getByReportId(organisationId, reportId, {}, null,
              req.decoded.user_type).then(function (queryCursor) {
                queryCursor.toArray().then(function (vulnerabilities) {
                  // Map the vulnerabilities to return and add to return object
                  var vulnerabilitiesToReturn = mapperHelper.mapObjects(vulnerabilities,
                    vulnerabilityModel.vulnerability().mapApi);
                  reportToReturn.vulnerabilities = vulnerabilitiesToReturn;

                  res.jsend.success({
                    report: reportToReturn
                  });
                });
              });
          } else {
            res.jsend.success({
              report: reportToReturn
            });
          }

        });
      });
  });
}

/**
 * @api {get} /api/v1/organisations/:id/reports?scan-type=ad-hoc...
 *  Get reports for organisation
 * @apiVersion 1.0.0
 * @apiName GetReports
 * @apiGroup Reports

 * @apiParam {String} id ID for the organisation
 * @apiParam {String} [scan-type] type of scans i.e (Ad-hoc, monthly, quaterly,semi-annual,annual)
 * @apiParam {String} [report-type] type of reports i.e (preliminary, finalised)
 * @apiParam {String} [start-date] Start date to start searching from (in seconds since 1970)
 * @apiParam {String} [end-date] End date to start searching from (in seconds since 1970).
 *  Must be more recent than the start-date
 * @apiParam {Number} [archived] Set to `1` to get only archived reports (older than 36 months).
 *  Set to `0` to get only active reports. Leave empty to get both
 * @apiSuccess {Object[]} reports List of reports
 *
 * @apiSuccessExample Successful request:
 *  {
  "status": "success",
  "data": {
    "reports": [
      {
        "archived": true,
        "date_archived": "2017-06-24T07:10:04.000Z"
        "id": "58c5351bbe601713e41082c6",
        "nessus_report_id": 35,
        "report_name": "Website scan",
        "scanner_name": "Local scanner",
        "location": {
          "name": "San Francisco"
        },
        "target": "192.168.20.29",
        "utc_time_created": "2017-06-24T07:10:04.000Z"
      },
      {
        "archived": false,
        "id": "58c5351bbe601713e41082c5",
        "nessus_report_id": 27,
        "name": "Vulnerabilities",
        "scanner_name": "Local scanner",
        "location": {
          "name": "San Francisco"
        },
        "target": "192.168.20.29",
        "utc_time_created": "2017-06-24T07:10:04.000Z"
      },
      {
        "archived": false,
        "id": "58c5351bbe601713e41082c7",
        "nessus_report_id": 40,
        "name": "Basic Network scans",
        "scanner_name": "Local scanner",
        "location": {
          "name": "San Francisco"
        },
        "target": "192.168.20.29",
        "utc_time_created": "2017-06-24T07:10:04.000Z"
      },
      {
        "archived": false,
        "id": "58c5351bbe601713e41082c8",
        "nessus_report_id": 44,
        "name": "Basic Network with two IP",
        "scanner_name": "Local scanner",
        "location": {
          "name": "San Francisco"
        },
        "target": "192.168.20.29",
        "utc_time_created": "2017-06-24T07:10:04.000Z"
      }
    ]
  }
}
 */

function getReports(req, res) {
  var scanScheduleRequested = apiParametersHelper.getQueryParameter(req, 'scan-type');
  var reportRequested = apiParametersHelper.getQueryParameter(req, 'report-type');
  var startDate = apiParametersHelper.getQueryParameter(req, 'start-date');
  var endDate = apiParametersHelper.getQueryParameter(req, 'end-date');
  var archived = apiParametersHelper.getQueryParameter(req, 'archived');
  var organisationId = req.params.id;
  var queryParams = {};
  var startToEndDateQueryParam;
  var andParameters = [];
  var paginatedReportsCursor = null;
  var sortingOptions = apiParametersHelper.extractSortingParameters(req);
  var pp = apiParametersHelper.extractPaginationParameters(req);
  var startDateISO = null;
  var endDateISO = null;
  var utcTimeCheckCondition;

  var orDeleteParameters = [
    {
      'is_delete_approved': false
    },
    {
      'is_delete_approved': {
        $exists: false
      }
    }
  ]; // to exclude deleted reports

  queryParams['$or'] = orDeleteParameters;

  // create filter object based on start-date & end-date
  if (startDate && endDate) {
    startDateISO = modelHelper.convertMillisecondsToISOString(startDate);
    endDateISO = modelHelper.convertMillisecondsToISOString(endDate);

    startToEndDateQueryParam = {
      $gte: startDateISO,
      $lte: endDateISO
    };
  }

  // Check if we need to filter out preliminary reports for customers
  if (req.decoded.user_type === config.user_type.Customer) {
    andParameters.push({
      report_type: config.globals.reportType.finalised.value
    });
    utcTimeCheckCondition = reportsModel.queryArchived(queryParams, false);
    andParameters.push(utcTimeCheckCondition);
  } else if (archived !== null) {
    // Check if we're querying for archived reports
    if (parseInt(archived, 10) === 1) {
      utcTimeCheckCondition = reportsModel.queryArchived(queryParams, true);
    } else if (parseInt(archived, 10) === 0) {
      utcTimeCheckCondition = reportsModel.queryArchived(queryParams, false);
    }

    andParameters.push(utcTimeCheckCondition);
  }

  // add date-filter to filter Array
  if (startDate !== null && endDate !== null) {
    andParameters.push({
      utc_time: startToEndDateQueryParam
    });
  }

  // add regex for scan-type to filter Array
  if (scanScheduleRequested) {
    andParameters.push({
      'scan_type': scanScheduleRequested
    });
  }

  // add report-type to filter Array
  if (reportRequested !== null) {
    andParameters.push({
      report_type: reportRequested
    });
  }

  // Build the query with the given parameters
  if (andParameters.length === 1) {
    var queryObject = andParameters[0];

    _.forOwn(queryObject, function (value, key) {
      queryParams[key] = value;
    });

  } else if (andParameters.length > 1) {
    queryParams['$and'] = andParameters;
  }

  reportsModel.countReports(organisationId, queryParams).then((countCursor) => {
    if (countCursor) {
      countCursor.toArray(function (err, countArr) {
        var totalRecords = 0;
        if (countArr !== null && countArr.length > 0) {
          totalRecords = countArr[0].total_records;
        }

        // Get the reports
        reportsModel.find(organisationId, queryParams).then(function (reportsCursor) {
          var mongoSortingOptions = {};

          // Sort if required
          if (Object.keys(sortingOptions).length > 0) {
            mongoSortingOptions = dbSortingHelper.convertOrderByToMongo(sortingOptions);
          } else {
            // By default, sorting based on utc_time/descending
            mongoSortingOptions = dbSortingHelper.convertOrderByToMongo({ utc_time: 'desc' });
          }

          paginatedReportsCursor = reportsCursor.sort(mongoSortingOptions);

          // Paginate
          paginatedReportsCursor = paginationHelper.mongo(paginatedReportsCursor, pp.itemsPerPage,
            pp.pageNumber);

          // Run the query and convert to array
          paginatedReportsCursor.toArray(function (reportsError, reports) {
            // Map the reports
            var flattenedReportScans = reportsModel.flattenReportScans(reports);
            var reportsToSend = mapperHelper.mapObjects(flattenedReportScans, reportsModel.mapApi);

            res.jsend.success({
              reports: reportsToSend,
              totalRecords
            });
          });
        });
      });
    } else {
      res.status(422);
      res.jsend.fail(['No reports found']);
    }
  }).catch((err) => {
    res.status(422);
    res.jsend.fail(['No reports found']);
  });
}

/**
 * @api {patch} /api/v1/organisations/:id/reports/:reportId? Update report for organisation
 * @apiVersion 1.0.0
 * @apiName UpdateReport
 * @apiGroup Reports

 * @apiParam (URL) {String} id ID for the organisation
 * @apiParam (URL) {String} reportId ID for the report
 * @apiParam (JSON) {String} report_type Type of report (`finalised` or `preliminary`)
 * @apiParam (JSON) {Boolean} is_delete_approved Approval status for report deletion (`true` or `false`)
 * @apiParam (JSON) {String} delete_rejected_reason Reason for rejecting report deletion
 * @apiParam (JSON) {String} delete_approved_reason Reason for approving report deletion
 * @apiSuccess {Object[]} count of updated documents
 *
 * @apiSuccessExample Successful request:
 {
  "status": "success",
  "data": {
    "report": {
      "_id": "58cfcc0ff0ce350947752821",
      "report_name": "Org_2__March 13, 2017 1:01 PM",
      "scan_id": 5,
      "history_id": 7,
      "last_modification_date": 1489410070,
      "delete_approved_reason": "valid delete",
      "is_delete_approved": false,
      "vulnerabilities": [
        22869,
        42088,
        10263,
        45432,
        42087,
        48243,
        11936,
        64582
      ],
      "report_type": "finalised"
    }
  }
}
*/
function updateReport(req, res) {
  var fieldsToSet = apiParametersHelper.getWritableParameters(req, reportsModel.writableFields);
  var queryParams = { _id: mongoObjectId(req.params.reportId) };
  var orgId = req.params.id;
  var queryPromise = null;

  if (!_.isEmpty(fieldsToSet)) {
    queryPromise = mongo.updateOne(orgId, config.mongo.tables.reports, queryParams,
      fieldsToSet);

    queryPromise.then(function (result) {
      var organisationPromise = null;
      var responseObj = null;

      if (result === null) {
        res.status(500);
        res.jsend.fail(['Update failed']);
      } else {
        organisationPromise = organisationModel.organization().getOrganizationById(orgId);

        organisationPromise.then(function (organisation) {
          // return current object
          responseObj = mongo.findOne(req.params.id, config.mongo.tables.reports, queryParams,
            {});
          responseObj.then(function (docs) {
            if (docs && docs.scan_id) {
              mongo.findOne(req.params.id, config.mongo.tables.scans, { 'tenable_scan_id': docs.scan_id },
                {}).then(function (scan) {
                  // Map the reports

                  if (scan.schedule && scan.schedule.timezone) {
                    docs['timeZone'] = scan.schedule.timezone;
                  }

                  var reportsToSend = mapperHelper.map(docs, reportsModel.mapApi);
                  var scanName = reportsModel.getTenableReportName(organisation.name, docs);

                  reportsToSend.name = scanName;
                  if (reportsToSend) {
                    res.jsend.success({
                      report: reportsToSend
                    });
                  } else {
                    res.jsend.success({
                      report: {}
                    });
                  }
                }).catch(function (error) {
                  res.status(422);
                  res.jsend.fail(['Update failed. Unable to get scan']);
                });
            } else {
              res.status(422);
              res.jsend.fail(['Update failed. Unable to get report']);
            }
          });
        });
      }
    });
  } else {
    res.status(422);
    res.jsend.fail(['Update failed. Nothing to update.']);
  }
}
/**
 * Validates the parameters for repots fitlers
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function.
 */
const validateReportsParameters = async (req, res, next) => {
  const supportedTypes = await servicesHelper.getServicesSlugs(true);

  if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
    let startDate = null;
    let endDate = null;
    let organisationId = null;

    req.checkParams('id', 'Organisation ID is required').notEmpty();
    req.checkParams('id', 'Organisation ID must be an integer').isInt();


    startDate = apiParametersHelper.getQueryParameter(req, 'start-date');
    endDate = apiParametersHelper.getQueryParameter(req, 'end-date');
    organisationId = req.params.id;

    req.getValidationResult().then(function (result) {
      if (!result.isEmpty()) {
        res.status(422);
        res.jsend.fail({
          validation: result.array()
        });
      } else {
        // Check the start and end dates are valid if set
        if (startDate !== null && endDate !== null) {
          req.checkQuery('start-date',
            'Scan date must be an integer (the number of seconds since 1970)').isInt();
          req.checkQuery('end-date',
            'Scan date must be an integer (the number of seconds since 1970)').isInt();
        } else if (startDate === null && endDate !== null) {
          res.status(422);
          res.jsend.fail({
            validation: 'start-date must be specified'
          });
        } else if (startDate !== null && endDate === null) {
          res.status(422);
          res.jsend.fail({
            validation: 'end-date must be specified'
          });
        }
        next();
      }
    });
  } else {
    res.status(422);
    res.jsend.fail([constantErrors.organizationService.supportedTypesNotAvailable]);
  }
}
/**
 * Validates the parameters to Update Reports
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function.
 */
const validateReportUpdateParameters = async (req, res, next) => {
  const supportedTypes = await servicesHelper.getServicesSlugs(true);

  if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
    let organisationId = null;

    req.checkParams('id', 'Organisation ID is required').notEmpty();
    req.checkParams('id', 'Organisation ID must be an integer').isInt();
    req.checkParams('reportId', 'Report ID is required').notEmpty();
    req.checkParams('reportId', 'Report ID is not valid').isMongoId();

    organisationId = req.params.id;

    req.getValidationResult().then(function (result) {
      if (!result.isEmpty()) {
        res.status(422);
        res.jsend.fail({
          validation: result.array()
        });
      } else {
        next();
      }
    });
  } else {
    res.status(422);
    res.jsend.fail([constantErrors.organizationService.supportedTypesNotAvailable]);
  }
}

/**
 * @api {delete} /api/v1/organisations/:organisation_id/reports/:report_id
 *  Delete a report
 * @apiVersion 1.0.0
 * @apiName DeleteReport
 * @apiGroup Reports
 *
 * @apiParam {Number} organisation_id Organisation ID
 * @apiParam {Number} report_id Report ID
 *
 * @apiSuccess {Object} report The requested report
 *
 * @apiSuccessExample Success response:
 {
   "status": "success",
   "data": [
      "Successfully deleted the report"
   ]
 }
 * @apiErrorExample Error response:
 {
   "status": "fail",
   "data": [
      "Failed to delete the report"
   ]
 }
 */
/*
 * Exposes the report to the API
 */
function deleteReport(req, res) {
  var organisationId = req.params.id;
  var reportId = req.params.reportId;

  // Create a delete promise
  var reportPromise = reportsModel.deleteReport(organisationId, reportId);

  reportPromise.then(function (report) {
    res.jsend.success(['Successfully deleted the report']);
  }).catch(function (error) {
    res.status(422);
    res.jsend.fail(['Failed to delete the report']);
  });
}


module.exports = {
  router,
  getReports,
  getReport,
  validateReportsParameters,
  updateReport,
  validateReportUpdateParameters,
  deleteReport
};

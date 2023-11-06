var express = require('express');
var config = require('config');
var orgModel = require('../models/organization');
var scanModel = require('../models/scan');
var vulnerabilityModel = require('../models/vulnerability');
var modelsHelper = require('../helpers/models');
var apiParametersHelper = require('../helpers/api/parameters');
var mongo = require('../helpers/mongo');
var mapperHelper = require('../helpers/mapper');
var mapperDBHelper = require('../helpers/db/mapper');
var organisationModel = require('../models/organization');
var reportsModel = require('../models/reports');
var mongoObjectId = require('mongodb').ObjectID;
var dbSortingHelper = require('../helpers/db/sorting');
var cityModel = require('../models/city');
let tenableHelper = require('../helpers/tenable');
var _ = require('lodash');
var moment = require('moment');
var paginationHelper = require('../helpers/db/pagination');
const Promise = require('bluebird');
const Sequelize = require('sequelize');
const servicesHelper = require('../helpers/services');
const constantErrors = require('../helpers/constant-errors');
const caching = require('../middleware/api-cache')._get;
const router = express.Router();

let getRuleForMonthlyScans = (rrule, currentDay) => {
  let monthDay = tenableHelper.TENABLE_MONTH_BY_PREFIX + currentDay;

  return rrule + ';' + monthDay;
};

let getRuleForWeeklyScans = (rrule, currentDay, week_day) => {
  let weekDay = tenableHelper.TENABLE_DAY_BY_PREFIX;
  weekDay += week_day ? week_day : tenableHelper.TENABLE_WEEK_DAYS[currentDay];

  return rrule + ';' + weekDay;
};

let getRepeatRules = (frequency, rrule, dayObject = new Date(), week_day, interval) => {
  if (frequency === tenableHelper.LAUNCH_DURATION_DAILY) {
    let rruleObject = rrule;
    rruleObject += ';';
    rruleObject += parseInt(interval) > 0 ? 'INTERVAL=' + parseInt(interval) : tenableHelper.LAUNCH_FREQUENCY_INTERVAL_ONE;
    return rruleObject;
  } else if (frequency === tenableHelper.LAUNCH_DURATION_MONTHLY || frequency === tenableHelper.LAUNCH_DURATION_QUARTERLY || frequency === tenableHelper.LAUNCH_DURATION_SEMI_ANNUAL) {
    return getRuleForMonthlyScans(rrule, dayObject.getDate());
  } else if (frequency === tenableHelper.LAUNCH_DURATION_ANNUAL) {
    return getRuleForMonthlyScans(tenableHelper.LAUNCH_FREQUENCY_ANNUAL, dayObject.getDate());
  } else if (frequency === tenableHelper.LAUNCH_DURATION_WEEKLY) {
    let rruleObject = rrule;
    rruleObject += ';';
    rruleObject += parseInt(interval) > 0 ? 'INTERVAL=' + parseInt(interval) : tenableHelper.LAUNCH_FREQUENCY_INTERVAL_ONE;
    return getRuleForWeeklyScans(rruleObject, dayObject.getDay(), week_day);
  } else if (frequency === tenableHelper.LAUNCH_DURATION_ONETIME) {
    return '';
  }

  return rrule;
};

/**
* Update scan in mongo
* @param {Object} req - The Standard ExpressJS request variable.
* @param {Object} res - The Standard ExpressJS response variable.
* @param {Integer} organisationId - ID for the given organisation.
* @param {String} queryParams - query parameters for the mongo.
* @param {String} fieldsToSet - properties to be updated by query.
*/
let executeTenableUpdate = async (req, res, organisationId, queryParams, fieldsToSet) => {
  const supportedTypes = await servicesHelper.getServicesSlugs(true);

  if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
    let currentStatePromiseObj = mongo.findOne(req.params.id, config.mongo.tables.scans,
      queryParams, {});

    currentStatePromiseObj.then((currentStateObj) => {
      let updateScanResult = mongo.updateOne(organisationId, config.mongo.tables.scans, queryParams, fieldsToSet);
      let scanObjectPromise = null;

      updateScanResult.then((result) => {
        if (result === null) {
          res.status(404);
          res.jsend.fail(['Update failed']);
        } else {

          // Get the Scan
          scanObjectPromise = mongo.findOne(req.params.id, config.mongo.tables.scans,
            queryParams, {});

          scanObjectPromise.then(function (scanObject) {
            orgModel.organization().getServiceCredentialData(organisationId,
              supportedTypes.VM.short).then(function () {

                // get the schedule launch and rrules
                let scanSchedule = apiParametersHelper
                  .getScanScheduleParamsFormatted(req.body.schedule);
                let scanStartTime = req.body.schedule.start_schedule_time;
                let scanName = req.body.scanName;

                if (scanStartTime.split('T')[1].length === 5) {
                  scanStartTime += '0';
                }

                let ipsList = '';

                fieldsToSet.targets.map((target) => {
                  if (ipsList.length > 0) {
                    ipsList += ', ';
                  }
                  ipsList += target.host;
                });

                let paramsToTenable = {
                  name: scanName,
                  schedule: {
                    enabled: "true",
                    start: "TZID=" + req.body.schedule.timezone + ':' + scanStartTime,
                    repeatRule: getRepeatRules(fieldsToSet.schedule.frequency, scanSchedule.rrule, new Date(fieldsToSet.schedule.start_time_utc), fieldsToSet.schedule.week_day, fieldsToSet.schedule.interval),
                    type: "ical"

                  },
                  ipList: ipsList
                };

                tenableHelper.requestTenable(organisationId, 'scan/' + scanObject.tenable_scan_id, {}, 'PATCH', paramsToTenable, (tenableError, scanData) => {
                  if (scanData) {
                    res.jsend.success({
                      scan: scanData
                    });
                  } else {
                    let rollBackUpdate = mongo.updateOne(organisationId, config.mongo.tables.scans,
                      queryParams, currentStateObj);
                    rollBackUpdate.then(function () {
                      const errorMessage = tenableError && tenableError.error_msg ? (constantErrors.tenable.updateFail + ': ' + tenableError.error_msg) : constantErrors.tenable.updateFail;
                      console.log(errorMessage);
                      res.status(404);
                      res.jsend.fail(['Failed to update scan. Please try again.']);
                    });
                  }
                });
              });
          });
        }
      });
    });
  } else {
    res.status(422);
    res.jsend.fail([constantErrors.organizationService.supportedTypesNotAvailable]);
  }
};

/**
 * @api {get} /api/v1/organisations/:id/scans/:scanID get Detail of a Scan
 * @apiVersion 1.0.0
 * @apiName getScan
 * @apiGroup Scan Schedule
 *
 * @apiParam {Number} id Unique ID of the organisation
 * @apiParam {Number} scanID Unique ID of the scan
 * @apiSuccess {Object} updated Scan
 * @apiSuccessExample {json} Success response
 {
     "scanId":5  ,
     "schedule": {
         "timezone": "Europe/Stockholm",
         "start_time": "20170327T170000",
         "start_time_utc": "2017-03-27T13:00:00.000Z",
         "frequency": "daily",
         "interval": 7,
         "by_day": "monday"
     },
     "targets": [
           {
             "host": "192.1.1.1",
             "coordinates": {
               "long": 123.444444444,
               "lat": 123.444444444
             }
           }
         ],
         "scanner": {
          "id": 1,
          "name": "scanner name"
        },
        "locked": true
 }
 */

/**
  * Function returning scanDetails for scanID.
  * @param {Object} req - The Standard ExpressJS request variable.
  * @param {Object} res - The Standard ExpressJS response variable.
*/
const getScanDetails = async (req, res) => {
  const supportedTypes = await servicesHelper.getServicesSlugs(true);

  if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {

    let organisationId = req.params.id;
    let queryParams = {
      _id: mongoObjectId(req.params.scanID)
    };
    // Get the scan
    let scanQueryPromise = mongo.findOne(organisationId, config.mongo.tables.scans, queryParams);

    scanQueryPromise.then((scan) => {
      orgModel.organization().getServiceCredentialData(organisationId,
        supportedTypes.VM.short).then((vmConfig) => {
          // Map the scan
          let scanToSend = mapperHelper.map(scan, scanModel.scan().mapApi);

          // Check if the user can edit this scan
          if (scanToSend.schedule !== null) {
            scanToSend.locked = !scanModel.canEditScan(scanToSend.schedule.start_time_utc);
          } else {
            scanToSend.locked = false;
          }
          res.jsend.success({
            scan: scanToSend
          });
        });
    });
  } else {
    res.status(422);
    res.jsend.fail([constantErrors.organizationService.supportedTypesNotAvailable]);
  }
};



/**
* Validate parameter of the endpoint.
* @param {Object} req - The Standard ExpressJS request variable.
* @param {Object} res - The Standard ExpressJS response variable.
* @param {Object} next - The Standard ExpressJS next variable.
* @return {json} Error on failure or call next function.
*/
var validateOraganizationId = function (req, res, next) {
  req.checkParams('id', 'Organisation ID must be an Integer').isInt();

  req.getValidationResult().then(function (result) {
    if (!result.isEmpty()) {
      res.jsend.error({ code: 422, message: result.array() });
      return;
    }
    // Check this organisation exists
    orgModel.organization().getOrganizationById(req.params.id)
      .then(function (organisation) {
        if (organisation) {
          next();
        } else {
          res.status(404);
          res.jsend.fail(['No organisation with this ID found']);
        }
      });
  });
};

/**
* Validate scanID parameter of the endpoint.
* @param {Object} req - The Standard ExpressJS request variable.
* @param {Object} res - The Standard ExpressJS response variable.
* @param {Object} next - The Standard ExpressJS next variable.
* @return {json} Error on failure or call next function.
*/
var validateScanId = function (req, res, next) {
  req.checkParams('scanID', 'Scan ID must be an integer').isInt();
  req.getValidationResult().then(function (result) {
    if (!result.isEmpty()) {
      res.jsend.error({ code: 422, message: result.array() });
    } else {
      next();
    }
  });
};

/**
* Validate patch to scan schedule parameter of the endpoint.
* @param {Object} req - The Standard ExpressJS request variable.
* @param {Object} res - The Standard ExpressJS response variable.
* @param {Object} next - The Standard ExpressJS next variable.
* @return {json} Error on failure or call next function.
*/
var validateScanScheduleParams = function (req, res, next) {
  req.checkParams('scanID', 'scanID is required').notEmpty();
  req.checkParams('scanID', 'scanID is not valid').isMongoId();
  // validate body parameters
  if (Object.keys(req.body).length !== 0) {
    if (Object.prototype.hasOwnProperty.call(req.body, 'scanner')) {
      if (Object.prototype.hasOwnProperty.call(req.body.scanner, 'name')) {
        req.checkBody('scanner.name', 'scanner.name must not be empty').notEmpty();
      } else {
        res.status(422);
        res.jsend.fail(['scanner.name must be specified.']);
      }
      if (Object.prototype.hasOwnProperty.call(req.body.scanner, 'id')) {
        req.checkBody('scanner.id', 'scanner.id must not be empty').isInt();
      } else {
        res.status(422);
        res.jsend.fail(['scanner.id must be specified.']);
      }
    } else {
      res.status(422);
      res.jsend.fail(['scanner must be specified.']);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'schedule')) {
      if (Object.prototype.hasOwnProperty.call(req.body.schedule, 'timezone')) {
        req.checkBody('schedule.timezone', 'timezone must not be empty').notEmpty();
      } else {
        res.status(422);
        res.jsend.fail(['schedule.timezone must be specified.']);
      }
      if (Object.prototype.hasOwnProperty.call(req.body.schedule, 'start_time')) {
        req.checkBody('schedule.start_time', 'start_time must not be empty').notEmpty();
      } else {
        res.status(422);
        res.jsend.fail(['schedule.start_time must be specified.']);
      }
      if (Object.prototype.hasOwnProperty.call(req.body.schedule, 'start_time_utc')) {
        req.checkBody('schedule.start_time_utc', 'start_time_utc must not be empty').notEmpty();
      } else {
        res.status(422);
        res.jsend.fail(['schedule.start_time_utc must be specified.']);
      }
      if (Object.prototype.hasOwnProperty.call(req.body.schedule, 'frequency')) {
        req.checkBody('schedule.frequency', 'frequency must not be empty').notEmpty();
      }
    } else {
      res.status(422);
      res.jsend.fail(['schedule must be specified.']);
    }
  }

  req.getValidationResult().then(function (result) {
    if (!result.isEmpty()) {
      res.jsend.error({
        code: 422,
        message: result.array()
      });
    } else if (Object.keys(req.body).length !== 0 &&
      Object.prototype.hasOwnProperty.call(req.body, 'schedule')) {
      if (Object.prototype.hasOwnProperty.call(req.body.schedule, 'frequency')) {
        if (Object.prototype.hasOwnProperty.call(config.globals.launchDuration,
          req.body.schedule.frequency)) {
          next();
        } else {
          res.status(422);
          res.jsend.fail(['frequency is not valid.']);
        }
      }
    } else {
      next();
    }
  });
};

/**
 * @api {get} /api/v1/scans/timezones Request list of timezones
 * @apiVersion 1.0.0
 * @apiName GetListOfTimezones
 * @apiGroup Scan Schedule
 *
 * @apiSuccess {Object} timezones Array of timezones object
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *    {
 *      "status": "success",
 *      "data": {
 *        "timezones": [
 *        {
 *          "name": "(UTC) Casablanca",
 *          "value": "Morocco Standard Time"
 *        },
 *        {
 *          "name": "(UTC) Coordinated Universal Time",
 *          "value": "UTC"
 *        },
 *        .
 *        .
 *        .
 *        {
 *          "name": "(UTC-12:00) International Date Line West",
 *          "value": "Dateline Standard Time"
 *        }
 *      ]
 *    }
*/

/**
  * Function representing to get Timezones.
  * @param {Object} req - The Standard ExpressJS request variable.
  * @param {Object} res - The Standard ExpressJS response variable.
  */
function getTimezone(req, res) {
  /**
    * Get the List of Timezones from Tenable SC.
    * @return {Object} Promise response.
    */

  tenableHelper.requestTenableAsAdmin('system?fields=timezones', {}, 'GET', {}, (tenableError, tenableTimeZones) => {

    try {
      tenableTimeZones = JSON.parse(tenableTimeZones);
    } catch (e) {
      //Do nothing.
    }

    if (tenableTimeZones && tenableTimeZones.response && tenableTimeZones.response.timezones && tenableTimeZones.response.timezones.length > 0) {
      res.jsend.success({ timezones: tenableTimeZones.response.timezones });
    } else {
      res.jsend.error({ code: 500, message: 'Unable to fetch timezones' });
    }
  });
}


/**
 * @api {get}
 *  /api/v1/organisations/:id/scans?scan-type=ad-hoc&limit=1&sort-by=-schedule.start_time_utc
 *  Request list of scans
 * @apiVersion 1.0.0
 * @apiName GetListOfScans
 * @apiGroup Scan Schedule
 *
 * @apiParam (Query) {String} [scan-type]  type of scans i.e (Ad-hoc, monthly, quaterly,
 *  semi-annual,annual)
 * @apiParam {String} [start-date] Start date to start searching from (in seconds since 1970)
 * @apiParam {String} [end-date] End date to start searching from (in seconds since 1970).
 * @apiParam (Query) {Number} [limit] Number of items to return if using pagination
 * @apiParam (Query) {String} [sort-by] Sorting options separated by commas for multiple fields.
 *  E.g. `sort-by=-schedule.start_time_utc`. Use a minus symbol to denote decending sorting.
 *  Sorting by any returned field is supported
 * @apiParam (Query) {String} [expand] Get all reports linked to a scan. E.g. `expand=reports`
 * @apiSuccess {Object}  Array of scan objects object
 * @apiSuccessExample {json} Response:
 {
  "status": "success",
  "data": {
    "scans": [
      {
        "name": "dubai.com",
        "repeat_rules": "FREQ=ONETIME",
        "schedule": {
          "timezone": "Europe/Stockholm",
          "start_time": "20170327T170000",
          "start_time_utc": "2017-03-27T13:00:00.000Z",
          "frequency": "daily",
          "interval": 7,
          "by_day": "monday"
        },
        "locked": false
      },
      {
        "name": "android.com",
        "repeat_rules": "ONETIME",
        "schedule": {
          "timezone": "Europe/Stockholm",
          "start_time": "20170327T170000",
          "start_time_utc": "2017-03-27T13:00:00.000Z",
          "frequency": "daily",
          "interval": 7,
          "by_day": "monday"
        }
        ,"targets" : [
       {
        "host" : "192.1.1.1",
        "coordinates" : {
          "long" : 123.444444444,
          "lat" : 123.444444444
           }
       }
     ]
     ,"scanner": {
      "id": 1,
      "name": "scanner name"
       },
        "locked": false
      },
      {
        "name": "amazon.com",
        "repeat_rules": "FREQ=ONETIME",
        "schedule": {
          "timezone": "Europe/Stockholm",
          "start_time": "20170327T170000",
          "start_time_utc": "2017-03-27T13:00:00.000Z",
          "frequency": "daily",
          "interval": 7,
          "by_day": "monday"
        }
        ,"targets" : [
       {
        "host" : "192.1.1.1",
        "coordinates" : {
          "long" : 123.444444444,
          "lat" : 123.444444444
           }
       }
     ]
     ,"scanner": {
      "id": 1,
      "name": "scanner name"
       },
        "locked": true
      }
    ]
  }
}
*/

/**
  * Function to get list of scans.
  * @param {Object} req - The Standard ExpressJS request variable.
  * @param {Object} res - The Standard ExpressJS response variable.
  */
const getScanList = (req, res) => {
  const organisationId = req.params.id;
  const organisationPromise = organisationModel.organization().getOrganizationById(organisationId);

  // Get sorting and pagination options
  const sortingOptions = apiParametersHelper.extractSortingParameters(req);
  const pp = apiParametersHelper.extractPaginationParameters(req);
  const startDate = apiParametersHelper.getQueryParameter(req, 'start-date');
  const endDate = apiParametersHelper.getQueryParameter(req, 'end-date');
  const startFrom = apiParametersHelper.getQueryParameter(req, 'start-from');
  const endTo = apiParametersHelper.getQueryParameter(req, 'end-to');
  const scanName = apiParametersHelper.getQueryParameter(req, 'scan-name');

  let [queryParams, isCustomer, countOfScans, queryParamsForReport, queryParamsForScan, archivedDateStart, startDateISO, endDateISO] = [{}, false, null, {}, [], {}, null, null];

  if (req.query['scan-type']) {
    queryParams = {
      'schedule.frequency': req.query['scan-type']
    };
  }

  if (scanName) {
    queryParams = { name: { $regex: new RegExp(scanName), $options: 'i' } };
  }

  //filters for reports customer side
  // create filter object based on start-date & end-date
  if (startDate && endDate) {
    startDateISO = modelsHelper.convertMillisecondsToISOString(startDate);
    endDateISO = modelsHelper.convertMillisecondsToISOString(endDate);
  }

  //filters for scans name admin side
  // create filter object based on scan start-from & end-to
  if (startFrom && endTo) {
    startFromISO = modelsHelper.convertMillisecondsToISOString(startFrom);
    endToISO = modelsHelper.convertMillisecondsToISOString(endTo);

    if (startFromISO && endToISO) {
      queryParamsForScan = [
        {
          'schedule.start_time_utc': { $gte: startFromISO, $lte: endToISO }
        }
      ]
      queryParams['$and'] = queryParamsForScan;
    }
  }

  const orDeleteParameters = [
    {
      'is_tenable_deleted': false
    },
    {
      'is_tenable_deleted': {
        $exists: false
      }
    }
  ]; // to exclude deleted reports

  queryParams['$or'] = orDeleteParameters;

  countOfScans = mongo.count(req.params.id, config.mongo.tables.scans, queryParams, {});

  countOfScans.then((totalRecords) => {
    // expand to return reports
    if (apiParametersHelper.hasExpand(req, 'reports')) {
      archivedDateStart = moment()
        .subtract(config.globals.reports.monthsUntilArchived, 'months').toISOString();

      // Check if customer
      isCustomer = (req.decoded.user_type === config.user_type.Customer);
      if (isCustomer) {
        // Filter out preliminary & archived reports
        queryParamsForReport = {
          $and: [{
            $eq: ['$$report.report_type', config.globals.reportType.finalised.value]
          },
          { $gte: ['$$report.utc_time', archivedDateStart] }]
        };
      } else {
        // Only filter archived reports
        queryParamsForReport = {
          $and: [{
            $gte: ['$$report.utc_time', archivedDateStart]
          }]
        };
      }

      if (startDateISO && endDateISO) {
        queryParamsForReport.$and.push({ $gte: ['$$report.utc_time', startDateISO] });
        queryParamsForReport.$and.push({ $lte: ['$$report.utc_time', endDateISO] });
      }

      mongo.collection(organisationId, config.mongo.tables.scans).then((scansCollection) => {
        let mongoSortingOptions = {};
        if (scansCollection) {
          let scanCursor = scansCollection.aggregate([{
            $lookup: {
              from: 'reports',
              localField: 'tenable_scan_id',
              foreignField: 'scan_id',
              as: 'reports'
            }
          }, {
            $match: queryParams
          }, {
            $project:
            {
              _id: 1,
              tenable_scan_id: 1,
              repeat_rules: 1,
              policy: 1,
              folder_id: 1,
              scanner: 1,
              uuid: 1,
              name: 1,
              scan_type: 1,
              schedule: 1,
              is_tenable_deleted: 1,
              reports: {
                $filter: {
                  input: '$reports',
                  as: 'report',
                  cond: queryParamsForReport
                }
              }
            }
          }
          ]);

          // Sort if required
          if (Object.keys(sortingOptions).length > 0) {
            mongoSortingOptions = dbSortingHelper.convertOrderByToMongo(sortingOptions);
            scanCursor.sort(mongoSortingOptions);
          }

          // Paginate
          if (req.query.limit) {
            scanCursor = paginationHelper.mongo(scanCursor, pp.itemsPerPage,
              pp.pageNumber);
          }

          scanCursor.toArray((err, scans) => {
            let mappedScans = {};
            const sortOrder = 'asc';
            let options = {};

            // loop through each scan
            _.each(scans, (scan) => {
              let flattenedReportScans = {};
              let reportsToSend = {};
              let i = 0;

              if (scan.reports) {
                // Check if we need to filter out preliminary reports for customers
                isCustomer = (req.decoded.user_type === config.user_type.Customer);

                // loop through each report to add scan
                for (i = scan.reports.length - 1; i >= 0; i -= 1) {
                  scan.reports[i].scan = scan;
                }
              }

              // Map the reports
              flattenedReportScans = reportsModel.flattenReportScans(scan.reports);

              reportsToSend = mapperHelper.mapObjects(flattenedReportScans, reportsModel.mapApi);
              scan.reports = reportsToSend;
            });

            // Map the scans
            mappedScans = scans && scans.length > 0 ? mapperHelper.mapObjects(scans, scanModel.scan().mapApi) : [];

            if (req.query['sort-by']) {
              options = req.query['sort-by'].split('=');

              if (options.length > 0) {
                if (options[0] === 'name') {
                  sortOrder = 'asc';
                } else if (options[0] === '-name') {
                  sortOrder = 'desc';
                }
                if (options[0] === 'name' || options[0] === '-name') {
                  mappedScans = _.orderBy(mappedScans, [scan => scan && scan.name ? scan.name.toLowerCase() : ''],
                    [sortOrder]);
                }
              }
            }
            res.jsend.success({
              scans: mappedScans,
              total_records: mappedScans.length
            });
          });
        } else {
          res.status(422);
          res.jsend.fail([constantErrors.scans.notAvailable]);
        }
      }).catch((err) => {
        console.log(err);
      });
    } else {
      organisationPromise.then(() => {
        // Get the Scans
        var responseObj = mongo.find(req.params.id, config.mongo.tables.scans, queryParams, {});

        responseObj.then((result) => {
          var scanObject = result;
          var mongoSortingOptions = {};

          // Sort if required
          if (Object.keys(sortingOptions).length > 0) {
            mongoSortingOptions = dbSortingHelper.convertOrderByToMongo(sortingOptions);
            scanObject.sort(mongoSortingOptions);
          }

          // Paginate
          scanObject = paginationHelper.mongo(scanObject, pp.itemsPerPage, pp.pageNumber);

          scanObject.toArray((err, docs) => {
            let options = null;
            const sortOrder = 'asc';
            let scansToSend = mapperHelper.mapObjects(docs, scanModel.scan().mapApi);

            if (req.query['sort-by']) {
              options = req.query['sort-by'].split('=');

              if (options.length > 0) {
                if (options[0] === 'name') {
                  sortOrder = 'asc';
                } else if (options[0] === '-name') {
                  sortOrder = 'desc';
                }
                if (options[0] === 'name' || options[0] === '-name') {
                  scansToSend = _.orderBy(scansToSend, [scan => scan && scan.name ? scan.name.toLowerCase() : ''],
                    [sortOrder]);
                }
              }
            }

            res.jsend.success({
              scans: scansToSend,
              total_records: totalRecords
            });
          });
        });
      });
    }
  });
}

/**
 * @api {get} /api/v1/organisations/:id/scans/:scanID/vulnerabilities?group-by=report
 *  Request vulnerabilities for a scan
 * @apiParam (Query) {String} [sort-by] Sorting options E.g.`sort-by=utc_time`,`sort-by=count`.
 *  Use a minus symbol to denote decending sorting
 * @apiParam (Query) {String} [group-by] group-by=report parameter will group vulnerabilities by
 *  report
 * @apiParam (Query) {String} [limit] limit number of records
 * @apiParam (Query) {String} [start-date] Start date to start searching from
 *  (in seconds since 1970)
 * @apiParam (Query) {String} [end-date] End date to start searching from (in seconds since 1970).
 * Must be more recent than the start-date
 * @apiVersion 1.0.0
 * @apiName GetListOfVulnerabiltiesForScan
 * @apiGroup Scan
 * @apiSuccessExample {json} Generic Success-Response:
 {
  "status": "success",
  "data": {
    "vulnerabilities": [
      {
        "id": "58e202a47d184727c35e9568",
        "name": "Service Detection",
        "severity": 0,
        "count": 3,
        "target": "google.com"
      },
      {
        "id": "58e202a47d184727c35e9575",
        "name": "HyperText Transfer Protocol (HTTP) Information",
        "severity": 0,
        "count": 2,
        "target": "google.com"
      }
    ]
  }
}
 * @apiSuccessExample {json} Group by report Success-Response:
 {
  "status": "success",
  "data": {
    reports": [
      {
        "utc_time": "2017-04-04T13:24:10.000Z",
        "total_vulnerabilities": 25,
        "vulnerabilities_type_count": {
          "info": 23,
          "low": 0,
          "medium": 2,
          "high": 0,
          "critical": 0
        }
      },
      {
        "utc_time": "2017-04-05T11:29:29.000Z",
        "total_vulnerabilities": 25,
        "vulnerabilities_type_count": {
          "info": 23,
          "low": 0,
          "medium": 2,
          "high": 0,
          "critical": 0
        }
      }
    ]
  }
}
*/

/**
  * Function to get list of vulnerabilities.
  * @param {Object} req - The Standard ExpressJS request variable.
  * @param {Object} res - The Standard ExpressJS response variable.
  */
function getGroupedVulnerabilities(req, res) {
  var organisationId = req.params.id;
  var scanId = req.params.scanID;
  var queryParams = {};
  var endDate;
  var startDate;
  var startToEndDateQueryParam;

  // Get sorting options
  var sortingOptions = apiParametersHelper.extractSortingParameters(req);
  var pp = apiParametersHelper.extractPaginationParameters(req);
  var mongoSortingOptions = {};
  var queryParamsForScanId = {
    _id: mongoObjectId(scanId)
  };

  // Create Mongo sorting object
  if (Object.keys(sortingOptions).length > 0) {
    mongoSortingOptions = dbSortingHelper.convertOrderByToMongo(sortingOptions);
  }

  // create filter object based on start-date & end-date
  if (req.query['start-date'] && req.query['end-date']) {
    startDate = modelsHelper.convertMillisecondsToISOString(req.query['start-date']);
    endDate = modelsHelper.convertMillisecondsToISOString(req.query['end-date']);
    startToEndDateQueryParam = {
      $gte: startDate,
      $lte: endDate
    };
  }

  mongo.findOne(organisationId, config.mongo.tables.scans, queryParamsForScanId, {}).then(
    function (scan) {
      var isCustomer = false;
      var scanWithVulnerabilitiesCount = null;
      var scanWithVulnerabilities = {};

      if (scan) {
        // Check for group-by parameter
        if (req.query['group-by'] && req.query['group-by'] === 'report') {
          // Add scan ID into query params
          _.extend(queryParams, { scan_id: scan.tenable_scan_id });

          // add date-filter to filter Array
          if (startDate && endDate) {
            _.extend(queryParams, { utc_time: startToEndDateQueryParam });
          }

          // Check if we need to filter out preliminary reports for customers
          isCustomer = (req.decoded.user_type === config.user_type.Customer);
          if (isCustomer) {
            _.extend(queryParams, { report_type: config.globals.reportType.finalised.value });
          }

          // Query the report/vulnerabilities collections
          mongo.collection(organisationId, config.mongo.tables.reports).then(
            function (reportCollection) {
              if (reportCollection) {
                var reportsObj = null;
                var aggregateArr = [];
                // aggregateArr.push({
                //   $lookup: {
                //     from: 'vulnerabilities',
                //     localField: 'scan_id',
                //     foreignField: 'tenable_scan_id',
                //     as: 'vulnerabiltiesArray'
                //   }
                // });
                aggregateArr.push({
                  $match: queryParams
                });

                // If there is sorting options, add them to the query object
                if (!_.isEmpty(mongoSortingOptions)) {
                  aggregateArr.push({
                    $sort: mongoSortingOptions
                  });
                }

                reportsObj = reportCollection.aggregate(aggregateArr);

                // Paginate
                reportsObj = paginationHelper.mongo(reportsObj, pp.itemsPerPage, pp.pageNumber);
                reportsObj.toArray().then(function (reports) {
                  // Iterate reports to create response objects
                  var promises = reports.map(function (report) {
                    return new Promise(function (resolve, reject) {
                      var reportObj = {};
                      var queryParameters = {};
                      var collectionPromise = null;

                      var vulnerabilityIds = report.vulnerabilities;
                      _.extend(queryParameters, { _id: { $in: vulnerabilityIds } });

                      // Filtering query to make sure, vulnerability or vulnerabilities having
                      //  "soft_deleted_at" will not visible to Customer
                      queryParameters = mongo.filteredQueryByUserType(queryParameters,
                        req.decoded.user_type);

                      // Get those vulnerabilities from Mongo!
                      collectionPromise = mongo.collection(organisationId,
                        config.mongo.tables.vulnerabilities);
                      collectionPromise.then(function (vulnerabilityCollection) {
                        if (vulnerabilityCollection) {
                          var aggregationQuery = [{
                            $match: queryParameters
                          }];
                          vulnerabilityCollection.aggregate(aggregationQuery).toArray().then(
                            function (vulnerabilities) {
                              reportObj.utc_time = report.utc_time;
                              reportObj.total_vulnerabilities = vulnerabilities.length;

                              reportObj.vulnerabilities_type_count =
                                vulnerabilityModel.vulnerability()
                                  .getVulnerabilityTypesCount(report.vulnerabilities,
                                    vulnerabilities);
                              resolve(reportObj);
                            });
                        } else {
                          reject(constantErrors.vulnerabilities.notAvailable);
                        }
                      });
                    });
                  });

                  Promise.all(promises).then((reportsData) => {
                    res.jsend.success({
                      reports: reportsData
                    });
                  });
                });
              } else {
                res.status(422);
                res.jsend.fail([constantErrors.reports.notAvailable]);
              }
            });
        } else {
          queryParams = {
            tenable_scan_id: scan.tenable_scan_id
          };

          // Filtering query to make sure, vulnerability or vulnerabilities having "soft_deleted_at"
          //  will not visible to Customer
          queryParams = mongo.filteredQueryByUserType(queryParams, req.decoded.user_type);

          // Query the scan/vulnerabilities collections
          scanWithVulnerabilitiesCount = mongo.count(req.params.id,
            config.mongo.tables.vulnerabilities, queryParams, {});

          scanWithVulnerabilitiesCount.then(function (totalRecords) {
            scanWithVulnerabilities = mongo.find(req.params.id,
              config.mongo.tables.vulnerabilities, queryParams, {});

            scanWithVulnerabilities.then(function (result) {
              var mappedVulnerabilities = {};
              var paginatedResult = null;

              // Sort if required
              if (Object.keys(sortingOptions).length > 0) {
                mongoSortingOptions = dbSortingHelper.convertOrderByToMongo(sortingOptions);
                result.sort(mongoSortingOptions);
              }

              // Paginate
              paginatedResult = paginationHelper.mongo(result, pp.itemsPerPage,
                pp.pageNumber);

              paginatedResult.toArray(function (err, vulnerabilities) {
                // Map the vulnerabilities to return
                mappedVulnerabilities = mapperHelper.mapObjects(vulnerabilities,
                  vulnerabilityModel.vulnerability().mapApi);
                res.jsend.success({
                  vulnerabilities: mappedVulnerabilities,
                  total_records: totalRecords
                });
              });
            });
          });
        }
      }
    });
}


/**
 * @api {get} /api/v1/scans/launch-duration Scan launch-duration.
 * @apiVersion 1.0.0
 * @apiName GetListOfScanGroups
 * @apiGroup Scan Schedule
 *
 * @apiSuccess {Object} duration Object of Duration
 * @apiSuccessExample {json} Success-Response:
 *   {
 *    "status": "success",
 *    "data": {
 *      "duration": {
 *        "ONETIME": "Ad-hoc",
 *        "MONTHLY": "Monthly",
 *        "MONTHLY;INTERVAL=3;": "Quaterly",
 *        "MONTHLY;INTERVAL=6;": "Semi Annual",
 *        "YEARLY": "Annual"
 *       }
 *    }
 *  }
*/

/**
  * Function representing to get Scan Groups or types or launch-duration.
  * @param {Object} req - The Standard ExpressJS request variable.
  * @param {Object} res - The Standard ExpressJS response variable.
  */
function getLaunchDuration(req, res) {
  var launchDuration = _.map(config.globals.launchDuration, function (value, key) {
    return {
      label: value.label,
      value: key
    };
  });
  res.jsend.success({ launchduration: launchDuration });
}

/**
 * @api {patch} /api/v1/organisations/:id/scans/:scanId Update a Scan
 * @apiVersion 1.0.0
 * @apiName updateScan
 * @apiGroup Scan Schedule
 *
 * @apiParam {Number} id Unique ID of the organisation
 * @apiParam {Number} scanID Unique ID of the scan
 * @apiParamExample {json} Example PATCH JSON:
 *
{
    "scanId":5  ,
    "schedule": {
        "timezone": "Europe/Stockholm",
        "start_time": "20170327T170000",
        "start_time_utc": "2017-03-27T13:00:00.000Z",
        "frequency": "daily",
        "interval": 7,
        "by_day": "monday"
    },
    "targets": [
          {
            "host": "192.2.1.1",
            "cityID":2
          }
        ],"scanner": {
         "id": 1,
         "name": "scanner name"
       }
}
 * @apiSuccess {Object} updated Scan
 * @apiSuccessExample {json} Success response
 {
    "_id" : ObjectId("58cfd590ce3bf109b5da45d3"),
    "nessus_scan_id" : 5,
    "repeat_rules" : "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
    "policy" : "Basic Network Scan",
    "folder_id" : 3,
    "scanner_name" : "Local Scanner",
    "uuid" : "4ec17d89-ecc7-10e7-2f08-55bb30a64947523eb6a08fcf6a21",
    "name" : "Scrint-Scan",
    "schedule": {
        "timezone": "Europe/Stockholm",
        "start_time": "20170327T170000",
        "start_time_utc": "2017-03-27T13:00:00.000Z",
        "frequency": "daily",
        "interval": 7,
        "by_day": "monday"
    },
    "targets": [
        {
            "host": "192.2.1.1",
            "coordinates": {
                "long": 123.444444444,
                "lat": 123.444444444
            },
          "city_name": "Ordino",
          "city_id": 2
        }
    ],
    "scanner": {
     "id": 1,
     "name": "scanner name"
   }
}
 */

/**
  * Function to update a scan for scanID.
  * @param {Object} req - The Standard ExpressJS request variable.
  * @param {Object} res - The Standard ExpressJS response variable.
*/
const updateTenableScan = (req, res) => {
  const scanId = req.params.scanID;
  const organisationId = req.params.id;
  let fieldsToSet = {};
  let queryParams = {
    _id: mongoObjectId(req.params.scanID)
  };

  // Check is target overlapping
  let targets = req.body.targets;
  let duplicatesTargets = _.difference(targets, _.uniqBy(targets, 'host'), 'host');
  if (duplicatesTargets.length > 0) {
    res.status(400);
    res.jsend.fail(['Duplicate Targets are not allowed while scheduling a scan']);
  }

  // Add validation for scan name
  let scan_name = req.body.scanName;
  if (scan_name === undefined || scan_name === null || scan_name === '' || scan_name.length < 1) {
    res.status(400);
    res.jsend.fail(['Scan name should not be blank']);
  }

  // Get the fields that we are allowed to update
  fieldsToSet = apiParametersHelper.getWritableParameters(req, scanModel.scan().writableFields);
  fieldsToSet.schedule.start_time = req.body.schedule.start_schedule_time;


  let responseObj = mongo.findOne(organisationId, config.mongo.tables.scans, { name: scan_name }, {});
  responseObj.then(function (result) {

    if (result !== null && (result.name !== scan_name)) {
      res.status(422);
      res.jsend.fail(['Scan name is already in use']);
    }

    fieldsToSet = _.extend(fieldsToSet, { name: req.body.scanName });
    // If we have some fields to set, update them
    if (!_.isEmpty(fieldsToSet)) {
      // Check if the scan schedule is valid and can be updated
      scanModel.scanIsValid(organisationId, scanId, fieldsToSet, (isScanOverlapped) => {
        if (!isScanOverlapped) {
          let startTimeUTC = 0;
          let queryArguments = {};
          let inParamsArr = [];

          // check if schedule object has start_time & timezone
          if (Object.prototype.hasOwnProperty.call(fieldsToSet, 'schedule') &&
            Object.prototype.hasOwnProperty.call(fieldsToSet.schedule, 'start_time') &&
            Object.prototype.hasOwnProperty.call(fieldsToSet.schedule, 'timezone')) {
            // convert start_time & timezone to ISO string
            startTimeUTC = moment(fieldsToSet.schedule.start_time).toISOString();
            fieldsToSet.schedule.start_time_utc = startTimeUTC;
          }

          if (Object.prototype.hasOwnProperty.call(fieldsToSet, 'targets')) {
            // filters city ids and returns in an array
            inParamsArr = _.map(fieldsToSet.targets, 'cityID');

            if (inParamsArr.length > 0) {
              queryArguments.where = { id: { [Sequelize.Op.in]: inParamsArr } };

              // Make a query to get cities from database
              cityModel.model.findAll(queryArguments).then(function (locations) {
                let mappedCities = {};
                let picked = {};

                if (locations.length === 0) {
                  res.status(422);
                  res.jsend.fail(['Location not set correctly']);
                } else {
                  mappedCities = mapperDBHelper.mapSequelizeObjects(locations, cityModel.mapApi);

                  _.each(fieldsToSet.targets, function (target) {
                    // Pick city data for current cityID
                    picked = _.filter(mappedCities, { id: target.cityID });

                    // Add coordinates object inside target object
                    target.coordinates = { long: picked[0].longitude, lat: picked[0].latitude };
                    target.city_name = picked[0].name;
                    target.city_id = target.cityID;
                    delete target.cityID;
                  });

                  executeTenableUpdate(req, res, organisationId, queryParams, fieldsToSet);
                }
              });
            } else {
              executeTenableUpdate(req, res, organisationId, queryParams, fieldsToSet);
            }
          } else {
            executeTenableUpdate(req, res, organisationId, queryParams, fieldsToSet);
          }
        } else {
          const erroMessage = isScanOverlapped === true ? 'Schedule time overlaps with another scan' : isScanOverlapped;
          res.status(422);
          res.jsend.fail([erroMessage]);
        }
      });
    } else {
      res.status(422);
      res.jsend.fail(['Update failed. Nothing to update.']);
    }
  });
}

router.get('/timezones', caching, getTimezone);
router.get('/launch-duration', getLaunchDuration);
module.exports = {
  router,
  validateOraganizationId,
  getScanList,
  getScanDetails,
  validateScanId,
  validateScanScheduleParams,
  getGroupedVulnerabilities,
  updateTenableScan
};

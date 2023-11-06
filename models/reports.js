const mongo = require('../helpers/mongo');
const MongoObjectId = require('mongodb').ObjectID;
const config = require('config');
const organisation = require('../models/organization');
const reportsConfigurable = require('../routes/reports-configurable');
const moment = require('moment');
const _ = require('lodash');
const Console = require('better-console');


// Array of fields to be mapped when responding to an API
var mapApi = {
  _id: 'id',
  id: 'nessus_report_id',
  report_name: 'report_name',
  scanner_name: 'scanner_name',
  location: 'location',
  target: 'target',
  report_type: 'report_type',
  utc_time: 'utc_time_created',
  scan_start: 'scan_start',
  scan_end: 'scan_end',
  delete_approved_reason: 'delete_approved_reason',
  is_delete_approved: 'is_delete_approved',
  archived(unused, reportObject) {
    var reportUtcTime = moment(reportObject.utc_time);
    var archivedDateStart = moment()
      .subtract(config.globals.reports.monthsUntilArchived, 'months').toISOString();
    var isArchived = reportUtcTime.isBefore(archivedDateStart);
    var archivedInformation = { archived: isArchived };

    // If it's archived, add the date it was archived
    if (isArchived) {
      archivedInformation.date_archived =
        reportUtcTime.add(config.globals.reports.monthsUntilArchived, 'months')
          .toISOString();
    }

    return archivedInformation;
  }
};

/**
 * Fields that can be written to
 * @type {Array}
 */
var writableFields = [
  'report_type',
  'is_delete_approved',
  'delete_approved_reason'
];

/**
 * Formats we will accept when generating reports
 * @type {Array}
 */
var reportFormats = [
  reportsConfigurable.reportFormatPdf
];

/**
 * The template options for downloadable reports
 * @type {Array}
 */
var reportTemplates = [
  'default'
];

/**
 * Flattens the complicated object we get back from Mongo when mixing report and scan
 * @param {Object} reportScan - The report/scan combo coming back from Mongo
 * @return {Object} - Flattened object we can use as normal
 */
var flattenReportScan = function (reportScan) {
  var flattenedReport = {
    _id: reportScan._id,
    report_name: reportScan.report_name,
    utc_time: reportScan.utc_time,
    scan_id: reportScan.scan_id,
    last_modification_date: reportScan.last_modification_date,
    history_id: reportScan.history_id,
    report_type: reportScan.report_type,
    folder_id: reportScan.scan.folder_id,
    scan_start: reportScan.scan_start,
    scan_end: reportScan.scan_end,
    vulnerabilities: reportScan.vulnerabilities
  };

  return flattenedReport;
};

/**
 * Check if report ID belongs to the particular Organisation
 * @param {Number} organisationId - ID of Organisation
 * @param {Number} reportId - ID of report
 * @return {Object} return the result of mongo.findOne
 */
var getById = function (organisationId, reportId) {
  // Query the report/scan collections
  return mongo.collection(organisationId, config.mongo.tables.reports)
    .then(function (reportCollection) {
      if (reportCollection) {
        return reportCollection.aggregate([{
          $lookup: {
            from: 'scans',
            localField: 'scan_id',
            foreignField: 'tenable_scan_id',
            as: 'scan'
          }
        },
        { $unwind: '$scan' },
        {
          $match: {
            _id: new MongoObjectId(reportId)
          }
        }
        ]).toArray().then(function (reportScan) {
          if (reportScan.length === 1) {
            return flattenReportScan(reportScan[0]);
          }
          return null;
        });
      } else {
        return null;
      }
    });
};

/**
 * Check if report ID belongs to the particular Organisation
 * @param {Number} organisationId - ID of Organisation
 * @param {Number} reportId - ID of report
 * @param {Boolean} includeVulnerabilities - True or false object that specifies whether to lookup vulnerabilities
 * @return {Object} return the result of mongo.findOne
 */
var find = function (organisationId, queryParameters = {}, includeVulnerabilities = false) {
  // Add the report ID to the query
  // queryParameters['_id'] = new mongoObjectId(reportId)

  // Query the report/scan collections
  return mongo.collection(organisationId, config.mongo.tables.reports)
    .then(function (reportCollection) {
      if (reportCollection) {
        let aggregateQuery = [
          {
            $lookup: {
              from: 'scans',
              localField: 'scan_id',
              foreignField: 'tenable_scan_id',
              as: 'scan'
            }
          },
          { $unwind: '$scan' },
          {
            $match: queryParameters
          }
        ];

        if (includeVulnerabilities) {
          aggregateQuery.push({
            $lookup: {
              from: config.mongo.tables.vulnerabilities,
              localField: 'vulnerabilities',
              foreignField: '_id',
              as: 'vulnerabilities'
            }
          });
        }

        return reportCollection.aggregate(aggregateQuery);
      } else {
        return null;
      }
    });
};

/**
 * Check if report ID belongs to the particular Organisation
 * @param {Number} organisationId - ID of Organisation
 * @param {Number} reportId - ID of report
 * @return {Object} return the result of mongo.findOne
 */
const countReports = (organisationId, queryParameters = {}) => {
  // count the no of reports
  return mongo.collection(organisationId, config.mongo.tables.reports)
    .then((reportCollection) => {
      if (reportCollection) {
        return reportCollection.aggregate([{
          $lookup: {
            from: 'scans',
            localField: 'scan_id',
            foreignField: 'tenable_scan_id',
            as: 'scan'
          }
        },
        { $unwind: '$scan' },
        {
          $match: queryParameters
        },
        {
          $count: 'total_records'
        }
        ]);
      } else {
        return null;
      }
    }).catch((err) => {
      console.log(err);
      return null;
    });
};

var flattenReportScans = function (reportScans) {
  return reportScans.map(function (reportScan) {
    return flattenReportScan(reportScan);
  });
};

/**
 * Function to return Scan report name.
*  @param {String} organisationName - Name of the organisation
 * @param {Object} scanDetails - Details of scan to generate name.
 * @return {String} - Scan Report name.
 */
const getTenableReportName = function (organisationName, scanDetails) {
  let orgName = _.join(_.split(_.startCase(_.toLower(_.trim(organisationName))), ' '), '_');
  let scanType = _.join(_.split(_.startCase(_.toLower(_.trim(scanDetails.type))), ' '), '_');
  let reportTime;

  if (scanDetails.timeZone) {
    reportTime = moment.unix(scanDetails.last_modification_date).tz(scanDetails.timeZone).format('MMM DD, YYYY');
  } else {
    reportTime = moment.unix(scanDetails.last_modification_date).format('MMM DD, YYYY');
  }

  let scanTime = formatDateForReport(scanDetails.scheduleDateTime);

  if (scanTime == null) {
    if (scanDetails.timeZone) {
      scanTime = moment.unix(scanDetails.scan_start).tz(scanDetails.timeZone).format('h:mm:ss A');
    } else {
      scanTime = moment.unix(scanDetails.scan_start).format('h:mm:ss A');
    }

  } else {
    if (scanDetails.timeZone) {
      scanTime = moment(scanTime).tz(scanDetails.timeZone).format('h:mm:ss A');
    } else {
      scanTime = moment(scanTime).format('h:mm:ss A');
    }

  }

  let reportName = orgName + '_' + scanType + '_' + reportTime + ' at ' + scanTime;

  return reportName;
};

function formatDateForReport(timeString) {
  if (timeString && timeString.length > 12) {
    let __year = timeString.substr(0, 4);
    let __month = timeString.substr(4, 2);
    let __date = timeString.substr(6, 2);
    let __hours = timeString.substr(9, 2);
    let __minutes = timeString.substr(11, 2);
    return __year + '-' + __month + "-" + __date + ' ' + __hours + ":" + __minutes;
  } else {
    return null;
  }
}

/**
 * Syncs the report to Mongo and inserts vulnerabilities if necessary
 * @param {String} organisationId - Unique Id of the Organization
 * @param {Object} parameters - This variable holding values like scan_id, report_type
 *, history_id and last_modification_date
 * @param {Array} vulnerabilities - Object of vulnerability data to assign to this report
 */
const syncReport = async (organisationId, parameters, vulnerabilities = {}) => {
  let tableNameReport = config.mongo.tables.reports;
  let tableNameScan = config.mongo.tables.scans;
  const reportResults = await mongo.findOne(organisationId, tableNameReport, { last_modification_date: parameters.last_modification_date, scan_id: parameters.scan_id });
  if (reportResults === null) {
    let addReportAndVulnerabilities = organisation.organization()
      .getOrganizationById(organisationId).then(function (organisationObject) {
        return mongo.findOne(organisationId, tableNameScan, { tenable_scan_id: parameters.scan_id })
          .then(function (result) {
            if (result) {
              // Build some scan details to create the report name
              let scanStartTime = 0;
              if (result.schedule) {
                scanStartTime = result.schedule.start_time;
              } else {
                if (result.scan_start) {
                  scanStartTime = moment(result.scan_start).format('h:mm A');
                }
              }

              let scanDetails = {
                type: result.scan_type,
                scheduleDateTime: scanStartTime,
                scan_start: parameters.scan_start,
                last_modification_date: parameters.last_modification_date
              };

              if (result.schedule && result.schedule.timezone) {
                scanDetails['timeZone'] = result.schedule.timezone;
              }

              // Build a report to insert
              let reportDocument = {
                report_name: getTenableReportName(result.name, scanDetails),
                report_type: config.globals.reportType.preliminary.value,
                scan_type: result.scan_type,
                scan_id: parameters.scan_id,
                // history_id: parameters.history_id,
                scan_start: parameters.scan_start,
                scan_end: parameters.scan_end,
                last_modification_date: parameters.last_modification_date,
                utc_time: moment.utc(parameters.last_modification_date, 'X').toISOString(),
                operating_system: parameters.operating_system
              };

              let scanDocument = {
                scan_start: parameters.scan_start,
                scan_end: parameters.scan_end,
              }

              let scanquery = { tenable_scan_id: parameters.scan_id };

              // @todo We need to figure out why we are including here
              var vulnerabilityModel = require('../models/vulnerability'); // eslint-disable-line

              // Sync the vulnerabilities for this report
              return vulnerabilityModel.vulnerability()
                .syncVulnerabilities(organisationId, vulnerabilities)
                .then(function (vulnerabilityIds) {
                  if (vulnerabilityIds && vulnerabilityIds.length > 0) {
                    var query;
                    Console.info('Inserted or checked vulnerabilities for org : ' + organisationId);

                    // Find
                    return mongo.findOne(organisationId, tableNameReport
                      , { last_modification_date: parameters.last_modification_date, scan_id: parameters.scan_id })
                      .then(async (report) => {
                        if (report === null) {
                          reportDocument.vulnerabilities = vulnerabilityIds;
                          try {
                            const reportsIndex = await mongo.createIndex(organisationId, tableNameReport, {
                              last_modification_date: 1,
                              scan_id: 1
                            });
                            if (reportsIndex && reportsIndex === 'last_modification_date_1_scan_id_1') {
                              return mongo.insert(organisationId, tableNameReport, reportDocument).then(function (insertedRecord) {
                                return Promise.resolve(insertedRecord);
                              }).catch(function (mongoConnectionError) {
                                return Promise.reject(mongoConnectionError);
                              });
                            }
                          } catch (e) {
                            const message = e && e.message ? e.message : 'Fail to  create an index'
                            console.log(message, 'reports index')
                          }
                        } else {
                          return Promise.resolve({});
                        }
                      }).catch(function (mongoConnectionError) {
                        return Promise.reject(mongoConnectionError);
                      });
                  } else {
                    return Promise.reject('Failed to fetch vulnerabilities...');
                  }
                }).catch(function (mongoConnectionError) {
                  return Promise.reject(mongoConnectionError);
                });
            }
          }).catch(function (mongoConnectionError) {
            return Promise.reject(mongoConnectionError);
          });
      });

    return addReportAndVulnerabilities.then(() => {
      // Find all the reports
      return mongo.find(organisationId, config.mongo.tables.reports, { scan_id: parameters.scan_id })
        .then(function (result) {
          return result.toArray().then(function (reportDocument) {
            let query;
            let set;
            let processedDocs = 0;
            let isMongoError = false;

            _.each(reportDocument, function (doc) {
              if (parameters.operating_system && doc.operating_system && parameters.operating_system !== doc.operating_system) {
                query = { _id: { $in: doc.vulnerabilities } };
                set = { $unset: { false_positive: '', security_exception: '' } };

                mongo.updateMany(organisationId, config.mongo.tables.vulnerabilities, query, set).then(function () {
                  processedDocs++;
                }).catch(function (jobError) {
                  processedDocs++;
                  isMongoError = true;
                });

                if (reportDocument.length === processedDocs) {
                  if (isMongoError === true) {
                    return Promise.reject("Error connecting to Mongo DB..!");
                  } else {
                    return Promise.resolve("Reports updated successfully.");
                  }
                }
              }
            });
          }).catch(function (jobError) {
            return Promise.reject(jobError);
          });
        }).catch(function (jobError) {
          return Promise.reject(jobError);
        });
    }).catch(function (jobError) {
      return Promise.reject(jobError);
    });
  } else {
    return Promise.resolve({});
  }
}


/**
 * Modifies the given query to add an archived filter to it
 * @param {Object} query - The query object to modify
 * @param {Boolean} archived - Set to true to get the archived reports, false to exclude them (i.e.
 *  only get those that aren't archived)
 * @param {Object} fieldName - attribute to check for archived condition
 * @returns {Object} The modified query object with the filter for archived reports
 */
function queryArchived(query, archived, fieldName = 'utc_time') {
  var archivedDateStart = moment()
    .subtract(config.globals.reports.monthsUntilArchived, 'months').toISOString();
  var utcTimeCheck;
  if (archived) {
    utcTimeCheck = { [fieldName]: { $lte: archivedDateStart } };
  } else {
    utcTimeCheck = { [fieldName]: { $gte: archivedDateStart } };
  }

  return utcTimeCheck;
}

/**
 * Gets the report immediately preceeding this report ID (so we can compare them)
 * @param {Number} organisationId The organisation ID for the given report
 * @param {String} reportId The report ID we want to get the previous one for
 * @returns {Object|null} Null if there is no report before this one, otherwise the previous report
 */
function getPreviousReport(organisationId, reportId) {
  // Get this ID
  return getById(organisationId, reportId).then(function (currentReport) {
    return mongo.collection(organisationId, config.mongo.tables.reports).then(
      function (collection) {
        const recentReportQuery = {
          scan_id: currentReport.scan_id,
          utc_time: { $lt: moment(currentReport.utc_time).toISOString() }
        };

        // count the no of reports
        return collection.find(recentReportQuery).sort({ utc_time: -1 }).limit(1).next()
          .then(
            function (moreRecentReport) {
              return moreRecentReport;
            });
      });
  });
}

/**
 * Given two reports, this function separates out those repeated vulnerabilities and returns
 *  the stats on them
 * @param {Number} organisationId - Organisation ID for the given reports
 * @param {Object} currentReport The most recent report
 * @param {Object} previousReport The previous report to compare to the most recent report
 * @returns {Object} Summarised statistics on the report repeats
 */
function extractRepeatedInformation(organisationId, currentReport, previousReport) {
  // Convert all the vulnerability IDs into strings for comparisons
  const currentVulnerabilities = currentReport.vulnerabilities.map(function (vulnerabilityId) {
    return vulnerabilityId.toString();
  });
  const previousVulnerabilities = previousReport.vulnerabilities.map(function (vulnerabilityId) {
    return vulnerabilityId.toString();
  });

  // Do the magic to get the repeats and non-repeats
  const notRepeatedVulnerabilities = _.difference(previousVulnerabilities, currentVulnerabilities);
  const newVulnerabilities = _.difference(currentVulnerabilities, previousVulnerabilities);
  const repeatedVulnerabilityIds = _.intersection(previousVulnerabilities, currentVulnerabilities);

  // Now we have a list of the repeated vulnerabilities, let's see which ones were marked
  //  as PCD, and that they were reopened
  return mongo.collection(organisationId, config.mongo.tables.vulnerabilities).then(
    function (collection) {
      const repeatedMongoIds = mongo.convertIdsToMongoIds(repeatedVulnerabilityIds);

      // Get the repeated vulnerability objects
      return collection.find({ _id: { $in: repeatedMongoIds } }).toArray().then(
        function (repeatedVulnerabilities) {
          let repeatedVulnerabilityWithPcdCount = 0;
          let repeatedVulnerabilityWithNoPcdCount = 0;

          // Loop through the repeated vulnerabilities and check what types
          //  they are
          _.each(repeatedVulnerabilities, function (repeatedVulnerability) {
            // @todo We need to figure out why we are including here
            var vulnerabilityModel = require('../models/vulnerability'); // eslint-disable-line

            const vulnerabilityType =
              vulnerabilityModel.getVulnerabilityType(repeatedVulnerability);

            if (vulnerabilityType === vulnerabilityModel.vulnerabilityTypeProposedClosedResume) {
              // System says that the most recent item is a resumed PCD. Check to see
              //  that the PCD history object occured after the last scan date
              const mostRecentHistoryObject = vulnerabilityModel
                .getMostRecentHistoryItem(repeatedVulnerability);
              const pcdHistoryTime = moment(mostRecentHistoryObject.updated_at);

              // The time the report was run won't exactly line up with the times that the
              //  vulnerabilities were udpated, so we're going 1 hour either side to pick up
              //  any changes
              const previousReportTime = moment(previousReport.utc_time).subtract(1, 'hour');
              const currentReportTime = moment(currentReport.utc_time).add(1, 'hour');

              // If the PCD was resumed after the previous scan
              if (pcdHistoryTime.isAfter(previousReportTime) &&
                pcdHistoryTime.isBefore(currentReportTime)) {
                repeatedVulnerabilityWithPcdCount += 1;
              }
            } else if (vulnerabilityType === null) {
              repeatedVulnerabilityWithNoPcdCount += 1;
            }
          });

          const repeatCounts = {
            repeatedSinceLastScan: repeatedVulnerabilities.length,
            notRepeatedInLastScan: notRepeatedVulnerabilities.length,
            repeatedSinceLastScanPcd: repeatedVulnerabilityWithPcdCount,
            newVulnerabilitiesSinceLastScan: newVulnerabilities.length,
            repeatedVulnerabilityWithNoPcd: repeatedVulnerabilityWithNoPcdCount
          };

          return repeatCounts;
        });
    });
}

/**
 * Delete a report by id
 * @param {Number} organisationId - ID of Organisation
 * @param {Number} reportId - ID of report
 * @return {Object} return the promise of mongo.updateOne
 */
var deleteReport = function (organisationId, reportId) {
  // Delete the report
  var queryObject = {
    _id: new MongoObjectId(reportId)
  };

  return mongo.updateOne(organisationId, config.mongo.tables.reports, queryObject, { 'is_deleted': true });
};

module.exports = {
  getById,
  mapApi,
  getTenableReportName,
  writableFields,
  reportFormats,
  reportTemplates,
  syncReport,
  find,
  flattenReportScans,
  countReports,
  queryArchived,
  getPreviousReport,
  extractRepeatedInformation,
  deleteReport
};

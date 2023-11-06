const express = require('express');
const router = express.Router();
const Sequelize = require('sequelize');
const config = require('config');
const Promise = require('bluebird');
const moment = require('moment');
const _ = require('lodash');
const MongoObjectId = require('mongodb').ObjectID;
const underscore = require('underscore');
const paginationHelper = require('../helpers/db/pagination');
const apiParametersHelper = require('../helpers/api/parameters');
const mapperHelper = require('../helpers/mapper');
const dbSortingHelper = require('../helpers/db/sorting');
const mongo = require('../helpers/mongo');
const modelsHelper = require('../helpers/models');
const slaHelper = require('../helpers/sla');
const organisationModel = require('../models/organization');
const reportsModel = require('../models/reports');
const orgServicesModel = require('../models/org-service');
const vulnerabilityModel = require('../models/vulnerability').vulnerability();
const vulnerabilityModelFile = require('../models/vulnerability');
const models = require('../db_models');
const usersAPIHelper = require('../helpers/api/users');
const hasProperty = require('../helpers/general').hasProperty;
const snmpTrap = require('../helpers/snmp-trap');
const roleAccessHelper = require('../helpers/role-access');
const modelHelper = require('../helpers/models');
const constantErrors = require('../helpers/constant-errors');
const servicesHelper = require('../helpers/services');
const { filterByAttributeQuery, performActionOnVulnerabilities } = require('../models/vulnerabilty-data');
const chartDataModel = require('../models/vm-chart-data');
const dbOperation = require('../models/organization');
const { once, EventEmitter } = require('events');
const eventObject = new EventEmitter();
let chartProcessState = {};

const getChartDataForScanEfficiency = (result, scanDomains) => {
  let scanEfficiencyByScanDomain = [];
  let resultData = [];

  if (result && result.length > 0) {
    _.each(result, (resultObject) => {
      resultData = resultData.concat(resultObject.vulnerabilities)
    });
  }
  resultData = _.groupBy(resultData, 'target');

  Object.keys(scanDomains).map(domain => {

    if (scanDomains[domain][0] && scanDomains[domain][0].scan_domain) {
      let info = { domain: scanDomains[domain][0].scan_domain, nodes: 0, efficiency: 0 };
      let availableNodesCount = scanDomains[domain][0].targets.length;
      let activeNodesCount = getActiveNodesCount(scanDomains[domain][0].targets, resultData);
      info.nodes = activeNodesCount;
      info.efficiency = (activeNodesCount / availableNodesCount) * 100 + "%";
      scanEfficiencyByScanDomain.push(info);
    }

  });
  return scanEfficiencyByScanDomain;
};

/**
 *
 * @param result
 * @returns {Array}
 */
const getChartDataForAverageTimeTaken = () => {
  return [
    { date: 'Aug-19', critical: 42, high: 43, medium: 42, low: 42, info: 37 },
    { date: 'Sep-19', critical: 64, high: 64, medium: 49, low: 19, info: 0 },
    { date: 'Oct-19', critical: 78, high: 78, medium: 79, low: 78, info: 79 },
    { date: 'Nov-19', critical: 31, high: 31, medium: 31, low: 0, info: 0 },
  ];
};


/**
 *
 * @param resultpus
 * @returns {Array}
 */
const getChartDataForMoM = () => {
  return [
    { month: 'Aug-19', critical: 6, high: 4, medium: 0, low: 0, info: 0 },
    { month: 'Sep-19', critical: 5, high: 0, medium: 6, low: 0, info: 0 },
    { month: 'Oct-19', critical: 0, high: 3, medium: 0, low: 0, info: 0 },
    { month: 'Nov-19', critical: 8, high: 2, medium: 3, low: 0, info: 0 },
  ];
};

/**
 *
 * @param result
 * @returns {Array}
 */
const getChartDataForRemediationTrendSummary = () => {
  return [
    {
      month: 'Sep-19',
      CSTotalVul: 7682, CSExpectedCount: 0, CSTotalCount: 0, CSUnExpectedCount: 87,
      PSTotalVul: 4074, PSExpectedCount: 290, PSTotalCount: 290, PSUnExpectedCount: 164,
      IPTotalVul: 4864, IPExpectedCount: 0, IPTotalCount: 0, IPUnExpectedCount: 114,
      RANTotalVul: 3709, RANExpectedCount: 0, RANTotalCount: 4, RANUnExpectedCount: 253,
      OSSTotalVul: 3247, OSSExpectedCount: 0, OSSTotalCount: 0, OSSUnExpectedCount: 628,
      TelenorTotalVul: 10, TelenorExpectedCount: 0, TelenorTotalCount: 0, TelenorUnExpectedCount: 0
    },
    {
      month: 'Oct-19',
      CSTotalVul: 8868, CSExpectedCount: 0, CSTotalCount: 0, CSUnExpectedCount: 95,
      PSTotalVul: 3874, PSExpectedCount: 0, PSTotalCount: 3, PSUnExpectedCount: 212,
      IPTotalVul: 2496, IPExpectedCount: 0, IPTotalCount: 1034, IPUnExpectedCount: 2812,
      RANTotalVul: 3562, RANExpectedCount: 0, RANTotalCount: 0, RANUnExpectedCount: 432,
      OSSTotalVul: 3757, OSSExpectedCount: 0, OSSTotalCount: 66, OSSUnExpectedCount: 184,
      TelenorTotalVul: 10, TelenorExpectedCount: 0, TelenorTotalCount: 0, TelenorUnExpectedCount: 0
    },
    {
      month: 'Nov-19',
      CSTotalVul: 7125, CSExpectedCount: 0, CSTotalCount: 0, CSUnExpectedCount: 1864,
      PSTotalVul: 4774, PSExpectedCount: 343, PSTotalCount: 216, PSUnExpectedCount: 448,
      IPTotalVul: 2463, IPExpectedCount: 0, IPTotalCount: 0, IPUnExpectedCount: 1092,
      RANTotalVul: 3572, RANExpectedCount: 0, RANTotalCount: 0, RANUnExpectedCount: 229,
      OSSTotalVul: 3772, OSSExpectedCount: 0, OSSTotalCount: 0, OSSUnExpectedCount: 235,
      TelenorTotalVul: 10, TelenorExpectedCount: 0, TelenorTotalCount: 0, TelenorUnExpectedCount: 0
    }];
};

/**
 *
 * @param result
 * @returns {Array}
 */
const getChartDataForgetVulnerabilitiesClosure = () => {
  return [
    {
      month: 'Aug-19',
      totalVulnerabilities: 19280,
      expectedCount: 4377,
      totalCount: 6750,
      unexpectedCount: 2373,
    },
    {
      month: 'Sep-19',
      totalVulnerabilities: 23586,
      expectedCount: 12500,
      totalCount: 13800,
      unexpectedCount: 1300,
    },
    {
      month: 'Oct-19',
      totalVulnerabilities: 22567,
      expectedCount: 14000,
      totalCount: 18000,
      unexpectedCount: 4000,
    },
    {
      month: 'Nov-19',
      totalVulnerabilities: 22216,
      expectedCount: 12000,
      totalCount: 18000,
      unexpectedCount: 6000,
    }
  ];
};


const getActiveNodesCount = (availableNodes, incomeNodes) => {
  let availableNodesArray = availableNodes.map(a => a.host);
  let incomeNodesArray = Object.keys(incomeNodes);
  let matchedNodesArray = [];
  incomeNodesArray.map(income => {
    if (availableNodesArray.indexOf(income) !== -1) {
      matchedNodesArray.push(income);
    }
  });
  return matchedNodesArray.length

};

let getClosedWithinAndOutOfSLAChartData = (result, slasForVulnerabilties) => {
  let resultData = [];
  let closedWithinSla = [];
  let closedOutOfSla = [];

  if (result && result.length > 0) {

    _.each(result, (resultObject) => {
      if (resultObject.reports) {
        resultObject.reports.utc_time_modified = moment(new Date(resultObject.reports.utc_time)).format('MMM-YY');
      }
    });

    let groupedByDate = _.groupBy(result, 'reports.utc_time_modified');

    _.forOwn(groupedByDate, (value, key) => {
      if (value && value[0] && value[0].reports) {
        let utctime = value[0].reports.utc_time;
        let month = moment(utctime).format('MMM-YY');
        let DateString = month;
        let criticalCount = 0;
        let criticalCountOutSLA = 0;
        let HighCount = 0;
        let HighCountOutSLA = 0;
        let mediumCount = 0;
        let mediumCountOutSLA = 0;
        let lowCount = 0;
        let lowCountOutSLA = 0;
        let totalVulnerabilityArray = [];

        _.each(value, (groupedData) => {
          totalVulnerabilityArray = totalVulnerabilityArray.concat(groupedData.vulnerabilities);
        });

        if (totalVulnerabilityArray.length > 0) {
          _.each(totalVulnerabilityArray, (vulnerabilityObject) => {
            if (vulnerabilityObject.severity > 0 && vulnerabilityObject['history'] && vulnerabilityObject['history'].length > 0) {
              const slaDays = vulnerabilityModelFile.getSlaDaysBySeverityNumber(
                slasForVulnerabilties.data, vulnerabilityObject.severity);

              if (slaHelper.wasVulnerabilityClosedWithinSLA(vulnerabilityObject, slaDays, utctime)) {
                if (vulnerabilityObject.severity === 4) {
                  criticalCount++;
                }
                if (vulnerabilityObject.severity === 3) {
                  HighCount++;
                }
                if (vulnerabilityObject.severity === 2) {
                  mediumCount++;
                }
                if (vulnerabilityObject.severity === 1) {
                  lowCount++;
                }
              }

              if (slaHelper.wasVulnerabilityClosedOutsideSla(vulnerabilityObject, slaDays, utctime)) {
                if (vulnerabilityObject.severity === 4) {
                  criticalCountOutSLA++;
                }
                if (vulnerabilityObject.severity === 3) {
                  HighCountOutSLA++;
                }
                if (vulnerabilityObject.severity === 2) {
                  mediumCountOutSLA++;
                }
                if (vulnerabilityObject.severity === 1) {
                  lowCountOutSLA++;
                }
              }
            }
          });

          closedWithinSla.push({
            Date: DateString,
            Critical: criticalCount,
            High: HighCount,
            Low: lowCount,
            Medium: mediumCount
          });

          closedOutOfSla.push({
            Date: DateString,
            Critical: criticalCountOutSLA,
            High: HighCountOutSLA,
            Low: lowCountOutSLA,
            Medium: mediumCountOutSLA
          });
        }
      }
    });
  }

  resultData.push({ 'Closed Within SLA': closedWithinSla });
  resultData.push({ 'Closed Out of SLA': closedOutOfSla });

  return resultData;
};

let getBasicVulnerabilityInfo = function (vulnerabilities, paginationParameter) {
  const vulnerabilityInfo = {
    vulnerabilities: [],
    vulnerabilities_count: 0
  };

  const groupedByName = _.groupBy(vulnerabilities, 'name');

  _.forOwn(groupedByName, (groupedVulnerability) => {
    vulnerabilityInfo['vulnerabilities_count']++;
  });

  const groupedByTargets = _.groupBy(vulnerabilities, 'target');

  _.forOwn(groupedByTargets, (vulnerabilitiesArray, target) => {
    const targetObject = { target, severity: {}, total: 0, groupCount: 0 };
    targetObject.groupCount = getGroupedVulnerabilityCount(vulnerabilitiesArray);
    targetObject.total = vulnerabilitiesArray && vulnerabilitiesArray.length;
    const groupedBySeverity = _.groupBy(vulnerabilitiesArray, 'severity');

    _.forOwn(groupedBySeverity, (groupedVulnerabilities, severity) => {
      targetObject.severity[severity] = groupedVulnerabilities.length;
    });

    vulnerabilityInfo.vulnerabilities.push(targetObject);

  });

  vulnerabilityInfo['total_records'] = vulnerabilityInfo.vulnerabilities.length;

  vulnerabilityInfo.vulnerabilities = paginationHelper.paginateArray(vulnerabilityInfo.vulnerabilities, paginationParameter.itemsPerPage, paginationParameter.pageNumber);

  return vulnerabilityInfo;
};

let getGroupedVulnerabilityCount = function (vulnerabilities) {
  let groupedCount = 0;

  let groupedVulnerabilities = _.groupBy(vulnerabilities, 'name');

  _.forOwn(groupedVulnerabilities, (vulnerability) => {
    groupedCount++;
  });

  return groupedCount;
};

let addPortProtocol = function (vulnerabilities) {
  vulnerabilities.forEach((vulnerability) => {
    vulnerability['port_protocol'] = vulnerability.port;
  });

  return vulnerabilities;
};
/**
 * @api {get} /api/v1/organisations/:id/reports/:reportId/vulnerabilities
  Requesting vulnerabilities
 * @apiVersion 1.0.0
 * @apiName GetVulnerabilities
 * @apiGroup Vulnerability
 *
 * @apiParam (URL) {String} id Organisation ID
 * @apiParam (URL) {String} reportId Report ID
 * @apiParam (Query) {Number} [false-positives] Filter by false-positive. Use `false-positives=0`
 *  for not false-positive and `false-positives=1` for active false-positive vulnerabilities
 * @apiParam (Query) {Number} [has-exception] Filter those with or without exception Use
 *  `has-exception=0` for no exception and `has-exception=1` for vulnerabilities with an active
 *  exception
 * @apiParam (Query) {Number} [proposed-close-date] Filter those with or without proposed close
 *  date Use `proposed-close-date=0` for vulnerabilities with no proposed close date and
 *  `proposed-close-date=1` for vulnerabilities with a proposed close date
 * @apiParam (Query) {Number} [page] The page number if using pagination
 * @apiParam (Query) {Number} [limit] Number of items to return if using pagination
 * @apiParam (Query) {String} [sort-by] Sorting options separated by commas for multiple
 * @apiParam (Query) {Number} [severity] filter vulnerabilities based on severity
 * @apiParam (Query) {String} [group-by] Groups vulnerabilities by the given field.
 *  E.g. `target-location`, `date-day`, `date-week`, `date-month`, `date-year`,
 *  `target-location,severity`
 *
 * @apiSuccess {Object[]} List of vulnerabilities
 *
 * @apiSuccessExample Successful generic response:
 {
  "status": "success",
  "data": {
    "vulnerabilities": [
      {
        "id": "59243be4d7291a004256b69f",
        "name": "Time of Last System Startup",
        "severity": 0,
        "count": 2,
        "target": "139.59.76.82",
        "created_utc_time": "2017-05-30T09:58:42.000Z"
      },
      {
        "id": "59243be4d7291a004256b6a0",
        "name": "System Information Enumeration (via DMI)",
        "severity": 0,
        "count": 2,
        "target": "139.59.76.82",
        "created_utc_time": "2017-05-30T09:58:42.000Z"
      },
      {
        "id": "59243be4d7291a004256b6a1",
        "name": "SSL Cipher Block Chaining Cipher Suites Supported",
        "severity": 0,
        "count": 2,
        "target": "139.59.76.82",
        "created_utc_time": "2017-05-30T09:58:42.000Z"
      },
      {
        "id": "59243be4d7291a004256b6a3",
        "name": "SSL Certificate Information",
        "severity": 3,
        "count": 2,
        "created_utc_time": "2017-05-30T09:58:42.000Z",
        "false_positive": {
          "reason": "reason for false positive"
        },
        "target": "139.59.76.82",
        "history": [
          {
            "action": "type_change",
            "timestamp": "2017-06-06T12:30:15.059Z",
            "updatedBy": 1,
            "previousValues": {
              "false_positive": null
            },
            "newValues": {
              "false_positive": {
                "reason": "reason for false positive"
              }
            }
          }
        ]
      }
    ],
    "total_records": 4,
    "false_positives_count": 1,
    "security_exceptions_count": 0,
    "proposed_close_date_count": 1,
    "statistics": [
      {
      "severity": {
        "0": 3,
        "3": 1
      }
      },
      {
        "target": {
          "maxTarget": {
            "139.59.76.82": 100
          },
          "minTarget": {
            "139.59.76.82": 100
          }
        }
      },
      {
        "name": {
          "maxName": {
            "SSL Certificate Information": 100
          },
          "minName": {
            "SSL Certificate Information": 100
          }
        }
      },
      {
        "count": {
          "maxCount": {
            "2": 100
          },
          "minCount": {
            "2": 100
          }
        }
      },
      {
        "location": {
          "maxLocation": {
            "Dubai": 100
          },
          "minLocation": {
            "Dubai": 100
          }
        }
      }
    ]
  }
}
 * @apiSuccessExample Group by target-location response:
{
  "status": "success",
  "data": {
    "targets": {
      "zabbix.scrint.se": {
        "vulnerabilities": [
          {
            "id": "58d25eab36f948003c6f909f",
            "nessus_scan_id": 5,
            "severity": 0,
            "count": 1
          },
          {
            "id": "58d25eab36f948003c6f90a0",
            "nessus_scan_id": 5,
            "severity": 0,
            "count": 1
          },
          {
            "id": "58d25eab36f948003c6f90a1",
            "nessus_scan_id": 5,
            "severity": 0,
            "count": 1
          }
        ],
        "coordinates": {
          "long": 1.59756,
          "lat": 42.5676
        }
    }
}
}
}
 */
const getVulnerabilities = async (req, res) => {
  const supportedTypes = await servicesHelper.getServicesSlugs(true);

  if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
    // Load the report
    let reportId = req.params.reportId;
    let organisationId = req.params.id;
    let proposedCloseDateInt;
    let proposedCloseDate;
    let severity;
    let filterHasException;
    let filterFalsePositive;
    let groupByArr;
    let groupField;

    // Get sorting and pagination options
    let sortingOptions = apiParametersHelper.extractSortingParameters(req);
    let pp = apiParametersHelper.extractPaginationParameters(req);

    let queryParameters = {};
    let queryParamsForReport = { _id: new MongoObjectId(reportId) };
    const targetId = apiParametersHelper.getQueryParameter(req, 'target');
    const filterByAttribute = apiParametersHelper.getQueryParameter(req, 'filter-by-attribute');
    const now = moment();

    // Check for false-positives filter
    filterFalsePositive = apiParametersHelper.getQueryParameter(req, 'false-positives');
    if (filterFalsePositive !== null) {
      if (parseInt(filterFalsePositive, 10) === 1) {
        _.extend(queryParameters, { false_positive: { $exists: true } });
      } else if (parseInt(filterFalsePositive, 10) === 0) {
        _.extend(queryParameters, { false_positive: { $exists: false } });
      }
    }

    // Check for has-exception filter
    filterHasException = apiParametersHelper.getQueryParameter(req, 'has-exception');
    if (filterHasException !== null) {
      if (parseInt(filterHasException, 10) === 1) {
        _.extend(queryParameters, { security_exception: { $exists: true }, 'security_exception.end_date': { $gte: now.toISOString() } });
      } else if (parseInt(filterHasException, 10) === 0) {
        _.extend(queryParameters, { security_exception: { $exists: false } });
      }
    }

    // Check for severity filter
    severity = apiParametersHelper.getQueryParameter(req, 'severity');
    if (severity !== null) {
      _.extend(queryParameters, { severity: parseInt(severity, 10) });
    }

    // Check for proposed_close_date
    proposedCloseDate = apiParametersHelper.getQueryParameter(req, 'proposed-close-date');
    if (proposedCloseDate !== null) {
      proposedCloseDateInt = parseInt(proposedCloseDate, 10);
      if (proposedCloseDateInt === 1) {
        _.extend(queryParameters, { proposed_close_date: { $exists: true } });
      } else if (proposedCloseDateInt === 0) {
        _.extend(queryParameters, { proposed_close_date: { $exists: false } });
      }
    }

    // validate group-by parameters
    groupByArr = apiParametersHelper.extractGroupByParameters(req);
    groupField = null;
    if (groupByArr.length !== 0) {
      if (modelsHelper.validateArrayContents(groupByArr,
        vulnerabilityModel.constants.optionsGroupBy)) {
        if (groupByArr && groupByArr.length > 0) {
          groupField = groupByArr[0];
        }
      } else {
        groupField = null;
      }
    }

    if (targetId) {
      queryParameters.target = targetId;
    }
    if (filterByAttribute) {
      const query = filterByAttributeQuery(filterByAttribute, targetId ? true : false);
      if (query && query.length > 0) {
        queryParameters['$or'] = query
      }
    }

    let isGenerateTicketEnabled = false;
    try {
      const vmSlug = supportedTypes.VM.short;
      const orgServices = await organisationModel.organization().getServiceCredentialData(organisationId, vmSlug);
      isGenerateTicketEnabled = orgServices && orgServices.setupTicket === true;
    } catch (e) {
      const message = e && e.message ? e.message : e;
      res.status(422);
      res.jsend.fail([constantErrors.organization.fetchToFailVulnerabilities + ' Reason: ' + message]);
    }

    // Get scan details for reportId
    reportsModel.find(organisationId, queryParamsForReport).then((reportsCursor) => {
      reportsCursor.toArray((reportError, reports) => {
        const reportBeingSearched = reports[0];
        let targetsForCurrentScan = reports[0].scan.targets;
        let totalVulnerabilities = reports[0].vulnerabilities.length;
        let falsePositivesCount = 0;
        let securityExceptionsCount = 0;
        let highPriorityVulnerabilities;
        let falsePositivesArray;
        let securityExceptionArray;
        let severitiesByName;
        let targetsByCount;
        let vulnerabilitiesByTarget;
        let maxTarget;
        let maxTargetPercent;
        let nameObj;
        let maxNameObj;
        let minNameObj;
        let maxTargetObj = {};
        let minTargetObj = {};
        let targetObj = {};
        let severityQuery = {};
        let minTarget;
        let minTargetPercent;
        let namesByCount;
        let vulnerabilitiesByName;
        let maxName;
        let minName;
        let maxNamePercent;
        let minNamePercent;
        let statisticsArr = [];
        let countObj;
        let maxCountObj;
        let minCountObj;
        let countArr;
        let vulnerabilitiesByCount;
        let maxCount;
        let minCount;
        let countForProposedCloseDate;
        let portProtocolObj;
        let maxPortProtocolObj;
        let minPortProtocolObj;
        let portProtocolByCount;
        let vulnerabilitiesByPortProtocol;
        let maxPortProtocol;
        let minPortProtocol;
        let maxPortProtocolPercent;
        let minPortProtocolPercent;

        vulnerabilityModel.getByReportId(organisationId, reportId, queryParameters, groupField,
          req.decoded.user_type).then((vulnerabilityCursor) => {
            vulnerabilityCursor.toArray((vulnerabilityError, vulnerabilities) => {

              vulnerabilities = addPortProtocol(vulnerabilities);
              totalVulnerabilities = vulnerabilities.length;

              if (req.decoded.user_type !== config.user_type.Customer) {
                falsePositivesArray = _.filter(vulnerabilities, vulnerability =>
                  (typeof vulnerability.false_positive !== 'undefined'));
                securityExceptionArray = _.filter(vulnerabilities, vulnerability =>
                  (typeof vulnerability.security_exception !== 'undefined'));

                const proposedCloseDateArray = _.filter(vulnerabilities, vulnerability =>
                  (typeof vulnerability.proposed_close_date !== 'undefined'));
                falsePositivesCount = falsePositivesArray.length;
                securityExceptionsCount = securityExceptionArray.length;
                countForProposedCloseDate = proposedCloseDateArray.length;
              }

              // Exclude info & low level priorities for statistics
              highPriorityVulnerabilities = _.filter(vulnerabilities, (vulnerability) => {
                severitiesByName = _.invert(vulnerabilityModel.severities);
                return (vulnerability.severity === parseInt(severitiesByName.Medium, 10) ||
                  vulnerability.severity === parseInt(severitiesByName.High, 10) ||
                  vulnerability.severity === parseInt(severitiesByName.Critical, 10));
              });

              if (highPriorityVulnerabilities === undefined) {
                highPriorityVulnerabilities = [];
              }

              // Skip statistics if we have group-by
              if (groupByArr.length === 0) {
                // Severity count by type
                severityQuery = { severity: _.countBy(vulnerabilities, 'severity') };
                statisticsArr.push(severityQuery);

                // Max & Minimum Targets with perentage
                // get all targets by count
                targetsByCount = _.countBy(highPriorityVulnerabilities, 'target');
                // pluck the counts in array
                vulnerabilitiesByTarget = underscore.pluck(highPriorityVulnerabilities, 'target');
                // find max in the array
                maxTarget = underscore
                  .chain(vulnerabilitiesByTarget)
                  .countBy()
                  .pairs()
                  .max(underscore.last)
                  .head()
                  .value();
                maxTargetPercent = parseInt((targetsByCount[maxTarget] /
                  highPriorityVulnerabilities.length) * 100, 10);
                maxTargetObj[maxTarget] = maxTargetPercent;

                // Find min in the array
                minTarget = underscore
                  .chain(vulnerabilitiesByTarget)
                  .countBy()
                  .pairs()
                  .min(underscore.last)
                  .head()
                  .value();
                minTargetPercent = parseInt((targetsByCount[minTarget] /
                  highPriorityVulnerabilities.length) * 100, 10);
                minTargetObj[minTarget] = minTargetPercent;

                _.assignIn(targetObj, { maxTarget: maxTargetObj }, { minTarget: minTargetObj });
                statisticsArr.push({ target: targetObj });

                // Vulnerability name percentage
                nameObj = {};
                maxNameObj = {};
                minNameObj = {};
                // Get all names by count
                namesByCount = _.countBy(highPriorityVulnerabilities, 'name');
                // Pluck the counts in array
                vulnerabilitiesByName = underscore.pluck(highPriorityVulnerabilities, 'name');
                // Find max in the array
                maxName = underscore
                  .chain(vulnerabilitiesByName)
                  .countBy()
                  .pairs()
                  .max(underscore.last)
                  .head()
                  .value();
                // Find min in the array
                minName = underscore
                  .chain(vulnerabilitiesByName)
                  .countBy()
                  .pairs()
                  .min(underscore.last)
                  .head()
                  .value();

                maxNamePercent = parseInt((namesByCount[maxName] /
                  highPriorityVulnerabilities.length) * 100, 10);
                minNamePercent = parseInt((namesByCount[minName] /
                  highPriorityVulnerabilities.length) * 100, 10);

                maxNameObj[maxName] = maxNamePercent;
                minNameObj[minName] = minNamePercent;

                _.assignIn(nameObj, { maxName: maxNameObj }, { minName: minNameObj });
                statisticsArr.push({ name: nameObj });

                // Vulnerability port_protocol percentage
                portProtocolObj = {};
                maxPortProtocolObj = {};
                minPortProtocolObj = {};
                // Get all port_protocol by count
                portProtocolByCount = _.countBy(highPriorityVulnerabilities, 'port_protocol');
                // Pluck the counts in array
                vulnerabilitiesByPortProtocol = underscore.pluck(highPriorityVulnerabilities, 'port_protocol');
                // Find max in the array
                maxPortProtocol = underscore
                  .chain(vulnerabilitiesByPortProtocol)
                  .countBy()
                  .pairs()
                  .max(underscore.last)
                  .head()
                  .value();
                // Find min in the array
                minPortProtocol = underscore
                  .chain(vulnerabilitiesByPortProtocol)
                  .countBy()
                  .pairs()
                  .min(underscore.last)
                  .head()
                  .value();

                maxPortProtocolPercent = parseInt((portProtocolByCount[maxPortProtocol] /
                  highPriorityVulnerabilities.length) * 100, 10);
                minPortProtocolPercent = parseInt((portProtocolByCount[minPortProtocol] /
                  highPriorityVulnerabilities.length) * 100, 10);

                maxPortProtocolObj[maxPortProtocol] = maxPortProtocolPercent;
                minPortProtocolObj[minPortProtocol] = minPortProtocolPercent;

                _.assignIn(portProtocolObj, { maxPortProtocol: maxPortProtocolObj }, { minPortProtocol: minPortProtocolObj });
                statisticsArr.push({ 'port_protocol': portProtocolObj });

                // Vulnerability count with percentage
                countObj = {};
                maxCountObj = {};
                minCountObj = {};

                // get all counts
                countArr = _.countBy(highPriorityVulnerabilities, 'count');
                // pluck the counts in array
                vulnerabilitiesByCount = underscore.pluck(highPriorityVulnerabilities, 'count');
                // find max in the array
                maxCount = underscore
                  .chain(vulnerabilitiesByCount)
                  .countBy()
                  .pairs()
                  .max(underscore.last)
                  .head()
                  .value();
                // find min in the array
                minCount = underscore
                  .chain(vulnerabilitiesByCount)
                  .countBy()
                  .pairs()
                  .min(underscore.last)
                  .head()
                  .value();

                maxCountObj[maxCount] = parseInt((countArr[maxCount] /
                  highPriorityVulnerabilities.length) * 100, 10);
                minCountObj[minCount] = parseInt((countArr[minCount] /
                  highPriorityVulnerabilities.length) * 100, 10);

                _.assignIn(countObj, { maxCount: maxCountObj }, { minCount: minCountObj });
                statisticsArr.push({ count: countObj });
              }
            });

            // Grab a Mongo cursor pointing to the vulnerabilities we need
            vulnerabilityModel.getByReportId(organisationId, reportId, queryParameters, groupField,
              req.decoded.user_type).then((reportVulnerabilityCursor) => {
                let mongoSortingOptions;
                let vulnerabilitiesToReturn = {};

                // Sort if required
                if (Object.keys(sortingOptions).length > 0) {
                  mongoSortingOptions = dbSortingHelper.convertOrderByToMongo(sortingOptions);
                  reportVulnerabilityCursor.sort(mongoSortingOptions);
                }

                reportVulnerabilityCursor.toArray().then((vulnerabilities) => {

                  let groupedVulnerabilitiesCount = getGroupedVulnerabilityCount(vulnerabilities);

                  // Paginate if queried by target
                  if (targetId) {
                    vulnerabilities = paginationHelper.paginateArray(vulnerabilities,
                      pp.itemsPerPage, pp.pageNumber);
                  }

                  // Run and return Max & Minimum locations with perentage
                  let maxLocationObj = {};
                  let minLocationObj = {};
                  let locationObj = {};
                  let locationByCount;
                  let vulnerabilitiesByLocation;
                  let maxLocation;
                  let minLocation;
                  let maxLocationPercent;
                  let minLocationPercent;
                  let groupByWrapperName;

                  // Remove expired security exceptions from the vulnerability list
                  vulnerabilities = vulnerabilityModel
                    .removeExpiredException(vulnerabilities);

                  // Sort vulnerability history items
                  vulnerabilities = vulnerabilityModel
                    .sortVulnerabilitiesHistory(vulnerabilities);
                  // We're grouping
                  if (groupField !== null) {
                    groupByWrapperName =
                      vulnerabilityModel.constants.optionsGroupBy[groupField].apiWrapperName;
                    vulnerabilitiesToReturn[groupByWrapperName] = {};

                    // Loop through the vulnerabilities to group-by
                    _.each(vulnerabilities, (group) => {
                      let currentTarget = _.filter(targetsForCurrentScan, { host: group._id });
                      let groupByField;
                      let groups;
                      let objToSend = {};

                      if (groupByArr.length > 1 && groupByArr[1] === 'severity') {
                        groupByField = groupByArr[1];

                        // group-by the specified attribute & create resultant object
                        groups = _.groupBy(group.vulnerabilities, groupByField);

                        // Iterate over each severity group to count vulnerabilities
                        objToSend = vulnerabilityModel.getSeverityCountForVulnerabilities(groups);

                        // add total vulnerabilities in response
                        objToSend.total = group.vulnerabilities.length;

                        vulnerabilitiesToReturn[groupByWrapperName][group._id] = {
                          by_severity: objToSend
                        };

                        if (currentTarget !== null && currentTarget.length > 0) {
                          vulnerabilitiesToReturn[groupByWrapperName][group._id].coordinates =
                            currentTarget[0].coordinates;
                        }
                      } else {
                        // Loop through and flatten
                        vulnerabilitiesToReturn[groupByWrapperName][group._id] = {
                          vulnerabilities: mapperHelper.mapObjects(group.vulnerabilities,
                            vulnerabilityModel.mapApi)
                        };

                        if (currentTarget !== null && currentTarget.length > 0) {
                          vulnerabilitiesToReturn[groupByWrapperName][group._id].coordinates =
                            currentTarget[0].coordinates;
                        }
                      }
                    });
                  } else {
                    // Add city_name as location for each vulnerability object
                    // Also add the creation date
                    _.each(vulnerabilities, (vulnerability) => {
                      let targetObject = _.find(targetsForCurrentScan, ['host', vulnerability.target]);
                      delete vulnerability.see_also;
                      delete vulnerability.plugin_output;
                      delete vulnerability.solution;
                      delete vulnerability.synopsis;
                      delete vulnerability.description;

                      if (typeof targetObject !== 'undefined') {
                        vulnerability.location = targetObject.city_name;
                      }

                      vulnerability.utc_time_created = reportBeingSearched.utc_time;
                    });

                    if (highPriorityVulnerabilities === undefined) {
                      highPriorityVulnerabilities = [];
                    }
                    // get all locations by count
                    locationByCount = _.countBy(highPriorityVulnerabilities, 'location');
                    // pluck the counts in array
                    vulnerabilitiesByLocation = underscore.pluck(highPriorityVulnerabilities, 'location');
                    // find max in the array
                    maxLocation = underscore
                      .chain(vulnerabilitiesByLocation)
                      .countBy()
                      .pairs()
                      .max(underscore.last)
                      .head()
                      .value();
                    // find min in the array
                    minLocation = underscore
                      .chain(vulnerabilitiesByLocation)
                      .countBy()
                      .pairs()
                      .min(underscore.last)
                      .head()
                      .value();

                    maxLocationPercent = parseInt((locationByCount[maxLocation] /
                      highPriorityVulnerabilities.length) * 100, 10);
                    maxLocationObj[maxLocation] = maxLocationPercent;


                    minLocationPercent = parseInt((locationByCount[minLocation] /
                      highPriorityVulnerabilities.length) * 100, 10);
                    minLocationObj[minLocation] = minLocationPercent;


                    _.assignIn(locationObj, { maxLocation: maxLocationObj },
                      { minLocation: minLocationObj });

                    statisticsArr.push({ location: locationObj });

                    // Map the vulnerabilities to return
                    vulnerabilitiesToReturn.vulnerabilities = mapperHelper.mapObjects(vulnerabilities,
                      vulnerabilityModel.mapApi);

                    vulnerabilitiesToReturn.vulnerabilities = addPortProtocol(vulnerabilitiesToReturn.vulnerabilities);

                    if (req.decoded.user_type !== config.user_type.Customer) {
                      vulnerabilitiesToReturn.false_positives_count = falsePositivesCount;
                      vulnerabilitiesToReturn.security_exceptions_count = securityExceptionsCount;
                      vulnerabilitiesToReturn.proposed_close_date_count = countForProposedCloseDate;
                    }

                    vulnerabilitiesToReturn.statistics = statisticsArr;

                    vulnerabilitiesToReturn.total_records = totalVulnerabilities;

                    if (targetId) {
                      vulnerabilitiesToReturn.target = targetId;
                      vulnerabilitiesToReturn.vulnerabilities_count = vulnerabilitiesToReturn.total_records;
                      vulnerabilitiesToReturn.group_vulnerabilities_count = groupedVulnerabilitiesCount;
                      vulnerabilitiesToReturn.location = '';

                      if (targetsForCurrentScan) {
                        let groupedTargetsByHost = _.groupBy(targetsForCurrentScan, 'host');

                        if (groupedTargetsByHost[targetId] && groupedTargetsByHost[targetId][0]) {
                          vulnerabilitiesToReturn.location = groupedTargetsByHost[targetId][0].city_name;
                        }
                      }

                    } else {
                      vulnerabilitiesToReturn = getBasicVulnerabilityInfo(vulnerabilitiesToReturn.vulnerabilities, pp);
                    }
                  }

                  vulnerabilitiesToReturn.availableSlugs = roleAccessHelper.getAccessibleSlug(vulnerabilityModel.accessibleSlugs, req.decoded);

                  let isUserHasTicketCapability = false;

                  if (vulnerabilitiesToReturn.availableSlugs && vulnerabilitiesToReturn.availableSlugs.length > 0) {
                    _.each(vulnerabilitiesToReturn.availableSlugs, (slugObj) => {
                      if (slugObj.slug === "ticket") {
                        isUserHasTicketCapability = true;
                      }
                    });
                  }

                  vulnerabilitiesToReturn.generateTicket = isGenerateTicketEnabled && isUserHasTicketCapability;

                  res.jsend.success(vulnerabilitiesToReturn);
                });

              }).catch(function (error) {
                console.log(error)
              });
          }).catch(function (error) {
            console.log(error)
          });
      });
    });
  } else {
    res.status(422);
    res.jsend.fail([constantErrors.organizationService.supportedTypesNotAvailable]);
  }
}

/**
 * @api {get} /api/v1/organisations/:id/reports/:reportId/vulnerabilitiesCount
  Requesting count of vulnerabilities by type
 * @apiVersion 1.0.0
 * @apiName GetVulnerabilitiesCount
 * @apiGroup Vulnerability
 *
 * @apiParam (URL) {String} id Organisation ID
 * @apiParam (URL) {String} reportId Report ID
 * @apiSuccess {Object[]} count object

 * @apiSuccessExample Successful generic response:
 {
   "status": "success",
   "data": {
     "vulnerability_count": {
       "total_vulnerabilities": 25,
       "false_positives_count": 1,
       "security_exceptions_count": 0,
    "proposed_close_date_count": 1
     }
   }
 }
 */
function getVulnerabilitiesCountByType(req, res) {
  // Load the report
  let reportId = req.params.reportId;
  let organisationId = req.params.id;
  const targetId = req.params.targetId;

  let queryParameters = {};
  let filterFalsePositive;
  let filterHasException;
  let severity;
  let groupByArr;
  let groupField;
  let queryParamsForReport = { _id: reportId };
  const filterByAttribute = apiParametersHelper.getQueryParameter(req, 'filter-by-attribute');

  // Check for false-positives filter
  filterFalsePositive = apiParametersHelper.getQueryParameter(req, 'false-positives');
  if (filterFalsePositive !== null) {
    if (parseInt(filterFalsePositive, 10) === 1) {
      _.extend(queryParameters, { false_positive: { $exists: true } });
    }
  }

  // Check for has-exception filter
  filterHasException = apiParametersHelper.getQueryParameter(req, 'has-exception');
  if (filterHasException !== null) {
    if (parseInt(filterHasException, 10) === 1) {
      _.extend(queryParameters, { security_exception: { $exists: true } });
    }
  }

  // Check for severity filter
  severity = apiParametersHelper.getQueryParameter(req, 'severity');
  if (severity !== null) {
    _.extend(queryParameters, { severity: parseInt(severity, 10) });
  }

  // validate group-by parameters
  groupByArr = apiParametersHelper.extractGroupByParameters(req);
  groupField = null;
  if (groupByArr.length !== 0) {
    if (modelsHelper.validateArrayContents(groupByArr,
      vulnerabilityModel.constants.optionsGroupBy)) {
      if (groupByArr && groupByArr.length > 0) {
        groupField = groupByArr[0];
      }
    } else {
      groupField = null;
    }
  }

  if (targetId) {
    queryParameters.target = targetId;
  }
  if (filterByAttribute) {
    const query = filterByAttributeQuery(filterByAttribute, targetId ? true : false);
    if (query && query.length > 0) {
      queryParameters['$or'] = query
    }
  }
  // Get scan details for reportId
  reportsModel.find(organisationId, queryParamsForReport).then((reportsCursor) => {
    reportsCursor.toArray(() => {
      let falsePositivesCount = 0;
      let securityExceptionsCount = 0;
      let proposedCloseDateCount = 0;

      vulnerabilityModel.getByReportId(organisationId, reportId, queryParameters, groupField,

        req.decoded.user_type).then((vulnerabilityCursor) => {
          vulnerabilityCursor.toArray((vulnerabilityError, vulnerabilities) => {
            let totalVulnerabilities = vulnerabilities.length;
            let vulnerabilitiesCount = {};
            let proposedCloseDateArr = _.filter(vulnerabilities, vulnerability =>
              Object.prototype.hasOwnProperty.call(vulnerability, 'proposed_close_date'));
            let falsePositivesArr;
            let securityExceptionsArr;

            proposedCloseDateCount = proposedCloseDateArr.length;

            // Remove expired security exceptions from the vulnerability list
            securityExceptionsArr = vulnerabilityModel
              .removeExpiredException(vulnerabilities);

            if (req.decoded.user_type !== config.user_type.Customer) {
              falsePositivesArr = _.filter(vulnerabilities, vulnerability =>
              (typeof vulnerability.false_positive !== 'undefined'
                && vulnerability.false_positive));
              securityExceptionsArr = _.filter(vulnerabilities, vulnerability =>
              (typeof vulnerability.security_exception !== 'undefined'
                && vulnerability.security_exception));

              falsePositivesCount = falsePositivesArr.length;
              securityExceptionsCount = securityExceptionsArr.length;

              vulnerabilitiesCount.total_vulnerabilities = totalVulnerabilities;
              vulnerabilitiesCount.false_positives_count = falsePositivesCount;
              vulnerabilitiesCount.security_exceptions_count = securityExceptionsCount;
              vulnerabilitiesCount.proposed_close_date_count = proposedCloseDateCount;

              res.jsend.success({
                vulnerability_count: vulnerabilitiesCount
              });
            } else {
              vulnerabilitiesCount.total_vulnerabilities = totalVulnerabilities;
              vulnerabilitiesCount.proposed_close_date_count = proposedCloseDateCount;
              res.jsend.success({
                vulnerability_count: vulnerabilitiesCount
              });
            }
          });
        });
    });
  });
}
/**
 * Validates the parameters for organisation vulnerabilities
 * @param {Integer} organisationId - ID of the organisation
 * @param {Object} queryParams - Query parameters to pick vulnerability
 * @return {Object} vulnerability or null otherwise
 */
function getVulnerabilityForAPI(organisationId, queryParams) {
  let vulnerabilityTable = config.mongo.tables.vulnerabilities;
  return mongo.findOne(organisationId, vulnerabilityTable, queryParams)
    .then((vulnerability) => {
      let vulnerabilityToReturn;
      let historyObject;

      if (vulnerability === null) {
        return null;
      }
      // Get the plugin for this
      return vulnerabilityModel
        .appendPluginInformation(vulnerability)
        .then(() => {
          // Get scan for vulnerability
          let queryParamsForScans = {
            nessus_scan_id: vulnerability.nessus_scan_id
          };

          let scanQueryPromise = mongo.findOne(organisationId, config.mongo.tables.scans,
            queryParamsForScans);

          return scanQueryPromise.then((scan) => {
            // Get location for vulnerability's target
            let targetObj = _.find(scan.targets, ['host', vulnerability.target]);

            if (typeof targetObj !== 'undefined') {
              vulnerability.location = targetObj.city_name;
            }


            vulnerabilityToReturn = mapperHelper
              .map(vulnerability, vulnerabilityModel.mapApi);

            // Sort vulnerability history items
            vulnerabilityToReturn = vulnerabilityModelFile
              .sortVulnerabilityHistory(vulnerabilityToReturn);

            if (!Object.prototype.hasOwnProperty.call(vulnerabilityToReturn, 'notes')) {
              vulnerabilityToReturn.notes = [];
            }

            if (Object.prototype.hasOwnProperty.call(vulnerabilityToReturn, 'history')) {
              historyObject = vulnerabilityToReturn.history;

              return usersAPIHelper.filloutObjectsWithUserInfo(historyObject)
                .then((updatedHistory) => {
                  vulnerabilityToReturn.history = updatedHistory;

                  // add user info for the users in note objects
                  if (Object.prototype.hasOwnProperty.call(vulnerabilityToReturn, 'ticket')) {
                    return usersAPIHelper.filloutObjectsWithUserInfo(vulnerabilityToReturn.notes)
                      .then((notesWithUserInfo) => {
                        vulnerabilityToReturn.notes = notesWithUserInfo;
                        return usersAPIHelper.filloutObjectsWithUserInfo([vulnerabilityToReturn.ticket])
                          .then(() => {
                            return vulnerabilityToReturn;
                          });

                      });
                  }
                  else {
                    return usersAPIHelper.filloutObjectsWithUserInfo(vulnerabilityToReturn.notes)
                      .then((notesWithUserInfo) => {
                        vulnerabilityToReturn.notes = notesWithUserInfo;
                        return vulnerabilityToReturn;
                      });
                  }
                });
            }

            if (Object.prototype.hasOwnProperty.call(vulnerabilityToReturn, 'ticket')) {
              return usersAPIHelper.filloutObjectsWithUserInfo([vulnerabilityToReturn.ticket])
                .then(() => {
                  return vulnerabilityToReturn;
                });
            }

            // add user info for the users in note objects
            return usersAPIHelper.filloutObjectsWithUserInfo(vulnerabilityToReturn.notes)
              .then((notesWithUserInfo) => {
                vulnerabilityToReturn.notes = notesWithUserInfo;
                return vulnerabilityToReturn;
              });
          });
        });
    });
}
/**
 * @api {get}
 *  /api/v1/organisations/:organisation_id/reports/:reportId/vulnerabilities/:vulnerabilityId
 *  Requesting a vulnerability
 * @apiVersion 1.0.0
 * @apiName GetVulnerability
 * @apiGroup Vulnerability
 *
 * @apiParam {Number} organisation_id Organisation ID
 * @apiParam {Number} reportId Report ID
 * @apiParam {Number} vulnerabilityId Vulnerability ID
 *
 * @apiSuccess {Object} Matching vulnerability
 *
 * @apiSuccessExample 200:
 *   HTTP/1.1 200 OK
 {
  "status": "success",
  "data": {
    "vulnerability": {
      "id": "59243be4d7291a004256b6a3",
      "name": "SSL Certificate Information",
      "severity": 3,
      "count": 2,
      "created_utc_time": "2017-05-30T09:58:42.000Z",
      "false_positive": {
        "reason": "reason for false positive"
      },
      "proposed_close_date": "2017-05-30",
      "target": "139.59.76.82",
      "description": "This plugin connects to every SSL-related port
      and attempts to \nextract and dump the X.509 certificate.",
      "solution": "n/a",
      "history": [
        {
          "action": " type_change",
          "timestamp": "2017-06-06T10:42:10.890Z",
          "updatedBy": 1,
          "previousValues": {
            "false_positive": null,
            "severity": 0
          },
          "newValues": {
            "false_positive": {
              "reason": "reason for false positive"
            },
            "severity": 3
          }
        }
      ]
    }
  }
}
 */
/*
 * Exposes the vulnerability for the API
 */
function getVulnerability(req, res) {
  // Load the report
  let organisationId = req.params.id;
  let vulnerabilityId = req.params.vulnerabilityId;
  let reportId = req.params.reportId;

  let queryParameters = {
    _id: new MongoObjectId(vulnerabilityId)
  };

  // Filtering query to make sure, vulnerability or vulnerabilities having "soft_deleted_at"
  //  will not visible to Customer
  queryParameters = mongo.filteredQueryByUserType(queryParameters, req.decoded.user_type);

  // get vulnerability for API
  getVulnerabilityForAPI(organisationId, queryParameters)
    .then(function (vulnerabilityToReturn) {
      if (vulnerabilityToReturn === null) {
        res.status(404);
        res.jsend.fail(['No vulnerability with this ID found']);
      } else {
        // Get the report ID which will give us the created time
        reportsModel.getById(organisationId, reportId).then(function (report) {
          vulnerabilityToReturn.utc_time_created = report.utc_time;
          vulnerabilityToReturn['port_protocol'] = vulnerabilityToReturn.port;

          let OriginalString = vulnerabilityToReturn.plugin_output;
          vulnerabilityToReturn.plugin_output = OriginalString.replace(/(<([/plugin_output>]+)>)/ig, "");

          res.jsend.success({
            vulnerability: vulnerabilityToReturn
          });
        });
      }
    });
}

/**
 * Validates the parameters for organisation vulnerabilities
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function.
 */
function validateOrganisationVulnerabilityNameParameters(req, res, next) {
  req.checkParams('id', 'Organisation ID is required').notEmpty();
  req.checkParams('id', 'Organisation ID must be an integer').isInt();

  if (req.params.vulnerabilityId) {
    req.checkParams('vulnerabilityId', 'Vulnerability ID is not valid').isMongoId();
  }

  // Check if there's a changed severity
  if (req.query.severity) {
    req.checkQuery('severity', 'severity ID must be an integer').isInt();

    if (!Object.prototype.hasOwnProperty.call(vulnerabilityModel.severities, req.query.severity)) {
      res.status(422);
      res.jsend.fail({
        validation: 'severity not valid'
      });
    }
  }

  if (req.body.proposed_close_date) {
    if (Object.prototype.hasOwnProperty.call(req.body.proposed_close_date, 'date')) {
      req.checkBody('proposed_close_date.date',
        'proposed_close_date must be an integer (the number of seconds since 1970)').isInt();
    }
  }

  // Check for a security exception
  if (req.body.security_exception) {
    if (Object.prototype.hasOwnProperty.call(req.body.security_exception, 'start_date')) {
      req.checkBody('security_exception.start_date',
        'start_date must be an integer (the number of seconds since 1970)').isInt();
    }
    if (Object.prototype.hasOwnProperty.call(req.body.security_exception, 'end_date')) {
      req.checkBody('security_exception.end_date',
        'end_date must be an integer (the number of seconds since 1970)').isInt();
    }
  }

  // Check if there's a changed severity
  if (req.body.severity) {
    req.checkBody('severity', 'severity ID must be an integer').isInt();

    if (!Object.prototype.hasOwnProperty.call(vulnerabilityModel.severities, req.body.severity)) {
      res.status(422);
      res.jsend.fail({
        validation: 'severity not valid'
      });
    }
  }

  // If validation passes, then update!
  req.getValidationResult().then((result) => {
    if (!result.isEmpty()) {
      res.status(422);
      res.jsend.fail({
        validation: result.array()
      });
    } else {
      // Check this organisation exists
      organisationModel
        .organization()
        .getOrganizationById(req.params.id)
        .then((organisation) => {
          if (organisation) {
            next();
          } else {
            res.status(404);
            res.jsend.fail(['No organisation with this ID found']);
          }
        });
    }
  });
}

const updateVulnerability = async (req, res) => {
  const organisationId = req.params.id;
  const vulnerabilityId = req.params.vulnerabilityId;
  let fieldsToSet = {};
  const queryParams = { _id: new MongoObjectId(vulnerabilityId) };
  const vulnerabilityTable = config.mongo.tables.vulnerabilities;
  // Get the fields that we are allowed to update
  fieldsToSet = apiParametersHelper.getWritableParameters(req, vulnerabilityModel.writableFields);

  // If we have some fields to set, update them
  if (!_.isEmpty(fieldsToSet) && (fieldsToSet.actionsToMark)) {
    const result = await performActionOnVulnerabilities(req, organisationId, fieldsToSet);
    if (result === true) {
      const vulnerabilityToReturn = await getVulnerabilityForAPI(organisationId, queryParams);
      res.jsend.success({ vulnerability: vulnerabilityToReturn });
    } else if (result && !result.match) {
      res.status(404).jsend.fail([result && result.message]);
    } else {
      res.status(422).jsend.fail([result && result.message]);
    }
  }
  else if (!_.isEmpty(fieldsToSet)) {
    // Update the object
    const result = await mongo.updateOne(organisationId, vulnerabilityTable, queryParams, fieldsToSet);
    if (result === null) {
      res.status(500).jsend.fail([constantErrors.vulnerabilities.updateFailed]);
    } else {
      // fetch the data for updated vulnerability
      const vulnerabilityToReturn = await getVulnerabilityForAPI(organisationId, queryParams);
      res.jsend.success({ vulnerability: vulnerabilityToReturn });
    }
  } else {
    res.status(422).jsend.fail([constantErrors.vulnerabilities.updateFailed]);
  }
}


/**
 * @api {patch}
 *  /api/v1/organisations/:organisation_id/reports/:reportId/vulnerabilities/:vulnerabilityId/generate-ticket
 *  Update a vulnerability ticket
 * @apiVersion 1.0.0
 * @apiName generateVulnerabilityTicket
 * @apiGroup Vulnerability
 * @apiParam (URL) {String} organisation_id Organisation ID
 * @apiParam (URL) {String} reportId Report ID
 * @apiParam (URL) {String} vulnerabilityid Vulnerability ID
 * @apiParamExample {json} PATCH Input JSON
 {
 "ticket": {
        "title" : "sample ticket new test",
        "description" : "sample description new"
    }
}
*/
const generateVulnerabilityTicket = (req, res) => {
  const organisationId = req.params.id;
  const vulnerabilityId = req.params.vulnerabilityId;
  const queryParams = { _id: new MongoObjectId(vulnerabilityId) };
  const vulnerabilityTable = config.mongo.tables.vulnerabilities;
  req.body.ticket._id = new MongoObjectId();
  req.body.ticket.created_by = req.decoded.id;
  req.body.ticket.created_at = new Date().toISOString();

  const queryArguments = {
    attributes: ['id', 'name', 'active', 'created_by', 'created_at', 'updated_at'],
    where: { id: organisationId },
    raw: true
  };
  models.Organization.findOne(queryArguments).then((result) => {
    if (result !== null) {

      const customerInfo = { customer_id: result.id, customer_name: result.name }

      fieldsToSet = apiParametersHelper.getWritableParameters(req, vulnerabilityModel.writableFields);

      if (!_.isEmpty(fieldsToSet)) {
        mongo.findOne(organisationId, vulnerabilityTable, queryParams)
          .then((result) => {
            if (result !== null) {
              snmpTrap.sendSnmpTrap(result, customerInfo);
            }
            mongo.updateOne(organisationId, vulnerabilityTable, queryParams, fieldsToSet)
              .then((result) => {
                if (result === null) {
                  res.status(422);
                  res.jsend.fail(['Update failed']);
                } else {
                  getVulnerabilityForAPI(organisationId, queryParams)
                    .then((vulnerabilityToReturn) => {
                      res.jsend.success({
                        vulnerability: vulnerabilityToReturn
                      });
                    });
                }
              }).catch(() => {
                res.status(422);
                res.jsend.fail({ message: 'Update failed' });
              });
          }).catch(() => {
            res.status(422);
            res.jsend.fail({ message: 'Update failed' });
          });
      } else {
        res.status(422);
        res.jsend.fail(['Update failed. Nothing to update.']);
      }

    } else {
      res.status(422);
      res.jsend.fail(['Update failed. Nothing to update.']);
    }

  });

}


/**
 * @api {get} /api/v1/vulnerabilities/pending
  Get pending vulnerabilities
 * @apiVersion 1.0.0
 * @apiName Get pending Vulnerabilities
 * @apiGroup Vulnerability
 *
 * @apiParam (Query) {String} [report-id] Report ID to filter by
 * @apiParam (Query) {String} [type] The type of pending requests to filter by.
 *  Options are `SE`, `FP` and `PCD`
 * @apiParam (Query) {Number} [page] The page number if using pagination
 * @apiParam (Query) {Number} [limit] Number of items to return if using pagination
 * @apiParam (Query) {String} [sort-by] Sort the result options are
 *  `name`, `reports.report_name`. Add minus (-) for descending. e.g. `-name`
 * @apiParam (Query) {String} [group-by] Can group by `organisation` to get the vulnerabilities
 *  for each

 * @apiSuccessExample {json} Success response:
 *     HTTP/1.1 200 OK
 {
     "status": "success",
     "data": {
         "total_vulnerabilities": 61,
         "vulnerabilities": [
             {
                 "_id": "59462b468fa0b8007ababd14",
                 "nessus_scan_id": 6,
                 "nessus_host_id": 2,
                 "target": "139.59.76.82",
                 "tenable_plugin_id": 35351,
                 "name": "System Information Enumeration (via DMI)",
                 "severity": 0,
                 "count": 1,
                 "reports": {
                     "_id": "59462b478fa0b8007ababd35",
                     "report_name": "Etisalat_Monthly_May 24, 2017 7:09 AM"
                 }
             },
             {
                 "_id": "59462b468fa0b8007ababd17",
                 "nessus_scan_id": 6,
                 "nessus_host_id": 2,
                 "target": "139.59.76.82",
                 "tenable_plugin_id": 56984,
                 "name": "SSL / TLS Versions Supported",
                 "severity": 0,
                 "count": 1,
                 "reports": {
                     "_id": "59462b478fa0b8007ababd35",
                     "report_name": "Etisalat_Monthly_May 24, 2017 7:09 AM"
                 }
             }
         ]
     }
 }
 * @apiSuccessExample {json} Success response (grouped by organisation):
 *     HTTP/1.1 200 OK
{
    "status": "success",
    "data": {
        "total_vulnerabilities": 5,
        "organisations": {
            "2": {
                "id": 2,
                "name": "test",
                "vulnerabilities": [
                    {
                        "_id": "5953aa0418467e003df9657e",
                        "nessus_scan_id": 6,
                        "nessus_host_id": 2,
                        "target": "139.59.76.82",
                        "tenable_plugin_id": 70544,
                        "name": "SSL Cipher Block Chaining Cipher Suites Supported",
                        "severity": 1,
                        "count": 2,
                        "description": "The remote host supports the use of SSL ciphers that
                        operate in Cipher\nBlock Chaining (CBC) mode.  These cipher suites offer
                        additional\nsecurity over Electronic Codebook (ECB) mode, but have
                        the potential to\nleak information if used improperly.",
                        "history": {
                            "_id": "595604a54f228809182f9e0d",
                            "action": "security_exception",
                            "status": "pending",
                            "requested_by": 2,
                            "requested_at": "2017-06-30T07:58:29.258Z"
                        },
                        "reports": {
                            "_id": "5953aa0418467e003df9659d",
                            "report_name": "Test_Ad_Hoc_June 24, 2017 7:10 AM"
                        }
                    },
                    {
                        "_id": "5953aa0418467e003df9657f",
                        "nessus_scan_id": 6,
                        "nessus_host_id": 2,
                        "target": "139.59.76.82",
                        "tenable_plugin_id": 10863,
                        "name": "SSL Certificate Information",
                        "severity": 2,
                        "count": 2,
                        "description": "This plugin connects to every SSL-related port and attempts
                         to \nextract and dump the X.509 certificate.",
                        "history": {
                            "_id": "5956049d4f228809182f9e0c",
                            "action": "false_positive",
                            "status": "pending",
                            "requested_by": 2,
                            "requested_at": "2017-06-30T07:58:21.428Z"
                        },
                        "reports": {
                            "_id": "5953aa0418467e003df9659d",
                            "report_name": "Test_Ad_Hoc_June 24, 2017 7:10 AM"
                        }
                    },
                    {
                        "_id": "5953aa0818467e003df965ae",
                        "nessus_scan_id": 17,
                        "nessus_host_id": 2,
                        "target": "139.59.76.83",
                        "tenable_plugin_id": 20007,
                        "name": "SSL Version 2 and 3 Protocol Detection",
                        "severity": 2,
                        "count": 2,
                        "history": {
                            "_id": "5955009cfa43ba013860525a",
                            "action": "security_exception",
                            "status": "pending",
                            "requested_by": 2,
                            "requested_at": "2017-06-29T13:29:00.258Z"
                        },
                        "reports": {
                            "_id": "5953aa0818467e003df965b5",
                            "report_name": "Test_Ad_Hoc_June 22, 2017 6:05 AM"
                        }
                    }
                ],
                "total_vulnerabilities": 3
            },
            "3": {
                "id": 3,
                "name": "test",
                "vulnerabilities": [
                    {
                        "_id": "595605cbc00a980923d37c4d",
                        "nessus_scan_id": 11,
                        "nessus_host_id": 2,
                        "target": "linkedin.com",
                        "tenable_plugin_id": 62565,
                        "name": "Transport Layer Security (TLS) Protocol CRIME Vulnerability",
                        "severity": 2,
                        "count": 1,
                        "history": {
                            "_id": "59560607c00a980923d37c54",
                            "action": "security_exception",
                            "status": "pending",
                            "updated_by": 3,
                            "updated_at": "2017-06-30T08:04:23.297Z"
                        },
                        "reports": {
                            "_id": "595605cbc00a980923d37c52",
                            "report_name": "Test_Semi_Annual_June 18, 2017 3:49 PM"
                        }
                    },
                    {
                        "_id": "595605cbc00a980923d37c51",
                        "nessus_scan_id": 11,
                        "nessus_host_id": 2,
                        "target": "linkedin.com",
                        "tenable_plugin_id": 94437,
                        "name": "SSL 64-bit Block Size Cipher Suites Supported (SWEET32)",
                        "severity": 2,
                        "count": 1,
                        "history": {
                            "_id": "59560601c00a980923d37c53",
                            "action": "false_positive",
                            "status": "pending",
                            "updated_by": 3,
                            "updated_at": "2017-06-30T08:04:17.505Z"
                        },
                        "reports": {
                            "_id": "595605cbc00a980923d37c52",
                            "report_name": "Test_Semi_Annual_June 18, 2017 3:49 PM"
                        }
                    }
                ],
                "total_vulnerabilities": 2
            }
        }
    }
}
*/

/**
 * Get all pending vulnerabilities for all customers
 * @param {Object} request - The Standard ExpressJS request variable.
 * @param {Object} response - The Standard ExpressJS response variable.
 */
const getPendingGlobal = async (request, response) => {
  const supportedTypes = await servicesHelper.getServicesSlugs(true);

  if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
    // Check if we need to group by organisation
    let groupByParameter = apiParametersHelper.getQueryParameter(request, 'group-by');
    let groupByOrganisation = groupByParameter === 'organisation';
    let pendingVulnerabilityPromises = [];
    let organisations = [];
    let organisationKeys = [];
    let totalCount = 0;
    let pendingResult = {};
    let organisationCounter = 0;
    let organisationId = 0;
    let finalVulnerabilities = [];

    const actionType = apiParametersHelper.getQueryParameter(request, 'type');
    const reportId = apiParametersHelper.getQueryParameter(request, 'report-id');
    const assignedOrganizations = request.decoded.organizations && request.decoded.organizations.length > 0 ? request.decoded.organizations.split(',') : [];

    // Get all the organisations with the VM service
    // @todo Reuse the code from `get-organisations` API = DRY

    // Build the initial query
    let queryArguments = {
      attributes: ['id', 'name', 'active', 'created_by', 'created_at', 'updated_at'],
      where: {},
      order: [['created_at', 'DESC']]
    };

    if (request.decoded.user_type !== config.user_type.SuperAdmin) {
      queryArguments.where.id = { [Sequelize.Op.in]: assignedOrganizations }
    }

    // If the request is to filter by service, do so
    queryArguments.attributes = ['id', 'name', 'active', 'created_at', 'updated_at'];
    queryArguments.include = [{
      model: models.Service,
      where: {
        short: supportedTypes.VM.short
      }
    }];

    // Get all the organisations with VM services
    models.Organization.findAndCountAll(queryArguments).then((organisationFindCount) => {
      organisations = organisationFindCount.rows;

      // Loop through the organisations and create pending vulnerability promises
      _.each(organisations, function (organisation) {
        organisationId = parseInt(organisation.id, 10);
        pendingVulnerabilityPromises.push(
          vulnerabilityModel.getPendingForOrganisation(organisationId,
            actionType, reportId));
        organisationKeys.push(organisationId);

        // Add the organisation to the result for grouping
        if (groupByOrganisation) {
          pendingResult[organisationId] = {
            id: organisation.id,
            name: organisation.name,
            vulnerabilities: [],
            total_vulnerabilities: 0
          };
        }
      });

      // Get all the vulnerabilities for all the organisations
      Promise.all(pendingVulnerabilityPromises).then(function (pendingVulnerabilities) {
        // Group if we're grouping
        if (groupByOrganisation) {
          _.each(pendingVulnerabilities, function (organisationPendingVulnerabilities) {
            if (organisationPendingVulnerabilities) {
              organisationId = parseInt(organisationKeys[organisationCounter], 10);

              // Remove the organisation if there's no vulnerabilities
              const organisationVulnerabilityCount = organisationPendingVulnerabilities && organisationPendingVulnerabilities.length > 0 ? organisationPendingVulnerabilities.length : 0;

              if (organisationVulnerabilityCount > 0) {
                pendingResult[organisationId].vulnerabilities = organisationPendingVulnerabilities;
                pendingResult[organisationId].total_vulnerabilities = organisationVulnerabilityCount;

                totalCount += organisationPendingVulnerabilities.length;
              } else {
                delete pendingResult[organisationId];
              }

              organisationCounter += 1;
            }
          });

          _.each(pendingResult, (result) => {
            if (result && result.vulnerabilities) {
              let groupVulnerabilities = _.chain(result.vulnerabilities)
                .groupBy('_id')
                .map((value, key) => ({ id: key, vulnerabilities: value }))
                .value();
              finalVulnerabilities = [];
              _.each(groupVulnerabilities, (vulnerability) => {
                let reports = [];
                let vulnerabilityObj = {};

                _.each(vulnerability.vulnerabilities, (vulnerabilityResult) => {
                  vulnerabilityObj = vulnerabilityResult;
                  reports.push(vulnerabilityResult.reports);
                  vulnerabilityObj.reports = reports;
                })

                finalVulnerabilities.push(vulnerabilityObj);
              })
              pendingResult[result.id].vulnerabilities = finalVulnerabilities;
              pendingResult[result.id].total_vulnerabilities = finalVulnerabilities.length
            }
          });
          totalCount = Object.keys(pendingResult).length;
          response.jsend.success({ total_vulnerabilities: totalCount, organisations: pendingResult });
        } else {
          response.status(422);
          response.jsend.fail(['Only group by organisation filter is supported for now.']);
        }
      }).catch((err) => {
        console.log(err);
      });
    });
  } else {
    response.status(422);
    response.jsend.fail([constantErrors.organizationService.supportedTypesNotAvailable]);
  }
}

/**
 * Get all pending vulnerabilities for all customers
 * @param {Object} request - The Standard ExpressJS request variable.
 * @param {Object} response - The Standard ExpressJS response variable.
 */
const getPendingGlobalOrg = async (request, response) => {
  const supportedTypes = await servicesHelper.getServicesSlugs(true);

  if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
    // Check if we need to group by organisation
    let groupByParameter = apiParametersHelper.getQueryParameter(request, 'group-by');
    let sortByParameter = apiParametersHelper.getQueryParameter(request, 'sort-by');
    let groupByOrganisation = groupByParameter === 'organisation';
    let pendingVulnerabilityPromises = [];
    let organisationKeys = [];
    let totalCount = 0;
    let pendingResult = {};
    let organisationCounter = 0;
    let organisationId = apiParametersHelper.getQueryParameter(request, 'organisationId');
    let finalVulnerabilities = [];

    const actionType = apiParametersHelper.getQueryParameter(request, 'type');
    const reportId = apiParametersHelper.getQueryParameter(request, 'report-id');
    const { itemsPerPage, pageNumber } = apiParametersHelper.extractPaginationParameters(request);

    // Get all the organisations with the VM service
    // @todo Reuse the code from `get-organisations` API = DRY

    // Build the initial query
    let queryArguments = {
      attributes: ['id', 'name', 'active', 'created_by', 'created_at', 'updated_at'],
      where: {},
      order: 'created_at DESC'
    };

    // If the request is to filter by service, do so
    queryArguments.attributes = ['id', 'name', 'active', 'created_at', 'updated_at'];
    queryArguments.include = [{
      model: models.Service,
      where: {
        short: supportedTypes.VM.short
      }
    }];


    organisationId = parseInt(organisationId, 10);
    pendingVulnerabilityPromises.push(
      vulnerabilityModel.getPendingForOrganisation(organisationId,
        actionType, reportId));
    organisationKeys.push(organisationId);

    // Add the organisation to the result for grouping
    if (groupByOrganisation) {
      pendingResult[organisationId] = {
        id: organisationId,
        name: organisationId,
        vulnerabilities: [],
        total_vulnerabilities: 0
      };
    }


    // Get all the vulnerabilities for all the organisations
    Promise.all(pendingVulnerabilityPromises).then(function (pendingVulnerabilities) {
      // Group if we're grouping
      if (groupByOrganisation) {
        _.each(pendingVulnerabilities, function (organisationPendingVulnerabilities) {
          if (organisationPendingVulnerabilities) {
            organisationId = parseInt(organisationKeys[organisationCounter], 10);

            // Remove the organisation if there's no vulnerabilities
            const organisationVulnerabilityCount = organisationPendingVulnerabilities && organisationPendingVulnerabilities.length > 0 ? organisationPendingVulnerabilities.length : 0;

            if (organisationVulnerabilityCount > 0) {
              pendingResult[organisationId].vulnerabilities = organisationPendingVulnerabilities;
              pendingResult[organisationId].total_vulnerabilities = organisationVulnerabilityCount;

              totalCount += organisationPendingVulnerabilities.length;
            } else {
              delete pendingResult[organisationId];
            }

            organisationCounter += 1;
          }
        });

        response.jsend.success({ total_vulnerabilities: totalCount, organisations: pendingResult });
      } else {
        pendingResult = [];

        _.each(pendingVulnerabilities, function (organisationPendingVulnerabilities) {
          if (organisationPendingVulnerabilities) {
            pendingResult = pendingResult.concat(organisationPendingVulnerabilities);
          }
        });

        let groupVulnerabilitties = _.chain(pendingResult)
          .groupBy('_id')
          .map((value, key) => ({ id: key, vulnerabilities: value }))
          .value();

        _.each(groupVulnerabilitties, (vulnerability) => {
          let reports = [];
          let vulnerabilityObj = {};
          _.each(vulnerability.vulnerabilities, (vulnerabilityResult) => {
            vulnerabilityObj = vulnerabilityResult;
            reports.push(vulnerabilityResult.reports);
            vulnerabilityObj.reports = reports;
          })
          finalVulnerabilities.push(vulnerabilityObj);
        })
        pendingResult = finalVulnerabilities;

        if (sortByParameter !== null) {
          pendingResult = dbSortingHelper.sortArrayElements(pendingResult, sortByParameter);
        }

        totalCount = pendingResult.length;

        pendingResult = paginationHelper.paginateArray(pendingResult, itemsPerPage, pageNumber);

        response.jsend.success({
          total_vulnerabilities: totalCount,
          vulnerabilities: pendingResult
        });
      }
    }).catch((err) => {
      console.log(err);
    });
  } else {
    response.status(422);
    response.jsend.fail([constantErrors.organizationService.supportedTypesNotAvailable]);
  }
}

/**
 * @api {get} /api/v1/organisations/2/vulnerabilities/pending?group-by=report
 * Get Reports with pending vulnerabilities for the given organisation
 * @apiParam (Query) {String} group-by Currently only supports grouping by `report`, and this
 *  is mandatory
 * @apiVersion 1.0.0
 * @apiName Get Reports with pending vulnerabilities
 * @apiGroup Vulnerability
 * @apiSuccessExample {json} Success response:
 *     HTTP/1.1 200 OK
 {
    "status": "success",
    "data": [
        {
            "id": "59462b478fa0b8007ababd35",
            "name": "Etisalat_Monthly_May 24, 2017 7:09 AM",
            "count": 34
        },
        {
            "id": "594a58e538491475765cc382",
            "name": "Etisalat_Monthly_May Duplicate",
            "count": 8
        }
    ]
}
*/

/**
 * Get all pending vulnerabilities for the given organisation
 * @param {Object} request - The Standard ExpressJS request variable.
 * @param {Object} response - The Standard ExpressJS response variable.
 */
function getPendingForOrganisation(request, response) {
  let organisationId = request.params.id;
  let groupByParameter = apiParametersHelper.getQueryParameter(request, 'group-by');
  let groupByReport = groupByParameter === 'report';

  // If we're not grouping by report, we have no need for this
  if (!groupByReport) {
    response.status(404);
    response.jsend.fail('Only `?group-by=report` is currently supported');
  }

  vulnerabilityModel.getPendingForOrganisation(organisationId).then((pendingVulnerabilities) => {
    const result = _.chain(pendingVulnerabilities)
      .map('reports')
      .groupBy('_id')
      .value();

    let final = [];
    _.each(result, function (item, id) {
      const resultObject = {
        id,
        name: item[0].report_name,
        count: _.size(item)
      };
      final.push(resultObject);
    });

    response.jsend.success(final);
  });
}

/**
 * @api {get} /api/v1/organisations/:id/reports/:reportId/vulnerabilities/pending
 * Gets pending vulnerabilities for the given report
 * @apiVersion 1.0.0
 * @apiName Get pending vulnerabilities for report
 * @apiGroup Vulnerability
 * @apiParam (URL) {String} id Organisation ID
 * @apiParam (URL) {String} reportId Report ID
 * @apiParam (Query) {Number} [page] The page number if using pagination
 * @apiParam (Query) {Number} [limit] Number of items to return if using pagination
 * @apiParam (Query) {String} [sort-by] Sort the result options are
 *  `name`, `reports.report_name`. Add minus (-) for descending. e.g. `-name`
 * @apiSuccessExample {json} Success response:
 *
{
    "status": "success",
    "data": {
        "total_vulnerabilities": 1,
        "vulnerabilities": [
            {
                "_id": "595a0b2bcf714b04513ddd5f",
                "nessus_scan_id": 6,
                "nessus_host_id": 2,
                "target": "139.59.76.82",
                "tenable_plugin_id": 10881,
                "name": "SSH Protocol Versions Supported",
                "severity": 4,
                "count": 1,
                "description": "This plugin determines the versions of the SSH protocol supported
                by the remote SSH daemon.",
                "history": {
                    "_id": "595b3138371b440769cb81f3",
                    "action": "proposed_close_date",
                    "status": "pending",
                    "requested_by": 2,
                    "requested_at": "2017-07-04T06:10:00.000Z"
                },
                "reports": {
                    "_id": "595a0b2bcf714b04513ddd79",
                    "report_name": "Etisalat_Ad_Hoc_June 24, 2017 7:10 AM"
                }
            }
        ]
    }
}
*/

/**
 * Gets pending vulnerabilities for the given report
 * @param {Object} request - The Standard ExpressJS request variable.
 * @param {Object} response - The Standard ExpressJS response variable.
 */
function getPendingForReport(request, response) {
  let sortByParameter = apiParametersHelper.getQueryParameter(request, 'sort-by');
  let organisationId = request.params.id;
  let reportId = request.params.reportId;
  let { itemsPerPage, pageNumber } = apiParametersHelper.extractPaginationParameters(request);

  vulnerabilityModel.getPendingForOrganisation(organisationId, null, reportId).then(
    (pendingVulnerabilitiesResult) => {
      let pendingVulnerabilities = pendingVulnerabilitiesResult;

      // Sort if required
      if (sortByParameter !== null) {
        pendingVulnerabilities = dbSortingHelper.sortArrayElements(pendingVulnerabilities,
          sortByParameter);
      }

      pendingVulnerabilities = paginationHelper.paginateArray(pendingVulnerabilities, itemsPerPage,
        pageNumber);

      response.jsend.success({
        total_vulnerabilities: pendingVulnerabilities.length,
        vulnerabilities: pendingVulnerabilities
      });
    });
}

/**
 * @api {put}
 *  /api/v1/organisations/:organisation_id/reports/:reportId/vulnerabilities/:vulnerabilityId/notes
 *  Add note to vulnerability
 * @apiVersion 1.0.0
 * @apiName addNotesToVulnerability
 * @apiGroup Vulnerability
 * @apiParam (URL) {String} organisation_id Organisation ID
 * @apiParam (URL) {String} reportId Report ID
 * @apiParam (URL) {String} vulnerabilityid Vulnerability ID

 * @apiParamExample {json} PUT Input JSON
 {
"notes":{
  "note":"this is the not for vulnerability"
 }
}
* @apiSuccessExample {json} Success response:
{
    "status": "success",
    "data": {
        "notes": [
            {
                "note": "this is 2nd note",
                "created_by": 1,
                "id": "5963766f860dcc0c7df4fe11",
                "created_at": "2017-07-10T12:43:27.172Z"
            },
            {
                "note": "this is another note",
                "created_by": 1,
                "id": "596379bbcf201d0ca976c2b2",
                "created_at": "2017-07-10T12:57:31.571Z"
            }
        ]
    }
}
*/

/**
 * add Notes to Vulnerability
 * @param {Object} request - The Standard ExpressJS request variable.
 * @param {Object} response - The Standard ExpressJS response variable.
 */
function addNote(request, response) {
  let organisationId = request.params.id;
  let vulnerabilityId = request.params.vulnerabilityId;
  let vulnerabilityCollection = config.mongo.tables.vulnerabilities;
  let queryParams = { _id: new MongoObjectId(vulnerabilityId) };
  let fieldsToSet = {};

  // Get the fields that we are allowed to update
  fieldsToSet = apiParametersHelper.getWritableParameters(request
    , vulnerabilityModel.writableFields);

  if (!_.isEmpty(fieldsToSet) &&
    Object.prototype.hasOwnProperty.call(fieldsToSet, 'notes')) {
    // Update the object
    fieldsToSet.notes.created_by = request.decoded.id;

    modelsHelper.addNotes(organisationId, vulnerabilityCollection,
      queryParams, fieldsToSet).then((result) => {
        if (result === null) {
          response.status(500);
          response.jsend.fail(['Update failed']);
        } else if (result === modelsHelper.ERROR_EMPTY_FIELD_NOTES) {
          response.jsend.fail(['`note` field is required']);
        } else {
          // fetch the data for updated vulnerability
          getVulnerabilityForAPI(organisationId, queryParams)
            .then(function (vulnerabilityToReturn) {
              // add user info for the users in note objects
              usersAPIHelper.filloutObjectsWithUserInfo(vulnerabilityToReturn.notes)
                .then(function (notesWithUserInfo) {
                  response.jsend.success({
                    notes: notesWithUserInfo
                  });
                });
            });
        }
      });
  } else {
    response.status(422);
    response.jsend.fail(['Update failed. Nothing to update.']);
  }
}

/**
 * @api {get}
 *  /api/v1/organisations/:organisation_id/reports/:reportId/vulnerabilities/:vulnerabilityId/notes
 * Get notes for a vulnerability
 * @apiVersion 1.0.0
 * @apiName getNotesForVulnerability
 * @apiGroup Vulnerability
 * @apiParam (URL) {String} organisation_id Organisation ID
 * @apiParam (URL) {String} reportId Report ID
 * @apiParam (URL) {String} vulnerabilityid Vulnerability ID
 *
 * @apiSuccessExample {json} Success response:
 {
    "status": "success",
    "data": {
        "notes": [
            {
                "note": "this is 2nd note",
                "created_by": 1,
                "id": "5963766f860dcc0c7df4fe11",
                "created_at": "2017-07-10T12:43:27.172Z"
            }
        ]
    }
}

*/

/**
  * get Notes for a Vulnerability
  * @param {Object} request - The Standard ExpressJS request variable.
  * @param {Object} response - The Standard ExpressJS response variable.
  */
function getNotes(request, response) {
  let organisationId = request.params.id;
  let vulnerabilityId = request.params.vulnerabilityId;

  vulnerabilityModel.getNotesForVulnerability(organisationId, vulnerabilityId)
    .then(function (vulnerabilityToReturn) {
      if (vulnerabilityToReturn === null) {
        response.status(404);
        response.jsend.fail(['No vulnerability with this ID found']);
      }

      if (!Object.prototype.hasOwnProperty.call(vulnerabilityToReturn, 'notes')) {
        vulnerabilityToReturn.notes = [];
      }
      // add user info for the users in note objects
      usersAPIHelper.filloutObjectsWithUserInfo(vulnerabilityToReturn.notes)
        .then(function (notesWithUserInfo) {
          response.jsend.success({
            notes: notesWithUserInfo
          });
        });
    });
}

/**
 * @api {patch}
 *  /api/v1/organisations/:id/reports/:reportId/vulnerabilities/:vulnerabilityId/notes/:noteId
 *  update note for a vulnerability
 * @apiVersion 1.0.0
 * @apiName updateNoteToVulnerability
 * @apiGroup Vulnerability
 * @apiParam (URL) {String} id Organisation ID
 * @apiParam (URL) {String} reportId Report ID
 * @apiParam (URL) {String} vulnerabilityId Vulnerability ID
 * @apiParam (URL) {String} noteId note ID

 * @apiParamExample {json} PUT Input JSON
 {
  "notes": {
    "note": "updated 2nd note"
  }
}
* @apiSuccessExample {json} Success response:
{
    "status": "success",
    "data": {
        "notes": [
            {
                "note": "This is first note",
                "created_by": 1,
                "id": "5963401b00b9b0060b2f615a",
                "created_at": "2017-07-10T08:51:39.711Z",
                "updated_at": "2017-07-10T10:53:48.146Z",
                "updated_by": 1
            },
            {
                "note": "updated 2nd note",
                "created_by": 1,
                "id": "59635db5c40464086a514d56",
                "created_at": "2017-07-10T10:57:57.014Z",
                "updated_at": "2017-07-10T11:03:17.672Z",
                "updated_by": 1
            }
        ]
    }
}
*/

/**
  * update Note for a Vulnerability
  * @param {Object} request - The Standard ExpressJS request variable.
  * @param {Object} response - The Standard ExpressJS response variable.
  */
function updateNote(request, response) {
  let organisationId = request.params.id;
  let vulnerabilityId = request.params.vulnerabilityId;
  let noteId = request.params.noteId;

  // Get the vulnerability item by ID and history ID
  let vulnerabilityQuery = {
    _id: MongoObjectId(vulnerabilityId),
    notes: { $elemMatch: { id: MongoObjectId(noteId) } }
  };

  let fieldsToSet = {};

  // Get the fields that we are allowed to update
  fieldsToSet = apiParametersHelper.getWritableParameters(request
    , vulnerabilityModel.writableFields);

  if (!_.isEmpty(fieldsToSet) &&
    Object.prototype.hasOwnProperty.call(fieldsToSet, 'notes')) {
    fieldsToSet.notes.updated_by = request.decoded.id;

    modelsHelper.updateNote(organisationId, config.mongo.tables.vulnerabilities,
      vulnerabilityQuery, fieldsToSet).then((result) => {
        if (result === null) {
          response.status(500);
          response.jsend.fail(['Update failed']);
        } else if (result === modelsHelper.ERROR_EMPTY_FIELD_NOTES) {
          response.jsend.fail(['`note` field is required']);
        } else {
          // fetch the data for updated notes
          getVulnerabilityForAPI(organisationId, vulnerabilityQuery)
            .then(function (vulnerabilityToReturn) {
              // add user info for the users in note objects
              usersAPIHelper.filloutObjectsWithUserInfo(vulnerabilityToReturn.notes)
                .then(function (notesWithUserInfo) {
                  response.jsend.success({
                    notes: notesWithUserInfo
                  });
                });
            });
        }
      });
  } else {
    response.status(422);
    response.jsend.fail(['Update failed. Nothing to update.']);
  }
}
/**
 * @api {delete}
 *  /api/v1/organisations/:id/reports/:reportId/vulnerabilities/:vulnerabilityId/notes/:noteId
 *  delete note for a vulnerability
 * @apiVersion 1.0.0
 * @apiName deleteNoteToVulnerability
 * @apiGroup Vulnerability
 * @apiParam (URL) {String} id Organisation ID
 * @apiParam (URL) {String} reportId Report ID
 * @apiParam (URL) {String} vulnerabilityId Vulnerability ID
 * @apiParam (URL) {String} noteId note ID

* @apiSuccessExample {json} Success response:
{
    "status": "success",
    "data": {
        "notes": [
            {
                "note": "This is first note",
                "created_by": 1,
                "id": "5963401b00b9b0060b2f615a",
                "created_at": "2017-07-10T08:51:39.711Z",
                "updated_at": "2017-07-10T10:53:48.146Z",
                "updated_by": 1
            },
            {
                "note": "updated 2nd note",
                "created_by": 1,
                "id": "59635db5c40464086a514d56",
                "created_at": "2017-07-10T10:57:57.014Z",
                "updated_at": "2017-07-10T11:03:17.672Z",
                "updated_by": 1
            }
        ]
    }
}
*/

/**
  * delete Note for a Vulnerability
  * @param {Object} request - The Standard ExpressJS request variable.
  * @param {Object} response - The Standard ExpressJS response variable.
  */
function deleteNote(request, response) {
  let organisationId = request.params.id;
  let vulnerabilityId = request.params.vulnerabilityId;
  let noteId = request.params.noteId;

  // Get the vulnerability item by ID and history ID
  let vulnerabilityQuery = {
    _id: MongoObjectId(vulnerabilityId),
    notes: { $elemMatch: { id: MongoObjectId(noteId) } }
  };

  modelsHelper.deleteNote(organisationId, noteId, config.mongo.tables.vulnerabilities,
    vulnerabilityQuery).then((result) => {
      if (result === null) {
        response.status(500);
        response.jsend.fail(['Delete failed']);
      } else {
        // fetch the data for delete notes
        getVulnerabilityForAPI(organisationId, MongoObjectId(vulnerabilityId))
          .then(function (vulnerabilityToReturn) {
            if (!Object.prototype.hasOwnProperty.call(vulnerabilityToReturn, 'notes')) {
              vulnerabilityToReturn.notes = [];
            }

            // add user info for the users in note objects
            usersAPIHelper.filloutObjectsWithUserInfo(vulnerabilityToReturn.notes)
              .then(function (notesWithUserInfo) {
                response.jsend.success({
                  notes: notesWithUserInfo
                });
              });
          });
      }
    });
}

/**
 * get vulnerabilities for given searchable id
 * @param {Integer} organisationId - ID of the organisation
 * @param {Integer} searchParameter - search id to filter vulnerabilities
 * @return {Object} returns a promise to get the vulnerabilities
 */
function getVulnerabilitiesForSearchableId(organisationId, searchParameter) {
  // searchable_ids starting with searchParameter
  const orQueryParams = [{ searchable_id: new RegExp('^' + searchParameter) }];

  if (mongo.isMongoId(searchParameter)) {
    orQueryParams.push({ _id: MongoObjectId(searchParameter) });
  }

  const queryParameters = { $or: orQueryParams };

  // Get vulnerabilities for searchable_id
  return mongo.find(organisationId, config.mongo.tables.vulnerabilities, queryParameters);
}

/**
 * get vulnerabilities from cursor
 * @param {Object} vulnerabilitiesWithSearchableIdsCursor - cursor object on vulnerabilities
 * @param {Object} pp - pagination parameters
 * @param {Object} response - response object to send data
 */
function returnVulnerablitiesFromCursorForSearchableIds(
  vulnerabilitiesWithSearchableIdsCursor, pp, response) {
  let vulnerabilitiesCursor = vulnerabilitiesWithSearchableIdsCursor;
  let mongoSortingOptions = { searchable_id: 1 };
  vulnerabilitiesCursor.sort(mongoSortingOptions);

  // Paginate
  vulnerabilitiesCursor = paginationHelper.mongo(vulnerabilitiesCursor,
    pp.itemsPerPage, pp.pageNumber);

  vulnerabilitiesCursor.toArray((err, dbVulnerabilities) => {
    const vulnerabilityToReturn = mapperHelper
      .mapObjects(dbVulnerabilities, vulnerabilityModel.mapApi);

    // update report object properties through mapper
    _.transform(vulnerabilityToReturn, function (result, value) {
      if (hasProperty(value, 'reports')) {
        value.reports = mapperHelper.mapObjects(value.reports, reportsModel.mapApi);
      }

      result = value; // eslint-disable-line no-param-reassign
    });

    response.jsend.success({
      vulnerabilities: vulnerabilityToReturn
    });
  });
}

/**
 * get vulnerabilities including report info for given searchable id
 * @param {Integer} organisationId - ID of the organisation
 * @param {Integer} searchParameter - search id to filter vulnerabilities
 * @return {Object} returns a promise to get the vulnerabilities alongside array of reports
 */
function getVulnerabilitiesForSearchableIdWithReports(organisationId, searchParameter) {
  // searchable_ids starting with searchParameter
  const orQueryParams = [{ searchable_id: new RegExp('^' + searchParameter) }];

  if (mongo.isMongoId(searchParameter)) {
    orQueryParams.push({ _id: MongoObjectId(searchParameter) });
  }

  const queryParameters = { $or: orQueryParams };

  return vulnerabilityModel.buildVulnerabilityQuery(organisationId, queryParameters, false);
}

/* eslint-disable max-len */
/**
 * @api {get} /api/v1/organisations/:id/vulnerabilities?outside-sla=1&reports=xxx,yyy&group-by=report&search=7&expand=reports
 * get vulnerabilities for given organisation
 * @apiVersion 1.0.0
 * @apiName vulnerabilitiesForOrganisation
 * @apiGroup Vulnerability
 * @apiParam (URL) {String} id Organisation ID
 * @apiParam (Query) {String} [reports] comma separated string of reportIDs
 * @apiParam (Query) {String} [group-by] group-by=report to get vulnerabilities by report
 * @apiParam (Query) {String} [outside-sla] outside-sla=1 to get vulnerabilities breaching SLA
 * @apiParam (Query) {String} [search] searchable id for Vulnerability
 * @apiParam (Query) {String} [expand] expand by reports allowed alongside searchable id

 * @apiSuccessExample {json} Vulnerabilities outside-SLA:
 {
    "status": "success",
    "data": {
        "reports": [
            {
                "report_id": "59674de28d270d0619c82c04",
                "report_name": "Org_Split_Monthly_July 06, 2017 7:01 AM",
                "vulnerabilities": [
                    {
                        "_id": "59674de08d270d0619c82be2",
                        "nessus_scan_id": 6,
                        "nessus_host_id": 2,
                        "target": "139.59.76.82",
                        "tenable_plugin_id": 56468,
                        "name": "Time of Last System Startup",
                        "severity": 2,
                        "count": 3,
                        "sla": {
                            "days": 4,
                            "expiry_date": "2017-07-18T12:49:58.000Z"
                        }
                    }
                ]
            },
            {
                "report_id": "596757c98d270d0619c82c20",
                "report_name": "Org_Split_Monthly_July 13, 2017 11:19 AM",
                "vulnerabilities": [
                    {
                        "_id": "59674de08d270d0619c82be3",
                        "nessus_scan_id": 6,
                        "nessus_host_id": 2,
                        "target": "139.59.76.82",
                        "tenable_plugin_id": 35351,
                        "name": "System Information Enumeration (via DMI)",
                        "severity": 2,
                        "count": 3,
                        "sla": {
                            "days": 4,
                            "expiry_date": "2017-07-18T12:49:58.000Z"
                        }
                    },
                    {
                        "_id": "59674de18d270d0619c82bf6",
                        "nessus_scan_id": 6,
                        "nessus_host_id": 2,
                        "target": "139.59.76.82",
                        "tenable_plugin_id": 51192,
                        "name": "SSL Certificate Cannot Be Trusted",
                        "severity": 2,
                        "count": 3,
                        "notes": [
                            {
                                "note": "this is a test note.",
                                "created_by": 3,
                                "id": "596c6f5ea5296a1cae96e3d8",
                                "created_at": "2017-07-17T08:03:42.055Z"
                            }
                        ],
                        "proposed_close_date": {
                            "reason": "PCD",
                            "date": "2017-07-17T08:03:52.973Z",
                            "status": "proposed"
                        },
                        "history": [
                            {
                                "_id": "596c6f69a5296a1cae96e3d9",
                                "action": "proposed_close_date",
                                "status": "proposed",
                                "previous_values": {},
                                "new_values": {
                                    "proposed_close_date": {
                                        "reason": "PCD",
                                        "date": "2017-07-17T08:03:52.973Z"
                                    }
                                },
                                "updated_by": 3,
                                "updated_at": "2017-07-17T08:03:53.129Z"
                            }
                        ],
                        "sla": {
                            "days": 4,
                            "expiry_date": "2017-07-18T12:49:58.000Z"
                        }
                    }
                ]
            }
        ]
    }
}

* @apiSuccessExample {json} Response for searchable ID:
{
    "status": "success",
    "data": {
        "vulnerabilities": [
            {
                "id": "597db5dea45d3509ac7b465b",
                "nessus_scan_id": 6,
                "nessus_host_id": 2,
                "target": "139.59.76.82",
                "tenable_plugin_id": 33276,
                "name": "Enumerate MAC Addresses via SSH",
                "severity": 0,
                "count": 0,
                "searchable_id","74"
                "reports": [
                    {
                        "id": "597db5dea45d3509ac7b4670",
                        "report_name": "Org_Split_Monthly_July 30, 2017 9:58 AM"
                    },
                    {
                        "id": "597db5dfa45d3509ac7b4681",
                        "report_name": "Org_Split_Ad_Hoc_July 30, 2017 7:15 AM"
                    }
                ]
            }
        ]
    }
}
 */
/* eslint-enable max-len */
/**
  * get vulnerabilities outside SLA for given organisation
  * @param {Object} request - The Standard ExpressJS request variable.
  * @param {Object} response - The Standard ExpressJS response variable.
  */
function getVulnerabilitiesForOrganisation(request, response) {
  let returnReportsWithVulnerabilities = [];
  let organisationId = request.params.id;
  let reportIDs = apiParametersHelper.getQueryParameter(request, 'reports');
  let groupByParameter = apiParametersHelper.getQueryParameter(request, 'group-by');
  let outSideSLAParameter = apiParametersHelper.getQueryParameter(request, 'outside-sla');
  let searchParameter = apiParametersHelper.getQueryParameter(request, 'search');
  let expandParameter = apiParametersHelper.getQueryParameter(request, 'expand');
  let pp = apiParametersHelper.extractPaginationParameters(request);

  let groupByReport = groupByParameter === 'report';
  let outSildeSLA = outSideSLAParameter === '1';

  if (searchParameter) {
    if (expandParameter !== null && expandParameter === 'reports') {
      getVulnerabilitiesForSearchableIdWithReports(organisationId, searchParameter)
        .then(vulnerabilitiesWithSearchableIdsCursor =>
          returnVulnerablitiesFromCursorForSearchableIds(
            vulnerabilitiesWithSearchableIdsCursor, pp, response));
    } else {
      getVulnerabilitiesForSearchableId(organisationId, searchParameter)
        .then(vulnerabilitiesWithSearchableIdsCursor =>
          returnVulnerablitiesFromCursorForSearchableIds(
            vulnerabilitiesWithSearchableIdsCursor, pp, response));
    }
  } else {
    // If we're not grouping by report, we have no need for this
    if (!groupByReport) {
      response.status(404);
      response.jsend.fail('Only `?group-by=report` is currently supported');
    }
    if (!outSildeSLA) {
      response.status(404);
      response.jsend.fail('Only `?outside-sla=1` is currently supported');
    }
    if (!reportIDs) {
      response.status(404);
      response.jsend.fail('reports not specified');
    }

    const reportIds = reportIDs.split(',');

    // Get the SLA limits
    orgServicesModel.getOrgSlasForVulnerabilities(organisationId).then(
      slasForVulnerabilties =>
        vulnerabilityModelFile.getVulnerabiltiesByReports(organisationId, reportIds)
          .then(function (vulnerabilities) {
            if (vulnerabilities) {
              return vulnerabilities.toArray().then(function (reportsWithVulnerabilities) {
                reportsWithVulnerabilities = vulnerabilityModelFile.formatReportFields(reportsWithVulnerabilities);

                _.each(reportsWithVulnerabilities, function (reportWithVulnerabilities) {
                  const confirmedVulnerabilities = [];
                  const reportDateTime = reportWithVulnerabilities.utc_time;

                  _.each(reportWithVulnerabilities.vulnerabilities, function (vulnerability) {
                    // Skip info severities
                    if (vulnerability.severity === 0) {
                      return;
                    }

                    const slaDays = vulnerabilityModelFile.getSlaDaysBySeverityNumber(
                      slasForVulnerabilties.data, vulnerability.severity);
                    const vulnerabilityOpenOutsideSla = slaHelper.isVulnerabilityOpenAndOutsideSla(
                      vulnerability, slaDays, reportDateTime);
                    const vulnerabilityClosedOutsideSla = slaHelper.wasVulnerabilityClosedOutsideSla(
                      vulnerability, slaDays, reportDateTime);

                    if ((vulnerabilityOpenOutsideSla) || (vulnerabilityClosedOutsideSla)) {
                      const slaVulnerability = slaHelper.appendSlaInformationToVulnerability(
                        vulnerability, slaDays, reportDateTime);
                      vulnerability.is_closed = vulnerabilityModelFile.isClosed(vulnerability);
                      confirmedVulnerabilities.push(slaVulnerability);
                    }
                  });

                  if (confirmedVulnerabilities.length > 0) {
                    const mappedReportWithVulnerabilities =
                      mapperHelper.map(reportWithVulnerabilities, reportsModel.mapApi);
                    mappedReportWithVulnerabilities.vulnerabilities = confirmedVulnerabilities;
                    mappedReportWithVulnerabilities.report_id = reportWithVulnerabilities._id;
                    returnReportsWithVulnerabilities.push(mappedReportWithVulnerabilities);
                  }
                });

                response.jsend.success({
                  reports: returnReportsWithVulnerabilities
                });
              });
            } else {
              response.jsend.fail({
                reports: returnReportsWithVulnerabilities
              });
            }
          }));
  }
}

/**
 * @api {patch}
 *  /api/v1/organisations/:organisation_id/vulnerabilities/lock
 *  Lock a vulnerability
 * @apiVersion 1.0.0
 * @apiName lockVulnerabilities
 * @apiGroup Vulnerability
 * @apiParam (URL) {String} [organisation_id] Organisation ID
 * @apiParam (URL) {Array} [vulnerabilityIds] array of vulnerability IDs
 * @apiParamExample {json} PATCH Input JSON
  {
    vulnerabilityIds: ['59674de08d270d0619c82be2', '59674de08d270d0619c82be2']
  }
 * @apiSuccessExample {json} Success response for locking vulnerabilities:
  {
      "status": "success",
      "data": {
        message: 'Lock success'
      }
  }
  @apiSuccessExample {json} Success response for partial locking vulnerabilities:
  {
      "status": "success",
      "data": {
        message: 'Some Items already locked'
      }
  }
  @apiErrorExample {json} Fail response for locking vulnerabilities:
  {
      "status": "locked",
      "data": {
        message: 'Already locked'
      }
  }
*/
/**
 *
* @param {Object} req - The Standard ExpressJS request variable.
* @param {Object} res - The Standard ExpressJS response variable.
 * @return {Object} returns a promise to lock vulnerabilities
 */
function lockVulnerabilities(req, res) {
  const organisationId = req.params.id;
  const userInfo = req.decoded;
  const vulnerabilityIds = apiParametersHelper.getBodyParameter(req, 'vulnerabilityIds');

  return vulnerabilityModel.lockVulnerabilitiesByIds(organisationId, vulnerabilityIds, userInfo)
    .then((result) => {
      if (!result) {
        res.status(500);
        res.jsend.fail({ message: 'Lock failed' });
      } else if (result.matchedCount === 0) {
        res.status(423);
        res.jsend.fail({ message: 'Already locked' });
      } else if (vulnerabilityIds.length !== result.matchedCount) {
        res.status(207);
        res.jsend.success({ message: 'Some Items already locked' });
      } else {
        res.jsend.success({ message: 'Lock success' });
      }
    })
    .catch(() => {
      res.status(500);
      res.jsend.fail({ message: 'Lock failed' });
    });
}

/**
 * @api {get}
 *  /api/v1/organisations/:organisation_id/vulnerabilities/:vulnerabilityId/lock
 *  Check is a vulnerability locked
 * @apiVersion 1.0.0
 * @apiName isVulnerabilityLocked
 * @apiGroup Vulnerability
 * @apiParam (URL) {String} [organisation_id] Organisation ID
 * @apiParam (URL) {String} [vulnerabilityId] Vulnerability ID
 *
 * @apiSuccessExample {json} Success response for locked vulnerability:
  {
      "status": "locked",
      "data": {
        locked: true,
      }
  }
  @apiSuccessExample {json} Success response for doesn't locked vulnerability:
  {
      "status": "success",
      "data": {
        locked: false,
      }
  }
*/
/**
 *
* @param {Object} req The Standard ExpressJS request variable.
* @param {Object} res The Standard ExpressJS response variable.
 * @return {Object} Checks if the vulnerability is locked, returns true if so
 */
function isVulnerabilityLocked(req, res) {
  const organisationId = req.params.id;
  const vulnerabilityId = req.params.vulnerabilityId;
  const vulnerabilityTable = config.mongo.tables.vulnerabilities;

  const queryParams = {
    _id: new MongoObjectId(vulnerabilityId)
  };

  return mongo.findOne(organisationId, vulnerabilityTable, queryParams)
    .then((response) => {
      const { locked, _id } = response;
      if (!_id) {
        res.status(404);
        res.jsend.fail({ message: 'Check failed' });
      } else if (!vulnerabilityModel.isLocked(locked, req.decoded.id)) {
        res.jsend.success({
          locked: false
        });
      } else {
        res.status(423);
        res.jsend.fail({
          locked: true
        });
      }
    })
    .catch(() => {
      res.status(500);
      res.jsend.fail({ message: 'Check failed' });
    });
}

const validateRecurringChartParameters = (req, res, next) => {
  const domainName = apiParametersHelper.getQueryParameter(req, 'scan_domain');

  if (domainName) {
    next();
  } else {
    res.status(422);
    res.jsend.fail(['Scan domain is required']);
  }
};

const groupVMByScan = (result) => {
  let scanObjects = result.scans;
  let reportObjects = result.reports;
  let groupedByScan = _.groupBy(reportObjects, 'scan_id');
  let resultArray = [];

  scanObjects.forEach((scan) => {
    if (groupedByScan[scan.tenable_scan_id]) {
      scan.reports = groupedByScan[scan.tenable_scan_id][0];
      scan.vulnerabilities = _.compact(scan.reports.vulnerabilities);

      delete scan.reports.vulnerabilities;
      resultArray.push(scan);
    }
  });

  return resultArray;
};

/**
 * @api {GET}
 *  /api/v1/organisations/:organisation_id/dashboard/exceptions
 *  Get exceptions chart data
 * @apiVersion 1.0.0
 * @apiName getVulnerabilitiesByFields
 * @apiGroup Charts
 * @apiParam (URL) {String} organisation_id Organisation ID
 * @apiParam (Query){String} scan_domain Name of the scan domain
 * @apiParam (Query) {String} [scan_id] Mongo Id of the scan
 * @apiParam (Query) {String} [report_id] Mongo Id of the report
 * @apiParam (Query){String} [scan_type] type of scans i.e (Ad-hoc, monthly, quaterly,semi-annual,annual)
 * @apiParam (Query){String} [start-date] Start date to start searching from (in seconds since 1970)
 * @apiParam (Query){String} [end-date] End date to start searching from (in seconds since 1970)
 *
* @apiSuccessExample {json} Success response:
{
    "status": "success",
    "data": {
        "exceptions": {
            "chartData": [
                {
                    "ip-core": [
                        {
                            "Date": "Jan-21",
                            "ExceptionGranted": 0,
                            "ExceptionPercent": "0%",
                            "VulnerabilityInstances": 112448
                        }
                    ]
                }
            ]
        },
        "recurringDomain": {
            "chartData": [
                {
                    "ip-core": [
                        {
                            "Date": "Dec-20 Vs Jan-21",
                            "Critical": 3448,
                            "High": 31344
                        }
                    ]
                }
            ]
        },
        "noOpenCriticalHigh": {
            "chartData": [
                {
                    "Domain": "ip-core",
                    "Nodes": 112448,
                    "SafeNodes": 77656,
                    "Percentage": "69%"
                }
            ]
        },
        "fixedInSLA": {
            "chartData": [
                {
                    "Date": "Jan-21",
                    "fixedInSLA": 0,
                    "fixedInSLAPercent": "0%",
                    "totalVulnerabilities": 3626595
                }
            ]
        },
        "topVulnerabilities": {
            "vulnerabilities": [
                {
                    "id": "5e8896c405fe0c36cd137e08",
                    "name": "Unix Operating System Unsupported Version Detection",
                    "port": "0/TCP",
                    "count": 442,
                    "severity": 4
                }
            ]
        },
        "scanAccuracy": {
            "chartData": [
                {
                    "domain": "ip-core",
                    "vulnerabilities_instances": 112448,
                    "accuracy": "100.00%"
                }
            ]
        }
    }
}
*/

/**
 * Get exceptions chart data
 * @param {Object} request - The Standard ExpressJS request variable.
 * @param {Object} response - The Standard ExpressJS response variable.
 */
const getVulnerabilitiesByFields = async (req, res) => {
  const organisationId = req.params.id;
  const domainName = apiParametersHelper.getQueryParameter(req, 'scan_domain');
  const scanId = apiParametersHelper.getQueryParameter(req, 'scan_id');
  const reportId = apiParametersHelper.getQueryParameter(req, 'report_id');
  const scanType = apiParametersHelper.getQueryParameter(req, 'scan_type');
  const startDate = apiParametersHelper.getQueryParameter(req, 'start-date');
  const endDate = apiParametersHelper.getQueryParameter(req, 'end-date');
  const monthRange = apiParametersHelper.getQueryParameter(req, 'months_range');
  let startDateISO = null;
  let endDateISO = null;
  let scanqueryParameters = {};

  let reportQueryParameters = {
    fromDate: moment().subtract(parseInt(monthRange), 'months').startOf('month').toISOString()
  };

  if (domainName) {
    scanqueryParameters["scan_domain"] = encodeURI(domainName);
  }

  if (scanId) {
    scanqueryParameters['_id'] = MongoObjectId(scanId);
    reportQueryParameters = {};
  }

  if (scanType) {
    scanqueryParameters['scan_type'] = scanType;
    reportQueryParameters = {};
  }

  if (reportId) {
    reportQueryParameters = { '_id': MongoObjectId(reportId) };
  }

  // create filter object based on start-date & end-date
  if (startDate && endDate) {
    startDateISO = modelHelper.convertMillisecondsToISOString(startDate);
    endDateISO = modelHelper.convertMillisecondsToISOString(endDate);

    reportQueryParameters['fromDate'] = startDateISO;
    reportQueryParameters['toDate'] = endDateISO;
  }

  try {
    let mongoURL = await dbOperation.organization().getMongoConnectionUrlByOrgId(organisationId);
    let processKey = organisationId + '-field-charts';

    if (chartProcessState[processKey] && chartProcessState[processKey].status) {
      let result = await getProcessedChartData(processKey);
      res.jsend.success(result);
    } else {
      chartProcessState[processKey] = {
        status: true
      };
      let result = await vulnerabilityModelFile.getVulnerabiltiesForCharts(mongoURL, scanqueryParameters, reportQueryParameters);
      let filteredResult = await vulnerabilityModelFile.getVulnerabiltiesForCharts(mongoURL, scanqueryParameters, reportQueryParameters, { count: { $gt: 0 }, severity: { $gt: 2 } });
      let groupedByScan = groupVMByScan(result);
      let groupedByFilteredScan = groupVMByScan(filteredResult);
      let slasForVulnerabilties = await orgServicesModel.getOrgSlasForVulnerabilities(organisationId);
      let finalResult = chartDataModel.prepareVulnerabilitiesForCharts(groupedByScan, groupedByFilteredScan, slasForVulnerabilties);

      chartProcessState[processKey].status = false;
      eventObject.emit(processKey, JSON.stringify(finalResult));
      res.jsend.success(finalResult);
    }
  } catch (error) {
    res.status(422);
    const message = error && error.message ? error.message : '';
    res.jsend.fail([constantErrors.charts.failedToGetData + message]);
  }
};

/**
 * @api {GET}
 *  /api/v1/organisations/:organisation_id/dashboard/scan-efficiency
 *  Get Scan Efficiency chart data
 * @apiVersion 1.0.0
 * @apiName getScanEfficiency
 * @apiGroup Charts
 * @apiParam (URL) {String} organisation_id Organisation ID
 * @apiParam (Query) {String} [scan_id] Mongo Id of the scan
 * @apiParam (Query) {String} [report_id] Mongo Id of the report
 * @apiParam (Query){String} [scan_type] type of scans i.e (Ad-hoc, monthly, quaterly,semi-annual,annual)
 * @apiParam (Query){String} [start-date] Start date to start searching from (in seconds since 1970)
 * @apiParam (Query){String} [end-date] End date to start searching from (in seconds since 1970)
 *
 * @apiSuccessExample {json} Success response:
 {
     "status": "success",
        "data": {
            "chartData": [
                      {
                        "domain": "RAN & BSC",
                        "nodes": 1,
                         "efficiency": "100%"
                      },
                      {
                      "domain": "OSS",
                      "nodes": 0,
                       "efficiency": "0%"
                      }
                      ]
            }
      }
 */

/**
 * Get recurring chart data
 * @param {Object} request - The Standard ExpressJS request variable.
 * @param {Object} response - The Standard ExpressJS response variable.
 */
const getScanEfficiency = (req, res) => {
  res.jsend.success({
    "chartData": [
      {
        "domain": "RAN & BSC",
        "nodes": 1,
        "efficiency": "100%"
      },
      {
        "domain": "OSS",
        "nodes": 2,
        "efficiency": "70%"
      }
    ]
  });
  /*
    const organisationId = req.params.id;
    // const domainName = apiParametersHelper.getQueryParameter(req, 'scan_domain');
    const scanId = apiParametersHelper.getQueryParameter(req, 'scan_id');
    const reportId = apiParametersHelper.getQueryParameter(req, 'report_id');
    const scanType = apiParametersHelper.getQueryParameter(req, 'scan_type');
    const startDate = apiParametersHelper.getQueryParameter(req, 'start-date');
    const endDate = apiParametersHelper.getQueryParameter(req, 'end-date');
    let startDateISO = null;
    let endDateISO = null;

    let scanqueryParameters = {

    };
    let reportQueryParameters = {
      fromDate: moment().subtract(4, 'months').startOf('month').toISOString()
    };
    let vulnerabilityQueryArray = [
      { $gte: ["$$vulnerabilities.count", 0] },
      { $gte: ["$$vulnerabilities.severity", 0] },
      { $eq: ["$$vulnerabilities.tenable_plugin_id", "19506"] }
    ];

    if (scanId) {
      scanqueryParameters['_id'] = MongoObjectId(scanId);
      reportQueryParameters = {};
    }

    if (scanType) {
      scanqueryParameters['scan_type'] = scanType;
      reportQueryParameters = {};
    }

    if (reportId) {
      reportQueryParameters = { '_id': MongoObjectId(reportId) };
    }

    // create filter object based on start-date & end-date
    if (startDate && endDate) {
      startDateISO = modelHelper.convertMillisecondsToISOString(startDate);
      endDateISO = modelHelper.convertMillisecondsToISOString(endDate);

      reportQueryParameters['fromDate'] = startDateISO;
      reportQueryParameters['toDate'] = endDateISO;
    }


    vulnerabilityModelFile.getVulnerabiltiesForCharts(organisationId, scanqueryParameters, reportQueryParameters, vulnerabilityQueryArray).then((cursor) => {
      cursor.toArray().then((result) => {
        let scansTargetByDomain = [];
        result.map(item => {
          scansTargetByDomain.push({ scan_domain: item.scan_domain, targets: item.targets })
        });
        scansTargetByDomain = _.groupBy(scansTargetByDomain, 'scan_domain');
        let chartData = getChartDataForScanEfficiency(result, scansTargetByDomain);

        res.jsend.success({ chartData });
      }).catch((error) => {
        res.status(422);
        res.jsend.fail(['Failed to get chart data.!']);
      });
    }).catch((error) => {
      res.status(422);
      res.jsend.fail(['Failed to get chart data.!']);
    });*/
};

/**
 * @api {GET}
 *  /api/v1/organisations/:organisation_id/dashboard/average-time-taken
 *  Get  average-time-taken chart data
 * @apiVersion 1.0.0
 * @apiName getAverageTimeTaken
 * @apiGroup Charts
 * @apiParam (URL) {String} organisation_id Organisation ID
 * @apiParam (Query) {String} [scan_id] Mongo Id of the scan
 * @apiParam (Query) {String} [report_id] Mongo Id of the report
 * @apiParam (Query){String} [scan_type] type of scans i.e (Ad-hoc, monthly, quaterly,semi-annual,annual)
 * @apiParam (Query){String} [start-date] Start date to start searching from (in seconds since 1970)
 * @apiParam (Query){String} [end-date] End date to start searching from (in seconds since 1970)
 *
 * @apiSuccessExample {json} Success response:
 {
     "status": "success",
        "data": {
            "chartData": [
        {date: 'Jan-19', critical: 42, high: 43, medium: 42, low: 42, info: 37},
        {date: 'Feb-19', critical: 64, high: 64, medium: 49, low: 19, info: 0},
        {date: 'Mar-19', critical: 78, high: 78, medium: 79, low: 78, info: 79},
        {date: 'Apr-19', critical: 31, high: 31, medium: 31, low: 0, info: 0},
    ]
            }
      }
 */

/**
 * Get AverageTimeTaken chart data
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 */
const getAverageTimeTaken = (req, res) => {
  // let vulnerabilityQueryArray = [
  //   { $gte: ["$$vulnerabilities.count", 0] },
  //   { $gte: ["$$vulnerabilities.severity", 0] }/*,
  //       { $ifNull: ["$$vulnerabilities.false_positive.reason", null] }*/
  // ];

  let chartData = getChartDataForAverageTimeTaken();
  res.jsend.success({ chartData });
};

/**
 * @api {GET}
 *  /api/v1/organisations/:organisation_id/dashboard/remediation-trend-summary
 *  Get  RemediationTrendSummary chart data
 * @apiVersion 1.0.0
 * @apiName getRemediationTrendSummary
 * @apiGroup Charts
 * @apiParam (URL) {String} organisation_id Organisation ID
 * @apiParam (Query) {String} [scan_id] Mongo Id of the scan
 * @apiParam (Query) {String} [report_id] Mongo Id of the report
 * @apiParam (Query){String} [scan_type] type of scans i.e (Ad-hoc, monthly, quaterly,semi-annual,annual)
 * @apiParam (Query){String} [start-date] Start date to start searching from (in seconds since 1970)
 * @apiParam (Query){String} [end-date] End date to start searching from (in seconds since 1970)
 *
 * @apiSuccessExample {json} Success response:
 {
     "status": "success",
        "data": {
            "chartData":[
        {
            month: 'Jan-19',
            CSTotalVul: 5804, CSExpectedCount: 0, CSTotalCount: 0, CSUnExpectedCount: 0,
            PSTotalVul: 3518, PSExpectedCount: 290, PSTotalCount: 0, PSUnExpectedCount: 3,
            IPTotalVul: 3799, IPExpectedCount: 187, IPTotalCount: 100, IPUnExpectedCount: 37,
            RANTotalVul: 3744, RANExpectedCount: 0, RANTotalCount: 0, RANUnExpectedCount: 180,
            OSSTotalVul: 2405, OSSExpectedCount: 0, OSSTotalCount: 0, OSSUnExpectedCount: 533,
            TelenorTotalVul: 10, TelenorExpectedCount: 0, TelenorTotalCount: 0, TelenorUnExpectedCount: 0
        },
        {
            month: 'Feb-19',
            CSTotalVul: 7682, CSExpectedCount: 0, CSTotalCount: 0, CSUnExpectedCount: 87,
            PSTotalVul: 4074, PSExpectedCount: 290, PSTotalCount: 290, PSUnExpectedCount: 164,
            IPTotalVul: 4864, IPExpectedCount: 0, IPTotalCount: 0, IPUnExpectedCount: 114,
            RANTotalVul: 3709, RANExpectedCount: 0, RANTotalCount: 4, RANUnExpectedCount: 253,
            OSSTotalVul: 3247, OSSExpectedCount: 0, OSSTotalCount: 0, OSSUnExpectedCount: 628,
            TelenorTotalVul: 10, TelenorExpectedCount: 0, TelenorTotalCount: 0, TelenorUnExpectedCount: 0
        }]
            }
      }
 */

/**
 * Get recurring chart data
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 */
const getRemediationTrendSummary = (req, res) => {
  // let vulnerabilityQueryArray = [
  //   { $gte: ["$$vulnerabilities.count", 0] },
  //   { $gte: ["$$vulnerabilities.severity", 0] }/*,
  //       { $ifNull: ["$$vulnerabilities.false_positive.reason", null] }*/
  // ];

  let chartData = getChartDataForRemediationTrendSummary();
  res.jsend.success({ chartData });
};


/**
 * @api {GET}
 *  /api/v1/organisations/:organisation_id/dashboard/vulnerabilities-closure
 *  Get  VulnerabilitiesClosure chart data
 * @apiVersion 1.0.0
 * @apiName getVulnerabilitiesClosure
 * @apiGroup Charts
 * @apiParam (URL) {String} organisation_id Organisation ID
 * @apiParam (Query) {String} [scan_id] Mongo Id of the scan
 * @apiParam (Query) {String} [report_id] Mongo Id of the report
 * @apiParam (Query){String} [scan_type] type of scans i.e (Ad-hoc, monthly, quaterly,semi-annual,annual)
 * @apiParam (Query){String} [start-date] Start date to start searching from (in seconds since 1970)
 * @apiParam (Query){String} [end-date] End date to start searching from (in seconds since 1970)
 *
 * @apiSuccessExample {json} Success response:
 {
     "status": "success",
        "data": {
            "chartData": [
 {
   month: 'Jan-19',
   totalVulnerabilities: 19280,
   expectedCount: 477,
   totalCount: 100,
   unexpectedCount: 753,
 },
 {
   month: 'Feb-19',
   totalVulnerabilities: 23586,
   expectedCount: 290,
   totalCount: 294,
   unexpectedCount: 1246,
 }
]
            }
      }
 */

/**
 * Get Vulnerabilities Closure chart data
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 */
const getVulnerabilitiesClosure = (req, res) => {
  // let vulnerabilityQueryArray = [
  //   { $gte: ["$$vulnerabilities.count", 0] },
  //   { $gte: ["$$vulnerabilities.severity", 0] }/*,
  //       { $ifNull: ["$$vulnerabilities.false_positive.reason", null] }*/
  // ];

  let chartData = getChartDataForgetVulnerabilitiesClosure();
  res.jsend.success({ chartData });
};


/**
 * @api {GET}
 *  /api/v1/organisations/:organisation_id/dashboard/mom
 *  Get getMoM chart data
 * @apiVersion 1.0.0
 * @apiName getMoM
 * @apiGroup Charts
 * @apiParam (URL) {String} organisation_id Organisation ID
 * @apiParam (Query) {String} [scan_id] Mongo Id of the scan
 * @apiParam (Query) {String} [report_id] Mongo Id of the report
 * @apiParam (Query){String} [scan_type] type of scans i.e (Ad-hoc, monthly, quaterly,semi-annual,annual)
 * @apiParam (Query){String} [start-date] Start date to start searching from (in seconds since 1970)
 * @apiParam (Query){String} [end-date] End date to start searching from (in seconds since 1970)
 *
 * @apiSuccessExample {json} Success response:
 {
     "status": "success",
        "data": {
            "chartData":
             [
 {month: 'Jan 2019-Dec 2018', critical: 0, high: 0, medium: 0, low: 0, info: 0},
 {month: 'Feb 2019-Jan 2019', critical: 5, high: 0, medium: 0, low: 0, info: 0},
 {month: 'Mar 2019-Feb 2019', critical: 0, high: 0, medium: 0, low: 0, info: 0},
 {month: 'Apr 2019-Mar 2019', critical: 0, high: 0, medium: 0, low: 0, info: 0},
];
            }
      }
 */

/**
 * Get MoM chart data
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 */
const getMoM = (req, res) => {
  // let vulnerabilityQueryArray = [
  //   { $gte: ["$$vulnerabilities.count", 0] },
  //   { $gte: ["$$vulnerabilities.severity", 0] }/*,
  //       { $ifNull: ["$$vulnerabilities.false_positive.reason", null] }*/
  // ];

  let chartData = getChartDataForMoM();
  res.jsend.success({ chartData });
};

const getIterationCount = (totalCount) => {
  let countDifference = totalCount / config.mongo.limit.dashboardCharts;
  countDifference = countDifference.toString();
  let iterationCount = 0;

  if (countDifference.indexOf('.') > -1) {
    let decimalValue = countDifference.split('.')[1];
    iterationCount = countDifference.split('.')[0];

    if (parseInt(decimalValue) > 0) {
      iterationCount++;
    }
  }

  return iterationCount;
};

const getProcessedChartData = async (processKey = '') => {
  const chartData = await once(eventObject, processKey);
  return chartData ? JSON.parse(chartData) : {};
};

/**
* @api {GET}
*  /api/v1/organisations/:organisation_id/dashboard/new-total-recurring-vulnerabilities
*  Get all vulnerabilities for organisation
* @apiVersion 1.0.0
* @apiName getAllVulnerabilitiesByOrganisation
* @apiGroup Charts
* @apiParam (URL) {String} organisation_id Organisation ID
* @apiParam (Query) {String} [scan_id] Mongo Id of the scan
* @apiParam (Query) {String} [report_id] Mongo Id of the report
* @apiParam (Query){String} [scan_type] type of scans i.e (Ad-hoc, monthly, quaterly,semi-annual,annual)
* @apiParam (Query){String} [start-date] Start date to start searching from (in seconds since 1970)
* @apiParam (Query){String} [end-date] End date to start searching from (in seconds since 1970)
*
* @apiSuccessExample {json} Success response:
{
    "status": "success",
    "data": {
        "recurring": {
            "chartData": [
                {
                    "Month": "Aug-20 Vs Sep-20",
                    "Critical": 0,
                    "High": 0
                },
                {
                    "Month": "Sep-20 Vs Oct-20",
                    "Critical": 0,
                    "High": 0
                },
                {
                    "Month": "Oct-20 Vs Nov-20",
                    "Critical": 0,
                    "High": 0
                },
                {
                    "Month": "Nov-20 Vs Dec-20",
                    "Critical": 0,
                    "High": 0
                },
                {
                    "Month": "Dec-20 Vs Jan-21",
                    "Critical": 0,
                    "High": 0
                }
            ]
        },
        "new": {
            "chartData": [
                {
                    "Month": "Sep-20",
                    "Critical": 0,
                    "High": 0,
                    "Medium": 0,
                    "Low": 0,
                    "Info": 0
                },
                {
                    "Month": "Oct-20",
                    "Critical": 0,
                    "High": 0,
                    "Medium": 0,
                    "Low": 0,
                    "Info": 0
                },
                {
                    "Month": "Nov-20",
                    "Critical": 0,
                    "High": 0,
                    "Medium": 0,
                    "Low": 0,
                    "Info": 0
                },
                {
                    "Month": "Dec-20",
                    "Critical": 0,
                    "High": 0,
                    "Medium": 0,
                    "Low": 0,
                    "Info": 0
                },
                {
                    "Month": "Jan-21",
                    "Critical": 0,
                    "High": 0,
                    "Medium": 0,
                    "Low": 0,
                    "Info": 0
                }
            ]
        },
        "total": {
            "chartData": [
                {
                    "Month": "Sep-20",
                    "Critical": 123,
                    "High": 631,
                    "Medium": 1316,
                    "Low": 116,
                    "Info": 3576
                },
                {
                    "Month": "Oct-20",
                    "Critical": 2734,
                    "High": 23390,
                    "Medium": 45955,
                    "Low": 6802,
                    "Info": 78932
                },
                {
                    "Month": "Nov-20",
                    "Critical": 818,
                    "High": 7799,
                    "Medium": 13174,
                    "Low": 1436,
                    "Info": 18146
                },
                {
                    "Month": "Dec-20",
                    "Critical": 164,
                    "High": 1348,
                    "Medium": 2829,
                    "Low": 292,
                    "Info": 6211
                },
                {
                    "Month": "Jan-21",
                    "Critical": 143523,
                    "High": 1304694,
                    "Medium": 2045361,
                    "Low": 343656,
                    "Info": 843842
                }
            ]
        }
    }
}
*/

/**
* Get Vulnerabilities for organisation
* @param {Object} req - The Standard ExpressJS request variable.
* @param {Object} res- The Standard ExpressJS response variable.
*/

const getAllVulnerabilitiesByOrganisation = async (req, res) => {
  const organizationId = req.params.id;
  const scanId = apiParametersHelper.getQueryParameter(req, 'scan_id');
  const reportId = apiParametersHelper.getQueryParameter(req, 'report_id');
  const scanType = apiParametersHelper.getQueryParameter(req, 'scan_type');
  const startDate = apiParametersHelper.getQueryParameter(req, 'start-date');
  const endDate = apiParametersHelper.getQueryParameter(req, 'end-date');
  const monthRange = apiParametersHelper.getQueryParameter(req, 'months_range');
  let startDateISO = null;
  let endDateISO = null;
  let queryParameters = {};

  if (reportId) {
    queryParameters['_id'] = new MongoObjectId(reportId);
  }

  if (scanId) {
    queryParameters['scans._id'] = new MongoObjectId(scanId);
  }

  if (scanType) {
    queryParameters['scan_type'] = scanType;
  }

  queryParameters['report_type'] = "finalised";

  // create filter object based on start-date & end-date
  if (startDate && endDate) {
    startDateISO = modelsHelper.convertMillisecondsToISOString(startDate);
    endDateISO = modelsHelper.convertMillisecondsToISOString(endDate);

    startToEndDateQueryParam = {
      $gte: startDateISO,
      $lte: endDateISO
    };
  } else {
    let toDate = new Date().toISOString();
    let fromDate = moment().subtract(parseInt(monthRange), 'months').startOf('month').toISOString();

    startToEndDateQueryParam = {
      $gte: fromDate,
      $lte: toDate
    };

    queryParameters["utc_time"] = startToEndDateQueryParam;
  }

  // add date-filter to filter Array
  if (startDate !== null && endDate !== null) {
    queryParameters["utc_time"] = startToEndDateQueryParam;
  }

  let mongoURL = await dbOperation.organization().getMongoConnectionUrlByOrgId(organizationId);
  let processKey = organizationId + '-org-charts';

  if (chartProcessState[processKey] && chartProcessState[processKey].status) {
    let result = await getProcessedChartData(processKey);
    res.jsend.success(result);
  } else {
    chartProcessState[processKey] = {
      status: true
    };
    let reports = await vulnerabilityModelFile.getVulnerabilitiesByOrganization(mongoURL, queryParameters);
    let result = require('../models/org-chart-data').getOrgChartData(reports);
    chartProcessState[processKey].status = false;
    eventObject.emit(processKey, JSON.stringify(result));
    res.jsend.success(result);
  }
}

/**
 * @api {GET}
 *  /api/v1/organisations/:organisation_id/dashboard/vm-sla
 *  Get vm-sla chart data
 * @apiVersion 1.0.0
 * @apiName getVMSLAChartData
 * @apiGroup Charts
 * @apiParam (URL) {String} organisation_id Organisation ID
 * @apiParam (Query) {String} [scan_id] Mongo Id of the scan
 * @apiParam (Query) {String} [report_id] Mongo Id of the report
 * @apiParam (Query){String} [scan_type] type of scans i.e (Ad-hoc, monthly, quaterly,semi-annual,annual)
 * @apiParam (Query){String} [start-date] Start date to start searching from (in seconds since 1970)
 * @apiParam (Query){String} [end-date] End date to start searching from (in seconds since 1970)
 *
* @apiSuccessExample {json} Success response:
{
    "status": "success",
    "data": {
        "chartData": [
            {
                "Closed Within SLA": [
                    {
                        "Date": "Nov-19",
                        "Critical": 0,
                        "High": 0,
                        "Low": 0,
                        "Medium": 0
                    },
                    {
                        "Date": "Oct-19",
                        "Critical": 0,
                        "High": 1,
                        "Low": 0,
                        "Medium": 0
                    }
                ]
            },
            {
                "Closed Out of SLA": [
                    {
                        "Date": "Nov-19",
                        "Critical": 0,
                        "High": 0,
                        "Low": 0,
                        "Medium": 2
                    },
                    {
                        "Date": "Oct-19",
                        "Critical": 0,
                        "High": 0,
                        "Low": 1,
                        "Medium": 0
                    }
                ]
            }
        ]
    }
}
*/

/**
 * Get exceptions chart data
 * @param {Object} request - The Standard ExpressJS request variable.
 * @param {Object} response - The Standard ExpressJS response variable.
 */
const getVMSLAChart = (req, res) => {

  const chartData = [{ "Closed Within SLA": [{ "Date": "May-20", "Critical": 1, "High": 0, "Low": 0, "Medium": 3 }] },
  { "Closed Out of SLA": [{ "Date": "May-20", "Critical": 4, "High": 8, "Low": 9, "Medium": 10 }] }]
  res.jsend.success({ chartData });
  /*const organisationId = req.params.id;
  const domainName = apiParametersHelper.getQueryParameter(req, 'scan_domain');
  const scanId = apiParametersHelper.getQueryParameter(req, 'scan_id');
  const reportId = apiParametersHelper.getQueryParameter(req, 'report_id');
  const scanType = apiParametersHelper.getQueryParameter(req, 'scan_type');
  const startDate = apiParametersHelper.getQueryParameter(req, 'start-date');
  const endDate = apiParametersHelper.getQueryParameter(req, 'end-date');
  let startDateISO = null;
  let endDateISO = null;
  let scanqueryParameters = {};

  let reportQueryParameters = {
    fromDate: moment().subtract(4, 'months').startOf('month').toISOString()
  };

  let vulnerabilityQueryArray = [
    { $ifNull: ["$$vulnerabilities.history", null] }
  ];

  if (domainName) {
    scanqueryParameters["scan_domain"] = encodeURI(domainName);
  }

  if (scanId) {
    scanqueryParameters['_id'] = MongoObjectId(scanId);
    reportQueryParameters = {};
  }

  if (scanType) {
    scanqueryParameters['scan_type'] = scanType;
    reportQueryParameters = {};
  }

  if (reportId) {
    reportQueryParameters = { '_id': MongoObjectId(reportId) };
  }

  // create filter object based on start-date & end-date
  if (startDate && endDate) {
    startDateISO = modelHelper.convertMillisecondsToISOString(startDate);
    endDateISO = modelHelper.convertMillisecondsToISOString(endDate);

    reportQueryParameters['fromDate'] = startDateISO;
    reportQueryParameters['toDate'] = endDateISO;
  }

  vulnerabilityModelFile.getVulnerabiltiesForCharts(organisationId, scanqueryParameters, reportQueryParameters, vulnerabilityQueryArray).then((cursor) => {
    cursor.toArray().then((result) => {
      orgServicesModel.getOrgSlasForVulnerabilities(organisationId).then((slasForVulnerabilties) => {
        let chartData = getClosedWithinAndOutOfSLAChartData(result, slasForVulnerabilties);

        res.jsend.success({ chartData });
      }).catch((error) => {
        res.status(422);
        res.jsend.fail(['Failed to get chart data.!']);
      });
    }).catch((error) => {
      res.status(422);
      res.jsend.fail(['Failed to get chart data.!']);
    });
  }).catch((error) => {
    res.status(422);
    res.jsend.fail(['Failed to get chart data.!']);
  });*/
};

/**
 * @api {get} /api/v1/organisations/:id/reports/vulnerabilities-for-map
  Requesting vulnerabilities
 * @apiVersion 1.0.0
 * @apiName GetVulnerabilitiesForMap
 * @apiGroup Vulnerability
 *
 * @apiParam (URL) {String} id Organisation ID
 * @apiParam (Query) {String} [scan_id] Mongo Id of the scan
 * @apiParam (Query) {String} [report_id] Mongo Id of the report
 * @apiParam (Query){String} [scan_type] type of scans i.e (Ad-hoc, monthly, quaterly,semi-annual,annual)
 * @apiParam (Query){String} [start-date] Start date to start searching from (in seconds since 1970)
 * @apiParam (Query){String} [end-date] End date to start searching from (in seconds since 1970)
 * @apiParam (Query) {String} [group-by] Groups vulnerabilities by the given field.
 *  E.g. `target-location,severity`
 *
 * @apiSuccess {Object[]} List of vulnerabilities
 *
 * @apiSuccessExample Successful generic response:
 {
    "status": "success",
    "data": {
        "targets": {
            "160.153.61.231": {
                "by_severity": {
                    "info": 183,
                    "low": 5,
                    "medium": 6,
                    "high": 4,
                    "total": 198
                },
                "coordinates": {
                    "long": -12.86576,
                    "lat": 10.05692
                }
            },
            "151.101.1.195": {
                "by_severity": {
                    "info": 26,
                    "low": 1,
                    "medium": 1,
                    "high": 1,
                    "critical": 2,
                    "total": 31
                }
            },
            "35.161.81.248": {
                "by_severity": {
                    "info": 40,
                    "low": 1,
                    "medium": 2,
                    "high": 1,
                    "total": 44
                }
            }
        },
        "availableSlugs": [
            {
                "slug": "security_exception",
                "access": "write",
                "isAction": true
            },
            {
                "slug": "false_positive",
                "access": "write",
                "isAction": true
            },
            {
                "slug": "ticket",
                "access": "write",
                "isAction": true
            },
            {
                "slug": "proposed_close_date",
                "access": "write",
                "isAction": true
            }
        ]
    }
}
 */
function getVulnerabilitiesForMap(req, res) {
  // Load the report
  const reportIdString = apiParametersHelper.getQueryParameter(req, 'report_id');
  const startDate = apiParametersHelper.getQueryParameter(req, 'start-date');
  const endDate = apiParametersHelper.getQueryParameter(req, 'end-date');
  const filterByScan = req.filterByScan;
  let resultArray = [];
  let processedReports = 0;
  let organisationId = req.params.id;
  let groupByArr;
  let groupField;
  let queryParamsForReport = { "report_type": "finalised" };

  queryParamsForReport.utc_time = {
    $gte: moment().subtract(4, 'months').startOf('month').toISOString()
  };

  if (reportIdString) {
    queryParamsForReport._id = new MongoObjectId(reportIdString);
    delete queryParamsForReport.utc_time;
  }

  if (filterByScan) {
    queryParamsForReport.$and = [filterByScan];
    delete queryParamsForReport.utc_time;
  }

  if (startDate && endDate) {
    let startDateISO = modelsHelper.convertMillisecondsToISOString(startDate);
    let endDateISO = modelsHelper.convertMillisecondsToISOString(endDate);

    queryParamsForReport.utc_time = {
      $gte: startDateISO,
      $lte: endDateISO
    };
  }

  // validate group-by parameters
  groupByArr = apiParametersHelper.extractGroupByParameters(req);
  groupField = null;
  if (groupByArr.length !== 0) {
    if (modelsHelper.validateArrayContents(groupByArr,
      vulnerabilityModel.constants.optionsGroupBy)) {
      if (groupByArr && groupByArr.length > 0) {
        groupField = groupByArr[0];
      }
    } else {
      groupField = null;
    }
  }

  let availableSlugs = roleAccessHelper.getAccessibleSlug(vulnerabilityModel.accessibleSlugs, req.decoded);
  // Get scan details for reportId
  reportsModel.find(organisationId, queryParamsForReport, true).then((reportsCursor) => {
    if (reportsCursor) {
      reportsCursor.toArray((reportError, reports) => {
        if (reports && reports.length > 0) {
          _.each(reports, (report) => {
            let targetsForCurrentScan = report.scan.targets;
            let vulnerabilitiesToReturn = {};
            let groupedVulnerabilitiesByTarget = report.vulnerabilities && report.vulnerabilities.length > 0 ? _.groupBy(report.vulnerabilities, 'target') : {};
            let vulnerabilities = [];

            _.forOwn(groupedVulnerabilitiesByTarget, (vulnerabilitiesArray, key) => {
              vulnerabilities.push({
                _id: key,
                vulnerabilities: vulnerabilitiesArray
              });
            });

            // Run and return Max & Minimum locations with perentage
            let groupByWrapperName;

            // Remove expired security exceptions from the vulnerability list
            vulnerabilities = vulnerabilityModel
              .removeExpiredException(vulnerabilities);

            // Sort vulnerability history items
            vulnerabilities = vulnerabilityModel
              .sortVulnerabilitiesHistory(vulnerabilities);
            // We're grouping
            if (groupField !== null) {
              groupByWrapperName =
                vulnerabilityModel.constants.optionsGroupBy[groupField].apiWrapperName;
              // Loop through the vulnerabilities to group-by
              _.each(vulnerabilities, (group) => {
                let currentTarget = _.filter(targetsForCurrentScan, { host: group._id });
                let groupByField;
                let groups;
                let objToSend = {};

                if (groupByArr.length > 1 && groupByArr[1] === 'severity') {
                  groupByField = groupByArr[1];

                  // group-by the specified attribute & create resultant object
                  groups = _.groupBy(group.vulnerabilities, groupByField);

                  // Iterate over each severity group to count vulnerabilities
                  objToSend = vulnerabilityModel.getSeverityCountForVulnerabilities(groups);

                  // add total vulnerabilities in response
                  objToSend.total = group.vulnerabilities.length;

                  vulnerabilitiesToReturn = { groupByWrapperName, groupId: group._id };

                  vulnerabilitiesToReturn['by_severity'] = objToSend;

                  if (currentTarget !== null && currentTarget.length > 0) {
                    vulnerabilitiesToReturn.coordinates =
                      currentTarget[0].coordinates;
                  }

                  resultArray.push(vulnerabilitiesToReturn);
                }
              });

              processedReports++;

              if (processedReports === reports.length) {
                let finalObject = {};
                if (resultArray.length > 0) {
                  let groupedByTarget = _.groupBy(resultArray, 'groupByWrapperName');

                  _.forOwn(groupedByTarget, (value, key) => {
                    finalObject[key] = {};
                    let groupedByTarget = _.groupBy(value, 'groupId');

                    _.forOwn(groupedByTarget, (groupValue, groupKey) => {
                      finalObject[key][groupKey] = {};
                      _.each(groupValue, (groupObject) => {
                        if (groupObject['by_severity']) {
                          finalObject[key][groupKey]['by_severity'] = groupObject['by_severity'];
                        }
                        if (groupObject['coordinates']) {
                          finalObject[key][groupKey]['coordinates'] = groupObject['coordinates'];
                        }
                      });
                    });
                  });
                }
                finalObject.availableSlugs = availableSlugs;

                res.jsend.success(finalObject);
              }

            }
          });
        } else {
          res.jsend.success({ availableSlugs, result: {} });
        }
      });
    } else {
      res.status(422);
      res.jsend.fail([constantErrors.reports.notAvailable]);
    }
  });
}

const updateReportsForScans = (req, res, next) => {
  const scanId = apiParametersHelper.getQueryParameter(req, 'scan_id');
  const scanType = apiParametersHelper.getQueryParameter(req, 'scan_type');
  const organisationId = req.params.id;
  let scanqueryParameters = {};

  if (scanId) {
    scanqueryParameters['_id'] = MongoObjectId(scanId);
  }

  if (scanType) {
    scanqueryParameters['scan_type'] = scanType;
  }

  if (_.size(scanqueryParameters) > 0) {
    mongo.find(organisationId, config.mongo.tables.scans, scanqueryParameters).then((scanCursor) => {
      if (scanCursor) {
        scanCursor.toArray().then((scanObjects) => {
          if (scanObjects && scanObjects.length > 0) {
            let queryByScan = { $or: [] };

            _.each(scanObjects, (scanObj) => {
              queryByScan.$or.push({ 'scan_id': scanObj.tenable_scan_id });
            });

            req.filterByScan = queryByScan;
            next();
          } else {
            next();
          }
        }).catch(e => next());
      } else {
        next();
      }
    }).catch(e => next());
  } else {
    next();
  }
};

router.get('/pending', getPendingGlobal);
router.get('/pendingByOrganization', getPendingGlobalOrg);

module.exports = {
  router,
  getVulnerabilities,
  getVulnerability,
  validateOrganisationVulnerabilityNameParameters,
  updateVulnerability,
  generateVulnerabilityTicket,
  getVulnerabilitiesCountByType,
  getPendingGlobal,
  getPendingForOrganisation,
  getPendingForReport,
  addNote,
  getNotes,
  updateNote,
  deleteNote,
  getVulnerabilitiesForOrganisation,
  returnVulnerablitiesFromCursorForSearchableIds,
  lockVulnerabilities,
  isVulnerabilityLocked,
  validateRecurringChartParameters,
  getVulnerabilitiesByFields,
  getScanEfficiency,
  getVMSLAChart,
  getAverageTimeTaken,
  getMoM,
  getRemediationTrendSummary,
  getVulnerabilitiesClosure,
  getVulnerabilitiesForMap,
  updateReportsForScans,
  getAllVulnerabilitiesByOrganisation
};

const vulnerabilityModelFile = require('./vulnerability');
const _ = require('lodash');
const slaHelper = require('../helpers/sla');
const moment = require('moment');

const getChartDataForExceptions = (groupedByDomain) => {
  let resultData = [];
  _.forOwn(groupedByDomain, (groupedByDomainArray, domainName) => {
    if (domainName && domainName !== 'undefined') {
      let chartData = [];

      _.each(groupedByDomainArray, (resultObject) => {
        if (resultObject.reports) {
          resultObject.reports.utc_time_modified = moment(new Date(resultObject.reports.utc_time)).format('MMM-YY');
        }
      });

      let groupedByDate = _.groupBy(groupedByDomainArray, 'reports.utc_time_modified');

      _.forOwn(groupedByDate, (value, key) => {
        if (value && value[0] && value[0].reports) {
          let utctime = value[0].reports.utc_time;
          let month = moment(utctime).format('MMM-YY');
          let DateString = month;
          let ExceptionGranted = 0;
          let ExceptionPercent = '';
          let totalVulnerabilityArray = [];

          _.each(value, (groupedData) => {
            totalVulnerabilityArray = totalVulnerabilityArray.concat(groupedData.vulnerabilities);
          });

          if (totalVulnerabilityArray.length > 0) {
            _.each(totalVulnerabilityArray, (vulnerabilityObject) => {
              if (vulnerabilityObject && vulnerabilityObject['history'] && vulnerabilityObject['history'].length > 0) {
                let indexOfHistoryObject = _.findIndex(vulnerabilityObject.history, {
                  "status": "approved"
                });

                if (indexOfHistoryObject > -1) {
                  ExceptionGranted++;
                }
              }
            });

            ExceptionPercent = Math.round(((100 * ExceptionGranted) / totalVulnerabilityArray.length) * 100) / 100 + "%";

            chartData.push({
              Date: DateString,
              ExceptionGranted,
              ExceptionPercent,
              VulnerabilityInstances: totalVulnerabilityArray.length
            });
          }
        }
      });

      if (chartData.length > 0) {
        resultData.push({ [domainName]: chartData });
      }
    }
  });

  return resultData;
};

let getFixedInSLAChartData = (result, slasForVulnerabilties) => {
  let resultData = [];

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
        let fixedInSLA = 0;
        let fixedInSLAPercent = '';
        let totalVulnerabilityArray = [];

        _.each(value, (groupedData) => {
          totalVulnerabilityArray = totalVulnerabilityArray.concat(groupedData.vulnerabilities);
        });

        if (totalVulnerabilityArray.length > 0) {
          _.each(totalVulnerabilityArray, (vulnerabilityObject) => {
            if (vulnerabilityObject.severity > 0 && vulnerabilityObject['history'] && vulnerabilityObject['history'].length > 0) {
              const slaDays = vulnerabilityModelFile.getSlaDaysBySeverityNumber(
                slasForVulnerabilties.data, vulnerabilityObject.severity);
              const slaExpiryDate = slaHelper.getSLADateForSeverity(utctime, slaDays);

              let indexOfHistoryObject = _.findIndex(vulnerabilityObject.history, {
                "requested_by": "Customer"
              });

              let historyUpdatedAt = indexOfHistoryObject > -1 ? vulnerabilityObject['history'][indexOfHistoryObject].requested_at : null;

              if (historyUpdatedAt && moment(historyUpdatedAt).isBefore(slaExpiryDate)) {
                fixedInSLA++;
              };
            }
          });

          fixedInSLAPercent = Math.round(((100 * fixedInSLA) / totalVulnerabilityArray.length) * 100) / 100 + "%";

          resultData.push({
            Date: DateString,
            fixedInSLA,
            fixedInSLAPercent,
            totalVulnerabilities: totalVulnerabilityArray.length
          });
        }
      }
    });
  }

  return resultData;
};

/**
 *
 * @param result
 * @returns {Array}
 */
const getChartDataForScanAccuracy = (result) => {

  let vulnerabilitiesByScanDomain = [];
  if (result && Object.keys(result).length > 0) {
    Object.keys(result).map(domain => {
      let info = { domain: '', vulnerabilities: [] };
      result[domain].map(scan => {
        info.domain = scan.scan_domain;
        info.vulnerabilities = info.vulnerabilities.concat(scan.vulnerabilities);
      });
      vulnerabilitiesByScanDomain.push(info);
    });
  }
  vulnerabilitiesByScanDomain.map(item => {
    item.fpCount = item.vulnerabilities.filter((obj) => obj && !!obj.false_positive).length;
    item.vulnerabilities_instances = item.vulnerabilities.length;
    if (item.vulnerabilities_instances > 0) {
      item.accuracy = (((item.vulnerabilities_instances - item.fpCount) / item.vulnerabilities_instances) * 100).toFixed(2) + "%"
    } else {
      item.accuracy = 100 + "%"
    }
    delete item.vulnerabilities;
    delete item.fpCount
  });
  return vulnerabilitiesByScanDomain;
};

const getChartDataForNoOpenHighCritical = (groupedByDomain) => {
  let resultData = [];
  _.each(groupedByDomain, (resultObject) => {
    let issuesData = {
      Domain: 0,
      Nodes: 0,
      SafeNodes: 0,
      Percentage: '0%'
    };
    let critical = 0;
    let total = 0;

    _.each(resultObject, (scanobj) => {
      issuesData.Domain = scanobj.scan_domain;
      if (scanobj.scan_domain && scanobj.scan_domain !== 'undefined' && scanobj.vulnerabilities && scanobj.vulnerabilities.length > 0 && scanobj.reports.report_type === "finalised") {
        _.each(scanobj.vulnerabilities, (vulnerabilitiesobj) => {
          if (vulnerabilitiesobj.severity > 2) {
            critical++;
          }
          total++;
        })
      }
    })
    issuesData.Nodes = total;
    issuesData.SafeNodes = issuesData.Nodes - critical;
    if (issuesData.Nodes && issuesData.SafeNodes) {
      issuesData.Percentage = ((issuesData.SafeNodes * 100 / issuesData.Nodes).toFixed(0)) + "%";
    }
    resultData.push(issuesData);
  })
  return resultData;
};

const getChartDataForTopVulnerabilities = (result) => {
  let resultData = [];

  if (result && result.length > 0) {
    _.each(result, (resultObject) => {
      resultData = resultData.concat(resultObject.vulnerabilities)
    });
  }
  let uniqResultData = _.uniqBy(resultData, (vulnerabilities) => { return vulnerabilities._id.toString() });
  uniqResultData.sort((a, b) => a.severity - b.severity || a.count - b.count);

  let dataToSend = uniqResultData.reverse().slice(0, 5);
  let tempDataToSend = [];
  dataToSend.map(item => {
    tempDataToSend.push({ id: item._id, name: item.name, port: item.port, count: item.count, severity: item.severity })

  });
  return tempDataToSend;
};

const getChartDataForRecurringDomain = (groupedByDomain) => {
  let resultData = [];
  _.forOwn(groupedByDomain, (groupedByDomainArray, domainName) => {
    if (domainName && domainName !== 'undefined') {
      let chartData = [];

      _.each(groupedByDomainArray, (resultObject) => {
        if (resultObject.reports) {
          resultObject.reports.utc_time_modified = moment(new Date(resultObject.reports.utc_time)).format('MMM-YY');
        }
      });

      let groupedByDate = _.groupBy(groupedByDomainArray, 'reports.utc_time_modified');

      _.forOwn(groupedByDate, (value, key) => {
        if (value && value[0] && value[0].reports) {
          let utctime = value[0].reports.utc_time;
          let month = moment(utctime).format('MMM-YY');
          let previousMonth = moment(utctime).subtract(1, 'months').format('MMM-YY');
          let DateString = previousMonth + ' Vs ' + month;
          let criticalCount = 0;
          let highCount = 0;
          let totalVulnerabilityArray = [];

          _.each(value, (groupedData) => {
            totalVulnerabilityArray = totalVulnerabilityArray.concat(groupedData.vulnerabilities);
          });

          if (totalVulnerabilityArray.length > 0) {
            let groupedBySeverity = _.groupBy(totalVulnerabilityArray, 'severity');
            highCount = groupedBySeverity["3"] ? groupedBySeverity["3"].length : 0;
            criticalCount = groupedBySeverity["4"] ? groupedBySeverity["4"].length : 0;
          }

          if (criticalCount > 0 || highCount > 0) {
            chartData.push({
              Date: DateString,
              Critical: criticalCount,
              High: highCount
            });
          }
        }
      });

      if (chartData.length > 0) {
        resultData.push({ [domainName]: chartData });
      }
    }
  });

  return resultData;
};

const prepareVulnerabilitiesForCharts = (result, filteredResult, slasForVulnerabilties) => {
  let groupedByDomain = _.groupBy(result, 'scan_domain');
  let exceptions = getChartDataForExceptions(groupedByDomain);
  let openCriticalHigh = getChartDataForNoOpenHighCritical(groupedByDomain);
  let scanAccuracy = getChartDataForScanAccuracy(groupedByDomain);
  let vulnerabilities = getChartDataForTopVulnerabilities(result);
  let fixedInSLA = getFixedInSLAChartData(result, slasForVulnerabilties);
  let groupedByDomainAndCount = _.groupBy(filteredResult, 'scan_domain');
  let recurringDomain = getChartDataForRecurringDomain(groupedByDomainAndCount);

  return { exceptions: { chartData: exceptions }, recurringDomain: { chartData: recurringDomain }, noOpenCriticalHigh: { chartData: openCriticalHigh }, fixedInSLA: { chartData: fixedInSLA }, topVulnerabilities: { vulnerabilities }, scanAccuracy: { chartData: scanAccuracy } };
};

module.exports = { prepareVulnerabilitiesForCharts };
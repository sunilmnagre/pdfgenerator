const _ = require('lodash');
const moment = require('moment');

const getOrgChartData = (reports) => {
  let recurringChartData = [];
  let totalChartData = [];
  let newChartData = [];

  _.each(reports, (resultObject) => {
    if (resultObject && resultObject.utc_time) {
      resultObject.utc_time_modified = moment(new Date(resultObject.utc_time)).format('MMM-YY');
    }
  });

  let groupedByDate = _.groupBy(reports, 'utc_time_modified');

  _.each(groupedByDate, (dateobj) => {
    let issuesData = {
      recurring: {
        Month: 0,
        Critical: 0,
        High: 0
      },
      total: {
        Month: 0,
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0,
        Info: 0
      },
      new: {
        Month: 0,
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0,
        Info: 0
      }
    };

    let criticalRecurring = 0;
    let highRecurring = 0;

    let criticalTotal = 0;
    let highTotal = 0;
    let mediumTotal = 0;
    let lowTotal = 0;
    let infoTotal = 0;

    let criticalNew = 0;
    let highNew = 0;
    let mediumNew = 0;
    let lowNew = 0;
    let infoNew = 0;

    _.each(dateobj, (reportobj) => {
      let month = reportobj.utc_time_modified;
      let previousMonth = moment(reportobj.utc_time).subtract(1, 'months').format('MMM-YY');
      let DateString = previousMonth + ' Vs ' + month;
      issuesData.recurring.Month = DateString;
      issuesData.total.Month = month;
      issuesData.new.Month = month;

      _.each(reportobj.vulnerabilities, (vulnerabilities) => {
        if (vulnerabilities.count > 0) {
          if (vulnerabilities.severity === 4) {
            criticalRecurring++;
          }
          if (vulnerabilities.severity === 3) {
            highRecurring++;
          }
        }

        if (vulnerabilities.count === 0) {
          if (vulnerabilities.severity === 4) {
            criticalNew++;
          }
          if (vulnerabilities.severity === 3) {
            highNew++;
          }
          if (vulnerabilities.severity === 2) {
            mediumNew++;
          }
          if (vulnerabilities.severity === 1) {
            lowNew++;
          }
          if (vulnerabilities.severity === 0) {
            infoNew++;
          }
        }

        if (vulnerabilities.severity === 4) {
          criticalTotal++;
        }
        if (vulnerabilities.severity === 3) {
          highTotal++;
        }
        if (vulnerabilities.severity === 2) {
          mediumTotal++;
        }
        if (vulnerabilities.severity === 1) {
          lowTotal++;
        }
        if (vulnerabilities.severity === 0) {
          infoTotal++;
        }
      });
    });
    issuesData.recurring.Critical = criticalRecurring;
    issuesData.recurring.High = highRecurring;

    issuesData.new.Critical = criticalNew;
    issuesData.new.High = highNew;
    issuesData.new.Medium = mediumNew;
    issuesData.new.Low = lowNew;
    issuesData.new.Info = infoNew;

    issuesData.total.Critical = criticalTotal;
    issuesData.total.High = highTotal;
    issuesData.total.Medium = mediumTotal;
    issuesData.total.Low = lowTotal;
    issuesData.total.Info = infoTotal;

    recurringChartData.push(issuesData.recurring);
    newChartData.push(issuesData.new);
    totalChartData.push(issuesData.total);
  });

  return { recurring: { chartData: recurringChartData }, new: { chartData: newChartData }, total: { chartData: totalChartData } };
};

module.exports = { getOrgChartData };
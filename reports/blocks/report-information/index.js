const partialName = 'report-information';
const reportConfigurableHelper = require('../../../helpers/report-configurable');
const mongoHelper = require('../../../helpers/mongo');
const handlebars = require('handlebars');
const config = require('config');
const MongoObjectId = require('mongodb').ObjectID;
const moment = require('moment');
const _ = require('lodash');

const build = (organisationId, reportIds) => {
  // Register the partial
  handlebars.registerPartial(partialName,
    reportConfigurableHelper.fsReadBlockTemplate(partialName));

  // Convert the report IDs into Mongo IDs
  const mongoReportIds = [];

  _.each(reportIds, function (reportId) {
    mongoReportIds.push(MongoObjectId(reportId));
  });

  return mongoHelper.find(organisationId, config.mongo.tables.reports,
    { _id: { $in: mongoReportIds } }).then(function (reportsCursor) {
    return reportsCursor.toArray().then(function (reports) {
      return {
        reports,
        reportDate: moment().format('MMM DD, YYYY [at] H:mma'),
      };
    });
  });
};

module.exports.build = build;
module.exports.partialName = partialName;

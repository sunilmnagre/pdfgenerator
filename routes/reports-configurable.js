const express = require("express");
const reportGenerator = require("../reports/generator");
const fs = require("fs");
const apiParametersHelper = require("../helpers/api/parameters");
const moment = require("moment");
const momentTimezone=require('moment-timezone');
const _ = require("lodash");
const mongo = require("../helpers/mongo");
const config = require("config");
const MongoObjectId = require("mongodb").ObjectID;
const pdfGenerator = require("wkhtmltopdf");
let path = require("path");
const os = require("os");
let appDir = path.dirname(require.main.filename);
const router = express.Router();

const serverHost = config.server.host;
const reportFormatPdf = "pdf";
const reportFormatHtml = "html";

let options = {
  "footer-right": "[page]",
  "footer-font-size": 8,
  "margin-bottom": "10",
  dpi: 200
};
if (process.env.NODE_ENV === "production") {
  options["proxy"] = config.server.proxy;
}
/**
 * Some changes may be necessary to the report HTML depending on if it's being displayed in a PDF
 *  or on a browser. This function allows us to fine-tune these things
 * @param {String} reportHtml The HTML generated report
 * @param {String} type The type of report i.e. PDF or HTML
 * @param {Boolean} viewreport flag to send the different css files to the frontend
 * @returns {String} An updated HTML report string for use
 */
function convertHtmlReportForType(reportHtml, type,viewreport) {
  let updatedReportHtml = reportHtml;

  if (type === reportFormatHtml) {
    updatedReportHtml = _.replace(
      updatedReportHtml,
      'src="assets/images/logo-ericsson.png"',
      'src="' + serverHost + '/reports/assets/images/logo-ericsson.png"'
    );
    updatedReportHtml = _.replace(
      updatedReportHtml,
      'src="assets/images/repeat.png"',
      'src="' + serverHost + '/reports/assets/images/repeat.png"'
    );
    updatedReportHtml = _.replace(
      updatedReportHtml,
      'href="./assets/css/bootstrap.css"',
      'href="' + serverHost + '/reports/assets/css/bootstrap.css"'
    );
 if (!viewreport) {
   updatedReportHtml = _.replace(
     updatedReportHtml,
     'href="./assets/css/report.css"',
     'href="' + serverHost + '/reports/assets/css/report.css"'
   );
 } else {
   updatedReportHtml = _.replace(
     updatedReportHtml,
     'href="./assets/css/report.css"',
     'href="' + serverHost + '/reports/assets/css/report-view.css"'
   );
 }
  } else if (type === reportFormatPdf) {
    updatedReportHtml = _.replace(
      updatedReportHtml,
      'src="assets/images/logo-ericsson.png"',
      'src="' + appDir + '/reports/assets/images/logo-ericsson.png"'
    );
    updatedReportHtml = _.replace(
      updatedReportHtml,
      'href="./assets/css/bootstrap.css"',
      'href="' + appDir + '/reports/assets/css/bootstrap.css"'
    );
    updatedReportHtml = _.replace(
      updatedReportHtml,
      'href="./assets/css/report.css"',
      'href="' + appDir + '/reports/assets/css/report.css"'
    );
  }

  return updatedReportHtml;
}

/**
 * Saves the configurable report in the specified format
 * @param {Number} organisationId The organisation ID
 * @param {Object} reportData Data for the report (i.e html content of report or path of pdf file)
 * @param {Array} reportIds ids of scan reports
 * @param {String} format Format for the report
 * @param {String} fromDate From date for configurable report
 * @param {String} toDate To date for configurable report
 * @param {String} timeZone From date for configurable report
 * @param {String} generationDate To date for configurable report
 * @returns {Object} returns true if file was saved successfully false otherwise
 */
const saveReport = (
  organisationId,
  reportData,
  reportIds,
  format,
  fromDate,
  toDate,
  timeZone,
  generationDate
) => {


  const fromDateFormatted = momentTimezone(fromDate).tz(timeZone).format("Do_MMMM_YYYY");
  const toDateFormatted = momentTimezone(toDate).tz(timeZone).format("Do_MMMM_YYYY");
  const reportGenerationDate = momentTimezone().tz(timeZone).format("Do_MMMM_YYYY_h:mmA");


  const downloadableReportName = fromDateFormatted + "_to_" + toDateFormatted + "_generated_at_" + reportGenerationDate;

  const reportMappingObject = {
    organisation_id: organisationId,
    report_ids: reportIds,
    report_name: downloadableReportName,
    utc_time: generationDate.toISOString()
  };
  return mongo
    .insert(
      organisationId,
      config.mongo.tables.downloadableReports,
      reportMappingObject
    )
    .then(res => {
      // Random string to save the pdf because it will fail if the multiple users request for the same report
      const randomString = Math.random()
        .toString(36)
        .substring(5);
      const fileName = os.tmpdir() + "/" + organisationId + fromDateFormatted + "_to_" + toDateFormatted;
      const reportHtmlFile = fileName + randomString + "." + reportFormatHtml;
      try {
        fs.writeFileSync(reportHtmlFile, reportData);
        return mongo
          .fileInsert(organisationId, reportHtmlFile, res.insertedIds[0])
          .then(result => {
              if (fs.existsSync(reportHtmlFile)) {
                fs.unlink(reportHtmlFile, (err) => {
                  if (err) {                   
                     console.log(err);
                  }
                })
              }
            return result;
          })
          .catch((e) => {
            return false;
          });
      } catch (err) {
        return false;
      }
    })
    .catch(() => {
      return false;
    });
  // create folder for report name if doesn't exists already
};
/**
 * @api {get} /api/v1/organisations/:id/reports/:reportId/view
 * View detail report
 * @apiVersion 1.0.0
 * @apiGroup Download report
 * @apiParam (URL) {Number} id Organisation ID
 * @apiParam (URL) {String} reportId ID of the report to include
 * @apiParam (Query) {String} [format] Format of the report (i.e pdf)
 * @apiParam (Query) {String} [template] template of the report (i.e default)
 *
 * @apiSuccessExample Successful response:
 * { Client will get report in specified format }
 */
/**
 * Allows the viewing of a single report
 * @param {Object} request - The Standard ExpressJS request variable
 * @param {Object} response - The Standard ExpressJS response variable
 */
const viewSingle = (request, response) => {
  const template = apiParametersHelper.getQueryParameter(
    request,
    "template",
    "default"
  );
  const reportId = request.params.reportId;
  const organisationId = request.params.id;

  reportGenerator.generateReportHtml(organisationId, [reportId], template).then(
    function(reportHtml) {
      // Set the report up for viewing
      const updatedReportHtml = convertHtmlReportForType(
        reportHtml,
        reportFormatHtml,
        true
      );

      response.send(updatedReportHtml);
    },
    function(error) {
      response.status(422);
      response.jsend.fail({
        error
      });
    }
  );
};

/**
 * @api {post} /api/v1/organisations/:id/reports/view
 * View configurable Report
 * @apiVersion 1.0.0
 * @apiGroup Download report
 * @apiParam (URL) {Number} id Organisation ID
 * @apiParam (JSON) {Array} reportIds Array of report IDs to include
 * @apiParam (JSON) {Array} blocks Array of configurable blocks that to include in the report e.g.
 *  `['summary-vulnerability-severity', 'table-vulnerabilities']`
 * @apiParam (JSON) {Object} slaVulnerabilityNotes Array of vulnerabilities and notes about them
 *  when they miss SLA
 * @apiParam (JSON) {String} fromDate From date in milliseconds
 * @apiParam (JSON) {String} toDate To date in milliseconds
 * @apiParam (JSON) {String} [format] Format of the report (i.e `pdf`)
 * @apiParam (JSON) {String} [template] template of the report (i.e `default`)
 *
 * @apiParamExample {json} Example POST JSON:
{
    "reportIds" : [
    "596df64098a531003cb2e7d9", "596df64398a531003cb2e7fc"
    ], "blocks": ["summary-vulnerability-severity", "table-vulnerabilities"],
    "slaVulnerabilityNotes": {
     "596df64398a531003cb2e7fc": "some notes"
    },
    "reportNote": "A note about this report",
    "fromDate":1500840000,
    "toDate":1500810000
}
 *
 * @apiSuccessExample Successful response:
 * { Client will get report in specified format }
 */
/**
 * Allows the viewing of a configurable report
 * @param {Object} request - The Standard ExpressJS request variable
 * @param {Object} response - The Standard ExpressJS response variable
 */
const viewConfigurable = (request, response) => {
  const reportIds = apiParametersHelper.getBodyParameter(request, "reportIds");
  const organisationId = request.params.id;
  const template = apiParametersHelper.getBodyParameter(
    request,
    "template",
    "default"
  );
  const fromDate = apiParametersHelper.getBodyParameter(request, "fromDate");
  const toDate = apiParametersHelper.getBodyParameter(request, "toDate");
  const timeZone = apiParametersHelper.getBodyParameter(request, "timeZone");
  const blocks = apiParametersHelper.getBodyParameter(request, "blocks", []);
  const reportNote = apiParametersHelper.getBodyParameter(
    request,
    "reportNote",
    null
  );
  const vulnerabilityNotes = apiParametersHelper.getBodyParameter(
    request,
    "slaVulnerabilityNotes",
    {}
  );
  const userId = request.decoded.id;
  const format = apiParametersHelper.getBodyParameter(request, "format");
  const additionalParameters = {
    reportNote,
    vulnerabilityNotes,
    userId
  };

  reportGenerator
    .generateReportHtml(
      organisationId,
      reportIds,
      template,
      blocks,
      additionalParameters
    )
    .then(
      function(reportHtml) {
        // Set the report up for viewing
        const updatedReportHtml = convertHtmlReportForType(
          reportHtml,
          reportFormatHtml
        );
        const reportGenerationDate = moment();
        const VM_ADMIN_LINK_PREFIX = "/admin/vm/exposure/";
        const VM_CUSTOMER_LINK_PREFIX = "/user/vm/reports/exposure/";

        let userReportHtml = updatedReportHtml
          .split(VM_ADMIN_LINK_PREFIX)
          .join(VM_CUSTOMER_LINK_PREFIX);

        if (format === "pdf") {
          pdfGenerator(updatedReportHtml, options).pipe(response);
        } else {
          saveReport(
            organisationId,
            userReportHtml,
            reportIds,
            reportFormatHtml,
            fromDate,
            toDate,
            timeZone,
            reportGenerationDate
          ).then(reportSaved => {
            if (!reportSaved) {
              response.status(422);
              response.jsend.fail({});
            } else {
              const updatedReportHtmlview = convertHtmlReportForType(
                reportHtml,
                reportFormatHtml,true
              );
              response.send(updatedReportHtmlview);
            }  
          });
        }
      },
      function(error) {
        response.status(422);
        response.jsend.fail({
          error
        });
      }
    );
};

/**
 * @api {get} /api/v1/organisations/:id/reports/:reportId/download
 * Download detail report
 * @apiVersion 1.0.0
 * @apiGroup Download report
 * @apiParam (URL) {Number} id Organisation ID
 * @apiParam (URL) {String} reportId Report ID to download
 * @apiParam (Query) {String} [format] Format of the report (i.e pdf)
 * @apiParam (Query) {String} [template] template of the report (i.e default)
 *
 * @apiSuccessExample Successful response:
 * { Client will get report in specified format }
 */
const downloadSingle = (request, response) => {
  const reportId = request.params.reportId;
  const organisationId = request.params.id;
  const format = apiParametersHelper.getQueryParameter(
    request,
    "format",
    reportFormatPdf
  );
  const template = apiParametersHelper.getQueryParameter(
    request,
    "template",
    "default"
  );

  reportGenerator
    .generateReportHtml(organisationId, [reportId], template)
    .then(reportHtml => {
      reportHtml = convertHtmlReportForType(reportHtml, reportFormatHtml);

      if (format === reportFormatPdf) {
        pdfGenerator(reportHtml, options).pipe(response);
      }
    });
};

/**
 * @api {post} /api/v1/organisations/:id/reports/download
 * Download configurable Report
 * @apiVersion 1.0.0
 * @apiGroup Download report
 * @apiParam (URL) {Number} id Organisation ID
 * @apiParam (JSON) {Array} reportIds Array of report IDs to include
 * @apiParam (JSON) {Array} blocks Array of configurable blocks that to include in the report e.g.
 *  `['summary-vulnerability-severity', 'table-vulnerabilities']`
 * @apiParam (JSON) {Object} slaVulnerabilityNotes Array of vulnerabilities and notes about them
 *  when they miss SLA
 * @apiParam (JSON) {String} fromDate From date in milliseconds
 * @apiParam (JSON) {String} toDate To date in milliseconds
 * @apiParam (JSON) {String} [format] Format of the report (i.e `pdf`)
 * @apiParam (JSON) {String} [template] template of the report (i.e `default`)
 *
 * @apiParamExample {json} Example POST JSON:
{
    "reportIds" : [
    "596df64098a531003cb2e7d9", "596df64398a531003cb2e7fc"
    ], "blocks": ["summary-vulnerability-severity", "table-vulnerabilities"],
    "slaVulnerabilityNotes": {
     "596df64398a531003cb2e7fc": "some notes"
    },
    "reportNote": "A note about this report",
    "fromDate":1500840000,
    "toDate":1500810000
}
 * @apiSuccessExample Successful response:
 * { Client will get report in specified format }
 */
const downloadConfigurable = (request, response) => {
  const reportIds = apiParametersHelper.getBodyParameter(request, "reportIds");
  const organisationId = request.params.id;
  const format = apiParametersHelper.getBodyParameter(
    request,
    "format",
    reportFormatPdf
  );
  const template = apiParametersHelper.getBodyParameter(
    request,
    "template",
    "default"
  );
  const blocks = apiParametersHelper.getBodyParameter(request, "blocks", []);
  const reportNote = apiParametersHelper.getBodyParameter(
    request,
    "reportNote",
    null
  );
  const vulnerabilityNotes = apiParametersHelper.getBodyParameter(
    request,
    "slaVulnerabilityNotes",
    {}
  );
  const userId = request.decoded.id;

  const additionalParameters = {
    reportNote,
    vulnerabilityNotes,
    userId
  };
  reportGenerator
    .generateReportHtml(
      organisationId,
      reportIds,
      template,
      blocks,
      additionalParameters
    )
    .then(
      function(reportHtml) {
        if (format === reportFormatPdf) {
          reportHtml = convertHtmlReportForType(reportHtml, reportFormatHtml);
          response.send(reportHtml);
        }
      },
      function(htmlGenerationError) {
        response.status(422);
        response.jsend.fail({
          error: htmlGenerationError
        });
      }
    );
};

/**
 * Validator for configurable reports. Checks the required fields are in the request
 * @param {Object} request - The Standard ExpressJS request variable
 * @param {Object} response - The Standard ExpressJS response variable
 * @param {Object} next - The Standard ExpressJS next variable
 */
const validateConfigurableParameters = (request, response, next) => {
  const reportIds = apiParametersHelper.getBodyParameter(request, "reportIds");
  const blocks = apiParametersHelper.getBodyParameter(request, "blocks");
  const vulnerabilityNotes = apiParametersHelper.getBodyParameter(
    request,
    "slaVulnerabilityNotes"
  );
  const fromDate = apiParametersHelper.getBodyParameter(request, "fromDate");
  const toDate = apiParametersHelper.getBodyParameter(request, "toDate");

  // If the user has selected missed SLA notes, then we need to check for them
  if (
    blocks && blocks.includes("sla-breached-vulnerabilities-with-notes") &&
    vulnerabilityNotes === null
  ) {
    response.status(422);
    response.jsend.fail({
      validation:
        "Configurable reports require `slaVulnerabilityNotes` if it is a requested block"
    });
  } else if (
    reportIds === null ||
    blocks === null ||
    fromDate === null ||
    toDate === null
  ) {
    response.status(422);
    response.jsend.fail({
      validation:
        "Configurable reports require `reportIds, `blocks`, `fromDate`, `toDate` and `slaVulnerabilityNotes`"
    });
  } else {
    next();
  }
};

/**
 * @api {get} /api/v1/organisations/:id/reports/saved/download/:downloadableReportId
 * Download saved report
 * @apiVersion 1.0.0
 * @apiGroup Download report
 * @apiParam (URL) {Number} id Organisation ID
 * @apiParam (URL) {String} downloadableReportId ID of saved report
 *
 * @apiSuccessExample Successful response:
 * { Client will get report in specified format }
 */
/**
 * Allows the download of saved report
 * @param {Object} request - The Standard ExpressJS request variable
 * @param {Object} response - The Standard ExpressJS response variable
 */
const downloadSaved = (request, response) => {
  const organisationId = request.params.id;
  const downloadableReportId = request.params.downloadableReportId;
  const andQueryParams = [{ organisation_id: organisationId }];
  let processedIndex = 0;

  if (mongo.isMongoId(downloadableReportId)) {
    andQueryParams.push({ _id: MongoObjectId(downloadableReportId) });
  }

  const queryParameters = { $and: andQueryParams };

  mongo
    .findOne(
      organisationId,
      config.mongo.tables.downloadableReports,
      queryParameters
    )
    .then(function(reportDetails) {
      return mongo
        .getFile(organisationId, reportDetails._id)
        .then(htmlString => {
          pdfGenerator(htmlString, options).pipe(response);
        });
    });
};

/**
 * @api {get} /api/v1/organisations/:id/reports/saved/view/:downloadableReportId
 * view saved report
 * @apiVersion 1.0.0
 * @apiGroup Download report
 * @apiParam (URL) {Number} id Organisation ID
 * @apiParam (URL) {String} downloadableReportId ID of saved report
 *
 * @apiSuccessExample Successful response:
 * { Client will get report in specified format }
 */
/**
 * Allows the viewing of saved report
 * @param {Object} request - The Standard ExpressJS request variable
 * @param {Object} response - The Standard ExpressJS response variable
 */
const viewSaved = (request, response) => {
  const organisationId = request.params.id;
  const downloadableReportId = request.params.downloadableReportId;
  const andQueryParams = [{ organisation_id: organisationId }];
  let processedIndex = 0;

  if (mongo.isMongoId(downloadableReportId)) {
    andQueryParams.push({ _id: MongoObjectId(downloadableReportId) });
  }

  const queryParameters = { $and: andQueryParams };

  mongo
    .findOne(
      organisationId,
      config.mongo.tables.downloadableReports,
      queryParameters
    )
    .then(downloadableReportDetails => {
      return mongo
        .getFile(organisationId, downloadableReportDetails._id)
        .then(htmlString => {
          htmlString.pipe(response);
        });
    });
};

module.exports = {
  router,
  downloadSingle,
  viewSingle,
  viewConfigurable,
  downloadConfigurable,
  reportFormatPdf,
  reportFormatHtml,
  validateConfigurableParameters,
  downloadSaved,
  viewSaved
};

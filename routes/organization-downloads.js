const express = require('express');
const router = express.Router();
const apiValidators = require('../helpers/api/validators');
const reportsHelper = require('../helpers/report-configurable');
const vulnerabilityModel = require('../models/vulnerability');
const constantErrors = require('../helpers/constant-errors');

const { Parser } = require('json2csv');

/**
 * Download CSV  report
 * @param {*} request 
 * @param {*} response 
 */
const downloadCSVSingle = async (request, response) => {
  const reportId = request.params.reportId;
  const organisationId = request.params.id;
  try {
    const cursor = await vulnerabilityModel.getVulnerabiltiesByReports(organisationId, [reportId]);
    let result = await cursor.toArray();
    result = vulnerabilityModel.formatReportFields(result);
    let vulnerabilities = [];
    let reportName = 'report.csv';
    if (result && result[0] && result[0].vulnerabilities) {
      vulnerabilities = result[0].vulnerabilities;
      reportName = result[0].report_name + '.csv'
    }
    let fields = await reportsHelper.filterFields(request.body && request.body.fields ? request.body.fields : []);
    if (fields && fields.length < 1) {
      return response.status(400).jsend.fail(constantErrors.csv.fieldsValidation);
    }
    const parser = new Parser({ fields });
    const csv = parser.parse(vulnerabilities);
    if (!csv) {
      return response.status(400).jsend.fail(constantErrors.csv.invalidCSV);
    }
    response.attachment(reportName);
    return response.status(200).send(csv);
  } catch (err) {
    return response.status(400).jsend.fail(err && err.message ? err.message : constantErrors.csv.failed);
  }
}

/**
 * 
 * @param {*} request 
 * @param {*} response 
 */
const csvHeaders = async (request, response) => {
  try {
    const fields = reportsHelper.csvHeaders();
    return response.jsend.success(fields);
  } catch (error) {
    return response.status(422).jsend.fail(err && err.message ? err.message : constantErrors.csv.failToFetchCSVheaders);
  }
}
router.post('/:id/reports/:reportId/csv', apiValidators.reportExists, apiValidators.organisationExists, downloadCSVSingle);
router.get('/csv-headers', csvHeaders);
module.exports = router;

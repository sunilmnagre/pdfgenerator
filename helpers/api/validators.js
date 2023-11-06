var config = require('config');
var organisationModel = require('../../models/organization');
var reportsModel = require('../../models/reports');
var mongo = require('../../helpers/mongo');
var expressValidator = require('express-validator');
var express = require('express');
var mongoDb = require('mongodb');
var MongoObjectId = require('mongodb').ObjectID;
var apiParametersHelper = require('../../helpers/api/parameters');
var _ = require('underscore');
const vulnerabilityModel = require('../../models/vulnerability').vulnerability();

var app = express();

/**
 * Checks if a given organisation ID exists
 * @param {Response} response - HTTP response object
 * @param {Number} - Organisation ID to check
 * @return {Promise} - A promise containing an organisation if it exists
 */
function organisationExists(request, response, next) {
  var organisationId = request.params.id;

  request.checkParams('id', 'Organisation ID is required').notEmpty();
  request.checkParams('id', 'Organisation ID must be an integer').isInt();

  request.getValidationResult().then(function (result) {
    if (!result.isEmpty()) {
      response.status(422);
      response.jsend.fail({
        validation: result.array()
      });
    } else {
      organisationModel.organization().getOrganizationById(organisationId).then(
        function (organisation) {
          if (organisation) {
            next();
          } else {
            response.status(404);
            response.jsend.fail(['No organisation with this ID found']);
          }
        }, function () {
          response.status(404);
          response.jsend.fail(['No organisation with this ID found']);
        });
    }
  });
}

/**
 * Checks if a given scan ID exists
  @param {Request} response - HTTP request object
 * @param {Response} response - HTTP response object
 * @param {next} - if validated call next()
 */
function scanExists(request, response, next) {
  var organisationId = request.params.id;
  var noScanMessage = 'No scan with this ID found';

  request.checkParams('scanID', 'scan ID is required').notEmpty();
  request.checkParams('scanID', 'scan ID is not valid').isMongoId();

  return request.getValidationResult().then(function (result) {
    var queryParams = {
      _id: MongoObjectId(request.params.scanID)
    };

    if (!result.isEmpty()) {
      response.status(422);
      return response.jsend.fail({
        validation: result.array()
      });
    }
    return mongo.findOne(organisationId, config.mongo.tables.scans, queryParams, {}).then(
      function (scan) {
        if (scan) {
          next();
        } else {
          response.status(404);
          response.jsend.fail([noScanMessage]);
        }
      }, function () {
        response.status(404);
        return response.jsend.fail([noScanMessage]);
      });
  });
}

/**
 * Checks if a given query params for scans are valid
  @param {Request} response - HTTP request object
 * @param {Response} response - HTTP response object
 * @param {next} - if validated call next()
 */
function validateGetScansQueryParams(request, response, next) {
  if (request.query) {
    if (request.query['scan-type']) {
      request.checkQuery('scan-type', 'Scan type is not valid').isValidScanType();
      request.getValidationResult().then(function (result) {
        if (!result.isEmpty()) {
          response.status(422);
          response.jsend.fail({
            validation: result.array()
          });
        } else {
          next();
        }
      });
    } else {
      next();
    }
  } else {
    next();
  }
}

/**
 * Validates if a report with the given ID exists
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function
 */
function reportExists(request, response, next) {
  var reportId = request.params.reportId;
  var organisationId = request.params.id;

  request.checkParams('reportId', 'Report ID is required').notEmpty();
  request.checkParams('reportId', 'Report ID must be a Mongo ID').isMongoId();

  request.getValidationResult().then(function (result) {
    if (!result.isEmpty()) {
      response.status(422);
      response.jsend.fail({
        validation: result.array()
      });
    } else {
      reportsModel.getById(organisationId, reportId).then(function (report) {
        // If this is a customer, they're only allowed to view finalised
        //  reports
        if (report && (request.decoded.user_type === config.user_type.SuperAdmin || request.decoded.user_type === config.user_type.Admin ||
          report.report_type === config.globals.reportType.finalised.value)) {
          next();
        } else {
          response.status(404);
          response.jsend.fail(['No report with that ID found']);
        }
      });
    }
  });
}

/**
 * Validates if a vulnerability with the given ID exists
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function
 */
function vulnerabilityExists(request, response, next) {
  const organisationId = request.params.id;
  const vulnerabilityId = request.params.vulnerabilityId;
  let queryParams = {};
  request.checkParams('vulnerabilityId', 'Vulnerability ID is required').notEmpty();
  request.checkParams('vulnerabilityId', 'Vulnerability ID must be a Mongo ID').isMongoId();
  queryParams = { _id: new MongoObjectId(vulnerabilityId) };
  request.getValidationResult().then(function (result) {
    if (!result.isEmpty()) {
      response.status(422);
      response.jsend.fail({
        validation: result.array()
      });
    } else {
      mongo.findOne(organisationId, config.mongo.tables.vulnerabilities, queryParams)
        .then((vulnerability) => {
          if (vulnerability === null) {
            response.status(404);
            response.jsend.fail(['No vulnerability with this ID found']);
          } else {
            next();
          }
        });
    }
  });
}

/**
 * Validates if a downloadableReport with the given ID exists
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function
 */
function downaloadableReportExists(request, response, next) {
  const organisationId = request.params.id;
  const downloadableReportId = request.params.downloadableReportId;
  let queryParams = {};

  request.checkParams('downloadableReportId', 'Downloadable Report ID is required').notEmpty();
  request.checkParams('downloadableReportId', 'Downloadable Report ID must be a Mongo ID').isMongoId();


  request.getValidationResult().then(function (result) {
    if (!result.isEmpty()) {
      response.status(422);
      response.jsend.fail({
        validation: result.array()
      });
    } else {
      queryParams = { _id: new MongoObjectId(downloadableReportId) };

      mongo.findOne(organisationId, config.mongo.tables.downloadableReports, queryParams)
        .then((downloadableReport) => {
          if (downloadableReport === null) {
            response.status(404);
            response.jsend.fail(['No Downloadable Report with this ID found']);
          } else {
            next();
          }
        });
    }
  });
}

/**
 * Validates if a note exist for given ID
 * @param {Object} request - The Standard ExpressJS request variable.
 * @param {Object} response - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function
 */
function noteExists(request, response, next) {
  var organisationId = request.params.id;
  var vulnerabilityId = request.params.vulnerabilityId;
  var noteId = request.params.noteId;
  var vulnerabilityQuery = {};

  request.checkParams('vulnerabilityId', 'Vulnerability ID is required').notEmpty();
  request.checkParams('vulnerabilityId', 'Vulnerability ID must be a Mongo ID').isMongoId();

  request.checkParams('noteId', 'Note ID is required').notEmpty();
  request.checkParams('noteId', 'Note ID must be a Mongo ID').isMongoId();


  request.getValidationResult().then(function (result) {
    if (!result.isEmpty()) {
      response.status(422);
      response.jsend.fail({
        validation: result.array()
      });
    } else {
      // Get the vulnerability item by ID and history ID
      vulnerabilityQuery = {
        _id: MongoObjectId(vulnerabilityId),
        notes: { $elemMatch: { id: MongoObjectId(noteId) } }
      };
      // This gets the vulnerability and only the Notes Array containing given noteID
      mongo.findOne(organisationId, config.mongo.tables.vulnerabilities,
        vulnerabilityQuery)
        .then(function (vulnerability) {
          // Vulnerability or Note not found
          if (vulnerability === null) {
            response.status(404);
            response.jsend.fail(['Vulnerability or note not found']);
          } else {
            next();
          }
        });
    }
  });
}

/**
 * validate if reportIDs are valid Mongo ID
 * @param {Object} request - The Standard ExpressJS request variable.
 * @param {Object} response - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function
 */
function validateReportIDs(request, response, next) {
  var organisationId = request.params.id;
  var reportsString = apiParametersHelper.getQueryParameter(request, 'reports');
  var idsValid = true;
  var reportMongoIDsArray = [];
  var reportIDsArray;
  var queryParameters;

  if (!reportsString) {
    response.status(422);
    response.jsend.fail({
      validation: 'Only requests to this endpoint filtered by reports is supported at present'
    });
  } else {
    reportIDsArray = reportsString.split(',');

    _.each(reportIDsArray, function (id) {
      if (!MongoObjectId.isValid(id)) {
        idsValid = false;
      }
    });

    if (!idsValid) {
      response.status(422);
      response.jsend.fail({
        validation: 'One or more of these IDs are not valid'
      });
    } else {
      _.each(reportIDsArray, function (id) {
        reportMongoIDsArray.push(new MongoObjectId(id));
      });

      queryParameters = { _id: { $in: reportMongoIDsArray } };

      mongo.find(organisationId, config.mongo.tables.reports, queryParameters)
        .then(function (result) {
          result.toArray(function (err, reportDocument) {
            if (reportMongoIDsArray.length === reportDocument.length) {
              next();
            } else {
              response.status(422);
              response.jsend.fail({
                validation: 'One of your report IDs are not valid, or don\'t belong to this organisation'

              });
            }
          });
        });
    }
  }
}

/**
 * Validates start-date & end-date parameters in a given request
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function
 */
function validateStartAndEndDate(request, response, next) {
  var startDate = apiParametersHelper.getQueryParameter(request, 'start-date');
  var endDate = apiParametersHelper.getQueryParameter(request, 'end-date');
  // Check the start and end dates are valid if set
  if (startDate !== null && endDate !== null) {
    request.checkQuery('start-date',
      'Scan date must be an integer (the number of seconds since 1970)').isInt();
    request.checkQuery('end-date',
      'Scan date must be an integer (the number of seconds since 1970)').isInt();
    request.getValidationResult().then(function (result) {
      if (!result.isEmpty()) {
        response.status(422);
        response.jsend.fail({
          validation: result.array()
        });
      } else {
        next();
      }
    });
  } else if (startDate === null && endDate !== null) {
    response.status(422);
    response.jsend.fail({
      validation: 'start-date must be specified'
    });
  } else if (startDate !== null && endDate === null) {
    response.status(422);
    response.jsend.fail({
      validation: 'end-date must be specified'
    });
  } else {
    next();
  }
}

/**
 * @description Check is vulnerability document has active 'lock' property to prevent
 * prohibited mutations.
 * vulnerability Id and organisation Id should be checked by previous validators
 * @param {Object} [req] - The Standard ExpressJS request variable.
 * @param {Object} [res] - The Standard ExpressJS response variable.
 * @param {Object} [next] - The Standard ExpressJS next variable.
 * @return {json} Promise, Error on failure or call next function
 */
const isVulnerabilityNotLocked = (request, response, next) => {
  const vulnerabilityId = request.params.vulnerabilityId;
  const organisationId = request.params.id;

  const vulnerabilityTable = config.mongo.tables.vulnerabilities;

  const queryParams = {
    _id: new MongoObjectId(vulnerabilityId)
  };

  return mongo.findOne(organisationId, vulnerabilityTable, queryParams)
    .then((result) => {
      const { locked, _id } = result;
      if (!_id) {
        response.status(404);
        response.jsend.fail({ message: 'Failed, vulnerability not found' });
      } else if (!vulnerabilityModel.isLocked(locked, request.decoded.id)) {
        // vulnerability isn't locked so we can go next
        next();
      } else {
        response.status(423);
        response.jsend.fail({
          result,
          message: 'Failed vulnerability is locked'
        });
      }
    });
};

/**
 * @description Validates report format in given request
 * @param {Object} [request] - The Standard ExpressJS request variable.
 * @param {Object} [response] - The Standard ExpressJS response variable.
 * @param {Object} [next] - The Standard ExpressJS next variable.
 * @return {Object} Promise, Error on failure or call next function
 */
const checkAndLockVulnerability = (request, response, next) => {
  const organisationId = request.params.id;
  const userInfo = request.decoded;
  const vulnerabilityIds = request.params.vulnerabilityId;
  return vulnerabilityModel.lockVulnerabilitiesByIds(organisationId, vulnerabilityIds, userInfo)
    .then((result) => {
      if (!result) {
        response.status(500);
        response.jsend.fail({ message: 'Failed, internal server error' });
      } else if (result.matchedCount === 0) {
        response.status(423);
        response.jsend.fail({ message: 'Current vulnerability is locked' });
      } else {
        next();
      }
    })
    .catch(() => {
      response.status(500);
      response.jsend.fail({ message: 'Update failed' });
    });
};
/**
 * Validates report format in given request
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function
 */
function validateReportFormatParameter(request, response, next) {
  var format = apiParametersHelper.getQueryParameter(request, 'format');

  // Check format is valid if set
  if (format !== null) {
    if (!reportsModel.reportFormats.includes(format)) {
      response.status(422);
      response.jsend.fail({
        validation: 'Specified format is not supported'
      });
    } else {
      next();
    }
  } else {
    next();
  }
}

/**
 * Checks if the given user is a super user
 * @param {Object} request The Standard ExpressJS request variable.
 * @param {Object} response The Standard ExpressJS response variable.
 * @param {Object} next The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function
 */
function isRoleSuper(request, response, next) {
  // Check format is valid if set
  if (request.decoded.user_type !== config.user_type.SuperAdmin) {
    response.status(403);
    response.jsend.fail(['Not authorised']);
  } else {
    next();
  }
}

/**
 * Validates report template in given request
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS next variable.
 * @return {json} Error on failure or call next function
 */
function validateReportTemplateParameter(request, response, next) {
  var template = apiParametersHelper.getQueryParameter(request, 'template');

  // Check template is valid if set
  if (template !== null) {
    if (!reportsModel.reportTemplates.includes(template)) {
      response.status(422);
      response.jsend.fail({
        validation: 'Specified report template is not valid'
      });
    } else {
      next();
    }
  } else {
    next();
  }
}

// Set up custom validators
app.use(expressValidator({
  customValidators: {
    isMongoId(value) {
      MongoObjectId = mongoDb.BSONPure.ObjectID;
      return MongoObjectId.isValid(value);
    }
  }
}));

/**
 * Checks if a given scan Name not belongs to other scans
  @param {Request} response - HTTP request object
 * @param {Response} response - HTTP response object
 * @param {next} - if validated call next()
 */
function scanNameNotExists(request, response, next) {
  var organisationId = request.params.id;
  var scanId = request.params.scanID;
  var scanExistMessage = 'Scan name already exists';

  var queryParams = {
    _id: {
      $ne: MongoObjectId(scanId)
    },
    name: request.body.scanName
  };

  return mongo.findOne(organisationId, config.mongo.tables.scans, queryParams, {}).then(
    function (scan) {
      if (scan) {
        response.status(404);
        return response.jsend.fail([scanExistMessage]);
      } else {
        next();
      }
    }).catch(function () {
      response.status(404);
      return response.jsend.fail([scanExistMessage]);
    });
}

module.exports = {
  organisationExists,
  scanExists,
  reportExists,
  validateGetScansQueryParams,
  validateStartAndEndDate,
  vulnerabilityExists,
  downaloadableReportExists,
  noteExists,
  validateReportIDs,
  validateReportFormatParameter,
  validateReportTemplateParameter,
  isVulnerabilityNotLocked,
  checkAndLockVulnerability,
  scanNameNotExists
};

module.exports.isRoleSuper = isRoleSuper;

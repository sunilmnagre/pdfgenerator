const httpRequest = require("request");
const express = require('express');
const config = require('config');
const dbOperation = require('../models/organization');
const servicesHelper = require('../helpers/services');
const constantErrors = require('../helpers/constant-errors');

const router = express.Router();

/**
 * Gets the request token
 *
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {Request} request - The request object
 * @return {String} - The token object (if it exists)
 */
function getRequestToken(request) {
  return request.query.token || request.headers['x-access-token'];
}

/**
 * Middleware to authenticate given request
 * @param {Object} req - The Standard ExpressJS request variable
 * @param {Object} res - The Standard ExpressJS response variable
 * @param {Object} next - The Standard ExpressJS next callback function
 * Execute provided next callback function if success else stop execution
 */
function isAuthenticated(req, res, next) {

  let endpointInfo = "VM/" + req.method + ":" + req._parsedUrl.pathname;

  const options = {
    url: config.adminModule.host + config.adminModule.endpoints.isAuthenticated + "?endpointInfo=" + endpointInfo,
    headers: req.headers,
    proxy: ""
  };

  httpRequest.post(options, function (error, response, bodyData) {
    let body = {};
    try {
      body = JSON.parse(bodyData);
    } catch (exception) {
      //Do nothing.
    }

    if (response && response.statusCode === 200) {
      if (body && body.user) {
        req.decoded = body.user;
      }
      next();
    } else {
      res.status(response && response.statusCode ? response.statusCode : 422);
      res.jsend.fail(body && body.data ? body.data : []);
    }
  });
}

/**
 * Middleware to authenticate organisationID into request for endpoints
 * @param {Object} req - The Standard ExpressJS request variable
 * @param {Object} res - The Standard ExpressJS response variable
 * @param {Object} next - The Standard ExpressJS next callback function
 * Execute provided next callback function if success else stop execution
 */
function authenticateOrganisation(req, res, next) {
  const options = {
    url: config.adminModule.host + config.adminModule.endpoints.authenticateOrganisation + "?id=" + req.params.id,
    headers: req.headers,
    proxy: ""
  };

  httpRequest.post(options, function (error, response, bodyData) {
    let body = {};

    try {
      body = JSON.parse(bodyData);
    } catch (exception) {
      //Do nothing.
    }

    if (response && response.statusCode === 200) {
      if (body && body.data && body.data.organisationAuthenticated) {
        next();
      } else {
        res.status(422);
        res.jsend.fail([]);
      }
    } else {
      res.status(response && response.statusCode ? response.statusCode : 422);
      res.jsend.fail(body && body.data ? body.data : []);
    }
  });
}


/**
 * Checks if a given organisation has VM service exists
 * @param {Request} req - HTTP Request object
 * @param {Response} res - HTTP response object
 * @param {Object} next - The Standard ExpressJS next callback function
 * Execute provided next callback function if success else stop execution
 */
const organisationHasService = async (req, res, next) => {
  try {
    const organizationId = req.params.id;
    if (organizationId) {
      const supportedTypes = await servicesHelper.getServicesSlugs(true);
      if (supportedTypes.VM && supportedTypes.VM.short) {
        const vmSlug = supportedTypes.VM && supportedTypes.VM.short || null;
        const vmCredentials = await dbOperation.organization().getServiceCredentialData(organizationId, vmSlug);
        if (vmCredentials) {
          next();
        } else {
          res.status(422);
          return res.jsend.fail([constantErrors.organization.notSubscribed]);
        }
      } else {
        res.status(422);
        return res.jsend.fail([constantErrors.organizationService.supportedTypesNotAvailable]);
      }
    } else {
      res.status(422);
      return res.jsend.fail([constantErrors.organization.failedToGetOrgId]);
    }
  } catch (e) {
    const message = e && e.message ? e.message : "";
    res.status(422);
    return res.jsend.fail([constantErrors.organization.notSubscribed + message]);
  }
};

module.exports = {
  request: router,
  isAuthenticated,
  getRequestToken,
  authenticateOrganisation,
  organisationHasService,
};

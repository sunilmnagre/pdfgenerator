const models = require('../db_models');
const config = require('config');
const cryptographyHelper = require('../helpers/cryptography');
const hasProperty = require('../helpers/general').hasProperty;
const servicesHelper = require('../helpers/services');
const constantErrors = require('../helpers/constant-errors');

/**
 * Creates Organization Model for Business Logic.
 */
function organization() {
  // Array of fields to be mapped when responding to an API

  /**
   * Get Organization by OrganizationId.
   * @param {number} id - ID of the organisation
   */
  this.getOrganizationById = function (id) {
    var args = {
      attributes: ['id', 'name', 'active'],
      where: { id },
      raw: true
    };

    return models.Organization.findOne(args).then(function (result) {
      return result;
    });
  };

  /**
   * Get service credientials for a given organisation id
   * @param {number} id - ID of the organisation
   * @param {string} serviceShortName - Short name of the service to get the credentials for
   */
  this.getServiceCredentialData = function (id, serviceShortName) {
    var args = {
      attributes: ['id'],
      where: { id },
      raw: true,
      include: [{ model: models.Service, where: { short: serviceShortName }, attributes: ['id'] }]
    };

    /**
    * Get the Organization from Local DB along with Metadata.
    * @return {Object} Organization Metadata.
    */
    return models.Organization.findOne(args).then(function (result) {
      if (result === null) {
        return null;
      } else if (hasProperty(result, 'Services.OrgService.credentials')) {
        return JSON.parse(result['Services.OrgService.credentials']);
      }

      return null;
    });
  };

  /**
   * Get organizations & Services
   * @param {number} id - ID of the organisation
   * @param {string} serviceShortName - Short name of the service to get the credentials for
   */
  this.getAllOrgsCredentials = function (serviceShortName) {
    var args = {
      attributes: ['id', 'name', 'active'],
      include: [{
        model: models.Service,
        where: { short: serviceShortName }
      }],
      raw: true
    };

    /**
    * Get the Organizations from Local DB along with Metadata.
    * @return {Object} Organizations Metadata.
    */
    return models.Organization.findAndCountAll(args);
  };

  /**
   * Gets the Mongo connection string for the given organisation ID
   * @param {number} id - ID of the organisation
   * @return {Promise} - The connection string for Mongo
   */
  this.getMongoConnectionUrlByOrgId = async (id) => {
    const supportedTypes = await servicesHelper.getServicesSlugs(true);

    if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
      // When we get the credentials, alter the return value of the Promise
      return this.getServiceCredentialData(id, supportedTypes.VM.short).then(
        (result) => {
          if (result === null) {
            return null;
          }

          // Make sure the organisation has a Mongo ID. Otherwise things will go horribly wrong
          if ((result.mongo.database_name) &&
            (result.mongo.username) &&
            (result.mongo.password)) {
            let host;

            if (config.mongo.replication === true) {
              host = config.mongo.replicationObject.hosts.reduce((total, host) => {
                return total + host.host + ":" + host.port + ",";
              }, "")
              host = host.substring(0, host.length - 1);
            } else {
              host = config.mongo.host;
            }

            if (result.mongo && result.mongo.host) {
              host = result.mongo.host;
            }

            // Decrypt the password
            const decryptedPassword = cryptographyHelper.decrypt(result.mongo.password);
            let connectString;

            if (config.mongo.replication === true) {
              connectString = config.mongo.replicationObject.protocol + result.mongo.username + ":" + decryptedPassword + '@' + host + '/' +
                result.mongo.database_name + "?replicaSet=" + config.mongo.replicationObject.repSet;
            } else {
              connectString = config.mongo.protocol + result.mongo.username + ':' + decryptedPassword + '@' + host + ':' + config.mongo.port + '/' + result.mongo.database_name;
            }

            return connectString;
          } else {
            throw new Error('Organisation is not assigned a Mongo database');
          }
        });
    } else {
      throw new Error(constantErrors.organizationService.supportedTypesNotAvailable);
    }
  };



  return this;
}

module.exports.organization = organization;


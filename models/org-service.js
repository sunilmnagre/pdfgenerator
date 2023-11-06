const models = require('../db_models');
const hasProperty = require('../helpers/general').hasProperty;
const _ = require('lodash');
const servicesHelper = require('../helpers/services');
const constantErrors = require('../helpers/constant-errors');

/**
 * Get User by userId.
 * @param {number} id - ID & Organisation name of the user
 * @return {object} result - user info for given user ID
 */
var getAllVMCustomers = function () {
  var args = {
    attributes: ['id', 'name'],
    where: { active: 1 },
    include: [{
      attributes: ['name'],
      model: models.Service,
      where: { id: 4 }
    }],
    raw: true
  };


  return models.Organization.findAll(args)
    .then(organisations => organisations.map(function (organisation) {
      return {
        id: organisation.id,
        name: organisation.name
      };
    }));
};


/**
 *
 * @param organisationId
 * @returns {Promise}
 */
const getAllVMCustomersCredenitails = async (organisationId) => {
  const supportedTypes = await servicesHelper.getServicesSlugs(true);

  if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
    const searchParameters = {
      where: {
        organization_id: organisationId
      },
      attributes: ['organization_id', 'credentials'],
      raw: true,
      include: [{
        model: models.Service,
        where: {
          short: _.toUpper(supportedTypes.VM.short)
        },
        attributes: ['id']
      }]
    };

    // Find the folder numbers and assign them
    return models.OrgService.findOne(searchParameters).then(function (result) {
      if (result === null) {
        return {};
      } else {
        return result.credentials;
      }

    });
  } else {
    throw new Error(constantErrors.organizationService.supportedTypesNotAvailable);
  }
}

/**
 * Gets data for a service of an organisation
 * @param {Number} organisationId The ID of the organisation to get the data from
 * @param {Number} serviceId The service ID (ID of VM, SIEM) that the data will be taken from
 * @param {String} key [OPTIONAL] The key in the data to retrieve. If none is given, the whole
 *  object will be returned
 * @returns {Object|null} An object if data is found, null if not
 */
function getOrganisationServiceData(organisationId, serviceId, key = null) {
  const serviceDataQuery = {
    attributes: ['credentials'],
    where: { organization_id: organisationId, status: 'active', service_id: serviceId },
    raw: true
  };

  return models.OrgService.findOne(serviceDataQuery).then((serviceData) => {
    if (serviceData === null) {
      return null;
    }

    const dataAsJson = JSON.parse(serviceData.credentials);

    if (key === null) {
      return dataAsJson;
    }

    if (hasProperty(dataAsJson, key)) {
      return dataAsJson[key];
    }
    return null;
  });
}


/**
* Get Customer's SLA's for Vulnerabilities.
* @param {number} organisationId - Organisation Id of the customer
* @return {object} result - On Success, SLA's info for given Organisation ID otherwise error
*/
const getOrgSlasForVulnerabilities = async (organisationId) => {
  let returnOutput = {};
  const supportedTypes = await servicesHelper.getServicesSlugs(true);

  if (supportedTypes && supportedTypes.VM && supportedTypes.VM.id) {
    return getOrganisationServiceData(organisationId, supportedTypes.VM.id, 'slas').then((vulnerabilitySlas) => {
      if (vulnerabilitySlas === null) {
        returnOutput = {
          status: 0,
          message: 'Data not found for this Organisation',
          data: {}
        };
      } else {
        returnOutput = {
          status: 1,
          message: 'SLAs retrieved Successfully',
          data: vulnerabilitySlas
        };
      }

      return returnOutput;
    });
  } else {
    throw new Error(constantErrors.organizationService.supportedTypesNotAvailable);
  }
};


/**
 * Allows the setting of some organisation service data
 * @param {Number} organisationId The ID of the organisation to set the data to
 * @param {Number} serviceId The service ID (ID of VM, SIEM) that the data will be set to
 * @param {String} key The key in the data to be set
 * @param {Object} serviceData An object of data to be saved
 */
function setOrganisationServiceData(organisationId, serviceId, key, serviceData) {
  return getOrganisationServiceData(organisationId, serviceId).then(function (existingServiceData) {
    // See if the service data exists for the given key
    return getOrganisationServiceData(organisationId, serviceId, key).then(
      function (existingServiceKeyData) {
        // If there's no data for the given key, the service might still have data, so check
        //  that
        if (existingServiceKeyData === null) {
          // If there's no service data, we need to do the full insert
          const newServiceData = {};
          newServiceData[key] = serviceData;

          if (existingServiceData === null) {
            return models.OrgService.create({
              credentials: JSON.stringify(newServiceData),
              status: 'active',
              organization_id: organisationId,
              service_id: serviceId
            });
          }
          // Service data exists, let's update that
          existingServiceData[key] = serviceData;

          return models.OrgService.update(
            { credentials: JSON.stringify(existingServiceData) },
            { where: { organization_id: organisationId, service_id: serviceId } }
          );
        }
        existingServiceData[key] = serviceData;

        return models.OrgService.update(
          { credentials: JSON.stringify(existingServiceData) },
          { where: { organization_id: organisationId, service_id: serviceId } }
        );
      });
  });
}

/**
 * Deletes the full service data from the org-service table
 * @param {Number} organisationId The ID of the organisation to set the data to
 * @param {Number} serviceId The service ID (ID of VM, SIEM) that the data will be set to
 */
function deleteOrganisationServiceData(organisationId, serviceId) {
  getOrganisationServiceData(organisationId, serviceId).then(function (existingServiceData) {
    if (existingServiceData !== null) {
      models.OrgService.destroy({
        where: { organization_id: organisationId, service_id: serviceId }
      });
    }
  });
}

module.exports = {
  getAllVMCustomers,
  getOrgSlasForVulnerabilities,
  getAllVMCustomersCredenitails
};

module.exports.setOrganisationServiceData = setOrganisationServiceData;
module.exports.getOrganisationServiceData = getOrganisationServiceData;
module.exports.deleteOrganisationServiceData = deleteOrganisationServiceData;

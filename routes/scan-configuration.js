const express = require('express');
const constantErrors = require('../helpers/constant-errors');
const base64ToFile = require('../helpers/general').base64ToFile;
const apiValidators = require('../helpers/api/validators');
const authenticate = require('../middleware/authenticate');
const pifyRequest = require('../helpers/pifyer').pifyRequest;
const config = require('config');
const caching = require('../middleware/api-cache')._get;
const _ = require('lodash');
const router = express.Router();
const fs = require('fs');
const UPLOAD_PATH = "./temp";
const BSRIdentifier = config.globals.tenable.Repository.BSR_Identifier;
const [BSR_Prefix, BSR_Suffix] = [`${BSRIdentifier}_`, `_${BSRIdentifier}`];

/**
* Validate credentials mandatory fields
* @param {String} params Request params
* @return {Array} Error
*/
const validateMondatoryParams = (params) => {
    const erros = [];
    const attributes = ['name', 'type', 'authType'];

    attributes.forEach(attribute => {
        if (!params.hasOwnProperty(attribute) || !params[attribute]) {
            erros.push(attribute);
        }
    });
    return erros;
}

/**
* Get all policies for the given organization.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Error on failure
*/
const getPolicies = async (request, response) => {
    const organisationId = request.params.id;
    try {
        const tenableResult = await pifyRequest(organisationId, 'policy', 'GET', {}, {});
        if (tenableResult && tenableResult.response && tenableResult.response.usable) {
            response.jsend.success(tenableResult.response.usable);
        } else {
            const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.tenable.failed;
            response.status(422).jsend.fail(tenableError);
        }
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        response.status(422).jsend.fail(message);
    }
}

/**
* Get all repositories for the given organization.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Error on failure
*/
const getRepositories = async (request, response) => {
    const organisationId = request.params.id;
    try {
        const tenableResult = await pifyRequest(organisationId, 'repository', 'GET', {}, {});
        let resultArray = [];
        if (tenableResult && tenableResult.response) {
            let repositories = tenableResult.response;
            repositories.forEach((repository) => {
                const repositoryName = repository && repository.name ? repository.name.toString().toUpperCase() : '';
                if (repositoryName.indexOf(BSR_Suffix) < 0 && repositoryName.indexOf(BSR_Prefix) < 0) {
                    resultArray.push(repository);
                }
            });
            response.jsend.success(resultArray);
        } else {
            const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.tenable.failed;
            response.status(422).jsend.fail(tenableError);
        }
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        response.status(422).jsend.fail(message);
    }
}

/**
* Get credential for the given organization.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Error on failure
*/
const getCredentialById = async (request, response) => {
    const organisationId = request.params.id;
    const credentialId = request.params.credentialId;
    try {
        const tenableResult = await pifyRequest(organisationId, 'credential/' + credentialId, 'GET', {}, {});
        if (tenableResult && tenableResult.response) {
            response.jsend.success(tenableResult.response);
        } else {
            const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.tenable.failed;
            response.status(422).jsend.fail(tenableError);
        }
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        response.status(422).jsend.fail(message);
    }
}


/**
* Get all credentials for the given organization.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Error on failure
*/

const getCredentials = async (request, response) => {

    let { limit, page, sortBy, filterBy } = request.query;
    let total = 0;
    limit = request.query.limit || config.pagination.itemsPerPage;
    page = request.query.page || 0;
    sortBy = request.query.sortBy || 'name';
    filterBy = request.query.filterBy || '';

    const organisationId = request.params.id;
    try {
        const tenableResult = await pifyRequest(organisationId, 'credential?fields=name,description,type,modifiedTime', 'GET', {}, {});
        if (tenableResult && tenableResult.response && tenableResult.response.usable) {
            let result = tenableResult.response.usable;
            if (Object.keys(request.query).length === 0) {
                result = _.chain(tenableResult.response.usable)
                    .groupBy('type')
                    .map((value, key) => {
                        let keys = {};
                        let keyValue = key === "windows" || key === "database" ? key.charAt(0).toUpperCase() + key.slice(1) : key.toUpperCase();
                        keys[keyValue] = value;
                        return keys;
                    }).value();
                response.jsend.success(result);
            } else {
                total = result.length;
                if (filterBy) {
                    result = _.filter(result, (item) => {
                        return item.name.indexOf(filterBy) > -1;
                    });
                    total = result.length;
                }

                result = _.chain(result)
                    .orderBy(sortBy, ['asc'])
                    .drop((page - 1) * limit)
                    .take(limit)
                    .value();
                response.jsend.success({ total, credentials: result });
            }

        } else {
            const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.tenable.failed;
            response.status(422).jsend.fail(tenableError);
        }
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        response.status(422).jsend.fail(message);
    }
}

/**
* Get credentials types.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Error on failure
*/
const getCredentialTypes = (request, response) => {
    const credentialTypes = config.credentials_types;
    if (credentialTypes) {
        return response.jsend.success(credentialTypes);
    } else {
        return response.status(404).jsend.fail('Credential types not found');
    }
}

/**
* Add credentials for the given organization.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Error on failure
*/

const addCredentials = async (request, response) => {
    try {
        const organisationId = request.params.id;
        const requestBody = request.body;
        let requestParameters = {};

        // Validate mandatory params
        const validation = validateMondatoryParams(requestBody);
        if (validation.length > 0) {
            return response.status(400).jsend.fail('Missing params - ' + validation.join(' & '));
        }

        // If type is Password and authtype is publicKey
        if (requestBody.type == 'SSH' && requestBody.authType == 'Publickey') {
            try {
                let fileData = requestBody.publickKeyFile;
                let uploadedFile = await performPublicKeyUpload(organisationId, fileData);
                requestBody.publickKeyFile = uploadedFile;
            } catch (error) {
                return response.status(400).jsend.fail(error);
            }
        }

        // Lets map the request attributes with the tenable fields
        requestParameters = mapParamsForTenable(requestBody);
        const tenableResult = await pifyRequest(organisationId, 'credential', 'POST', {}, requestParameters);
        if (tenableResult && tenableResult.error_code === 0) {
            response.jsend.success(constantErrors.generic.createSuccess);
        } else {
            const tenableError = tenableResult && tenableResult.error_msg != 0 ? tenableResult.error_msg : constantErrors.tenable.failed;
            response.status(422).jsend.fail(tenableError);
        }
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        response.status(422).jsend.fail(message);
    }
}

/**
* Update credentials.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Success or Error
*/
const updateCredentials = async (request, response) => {
    try {
        const organisationId = request.params.id;
        const requestBody = request.body;
        const credentialId = request.params.credentialId;

        // Validate mandatory params
        const validation = validateMondatoryParams(requestBody);
        if (validation.length > 0) {
            return response.status(400).jsend.fail('Missing params - ' + validation.join(' & '));
        }

        // If type is Password and authtype is publicKey
        if (requestBody.type == 'SSH' && requestBody.authType == 'Publickey' && requestBody.publickKeyFile.fileName) {
            try {
                let fileData = requestBody.publickKeyFile;
                let uploadedFile = await performPublicKeyUpload(organisationId, fileData);
                requestBody.publickKeyFile = uploadedFile;
            } catch (error) {
                return response.status(400).jsend.fail(error);
            }
        }

        // Lets map the request attributes with the tenable fields
        requestParameters = mapParamsForTenable(requestBody);
        const tenableResult = await pifyRequest(organisationId, 'credential/' + credentialId, 'PATCH', {}, requestParameters);
        if (tenableResult && tenableResult.error_code === 0) {
            response.jsend.success(constantErrors.generic.updateSuccess);
        } else {
            const tenableError = tenableResult && tenableResult.error_msg != 0 ? tenableResult.error_msg : constantErrors.tenable.failed;
            response.status(422).jsend.fail(tenableError);
        }
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        response.status(422).jsend.fail(message);
    }
}

/**
* Delete credentials.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Error on failure
*/
const deleteCredentials = async (request, response) => {
    try {
        const organisationId = request.params.id;
        const credentialId = request.params.credentialId;
        //Delete credential from tenable
        const tenableResult = await pifyRequest(organisationId, 'credential/' + credentialId, 'DELETE', {}, {});
        if (tenableResult.error_code === 0) {
            response.jsend.success(constantErrors.generic.deleteSuccess);
        } else {
            const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.tenable.failed;
            response.status(422).jsend.fail(tenableError);
        }
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        response.status(422).jsend.fail(message);
    }
}

const mapParamsForTenable = (data) => {
    const { type, authType, privilegeEscalation } = data;
    const privilege = privilegeEscalation == "" || privilegeEscalation === undefined ? 'None' : privilegeEscalation;
    let fields = {
        name: data.name,
        description: data.description,
        type: type.toLowerCase(),
    };
    if (data.password != "" && data.password != null) { fields.password = data.password; }
    switch (type) {
        case 'SSH':
            if (authType === 'Password') {
                fields.authType = authType.toLowerCase();
                fields.username = data.username;
                fields.privilegeEscalation = privilege.toLowerCase();
            } else if (authType === 'Publickey') {
                fields.authType = 'publicKey';
                fields.username = data.username;
                fields.privateKey = data.publickKeyFile;
                fields.privilegeEscalation = privilege.toLowerCase();
            }
            break;
        case 'SNMP':
            fields.communityString = data.communityString;
            break;
        case 'Windows':
            if (authType === 'Password') {
                fields.authType = authType.toLowerCase();
                fields.username = data.username;
            }
            break;
        case 'Database':
            if (authType === 'Oracle' || authType === 'MySQL') {
                const port = authType === 'MySQL' ? 3306 : 1521;
                fields.authType = 'password';
                fields.dbType = authType;
                fields.port = port;
                fields.login = data.username;

                if (authType === 'Oracle') {
                    fields.oracleAuthType = 'Normal';
                    fields.oracle_service_type = 'SID';
                }
            }
            break;
    }
    return fields;
};


/**
 * Function to upload file into Tenable
 * @param {Number} organisationId - Id of the organisation
 * @param {Object} fileData - Object holding file information, name, type ext., content, etc
 * @return {String} Filename or Error
 */
const performPublicKeyUpload = async (organisationId, fileData) => {
    // Generate file from base64String
    let [fileObject, uploadedFile] = [null, null];
    try {
        uploadedFile = UPLOAD_PATH + '/' + await base64ToFile(fileData, UPLOAD_PATH);
        fileObject = {
            Filedata: {
                value: fs.createReadStream(uploadedFile),
                options: {}
            }
        };
    } catch (error) {
        throw constantErrors.tenable.fileProcessFailed;
    }

    // Upload generated file to Tenable
    try {
        const tenableResult = await pifyRequest(organisationId, 'file/upload', 'POST', fileObject, null);

        // Delete the generated file
        fs.unlinkSync(uploadedFile);

        if (tenableResult && tenableResult.response) {
            return tenableResult.response.filename || constantErrors.tenable.failed;
        } else {
            throw constantErrors.tenable.failed;
        }
    } catch (error) {
        // Delete the generated file
        fs.unlinkSync(uploadedFile);
        throw constantErrors.tenable.uploadFailed;
    }
};

/**
* Get all scan zones for the given organization.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Error on failure
*/
const getScanZones = async (request, response) => {
    const organisationId = request.params.id;
    try {
        const tenableResult = await pifyRequest(organisationId, 'zone', 'GET', {}, {});
        if (tenableResult && tenableResult.response) {
            response.jsend.success(tenableResult.response);
        } else {
            const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.tenable.failed;
            response.status(422).jsend.fail(tenableError);
        }
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        response.status(422).jsend.fail(message);
    }
}

router.use('/:id/*', authenticate.organisationHasService);
router.get('/:id/scanzones', apiValidators.organisationExists, authenticate.authenticateOrganisation, caching, getScanZones);
router.get('/:id/policies', apiValidators.organisationExists, authenticate.authenticateOrganisation, caching, getPolicies);
router.get('/:id/repositories', apiValidators.organisationExists, authenticate.authenticateOrganisation, caching, getRepositories);
router.get('/:id/credentials', apiValidators.organisationExists, authenticate.authenticateOrganisation, getCredentials);
router.get('/:id/credentials/types', getCredentialTypes);
router.get('/:id/credentials/:credentialId', apiValidators.organisationExists, authenticate.authenticateOrganisation, getCredentialById);
router.post('/:id/credentials', apiValidators.organisationExists, authenticate.authenticateOrganisation, addCredentials);
router.patch('/:id/credentials/:credentialId', apiValidators.organisationExists, authenticate.authenticateOrganisation, updateCredentials);
router.delete('/:id/credentials/:credentialId', apiValidators.organisationExists, authenticate.authenticateOrganisation, deleteCredentials);
module.exports = router;

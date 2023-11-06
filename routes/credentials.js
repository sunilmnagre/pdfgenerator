const express = require('express');
const constantErrors = require('../helpers/constant-errors');
const base64ToFile = require('../helpers/general').base64ToFile;
const apiValidators = require('../helpers/api/validators');
const authenticate = require('../middleware/authenticate');
const pifyRequest = require('../helpers/pifyer').pifyRequest;
const config = require('config');
const router = express.Router();
const fs = require('fs');
const UPLOAD_PATH = "./temp";
const mongoObjectId = require('mongodb').ObjectID;
const credentialModel = require('../models/credentials');
const credentialHelper = require('../helpers/credentials');

/**
* Get all credentials for the given organization.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Error on failure
*/
const getCredentials = async (request, response) => {
    const organisationId = request.params.id;
    const tenableIds = [];
    const credentialId = request && request.params && request.params.credentialId ? request.params.credentialId : null;
    let tenableUrl = 'credential?fields=name,description,type,modifiedTime';
    let credential = null;

    if (credentialId) {
        const credentialByIdQuery = {
            _id: new mongoObjectId(credentialId)
        };
        // GET credential from mongo
        credential = await credentialModel._findOne(organisationId, credentialByIdQuery, {});

        if (credential == null) {
            return response.status(422).jsend.fail(constantErrors.generic.notExist);
        }
        tenableUrl = 'credential/' + credential.tenable_credential_id;
    }

    try {
        // GET data from tenable
        const tenableResult = await pifyRequest(organisationId, tenableUrl, 'GET', {}, {});
        if (tenableResult && tenableResult.response && tenableResult.response.usable) {
            Object.keys(tenableResult.response.usable.map((result, obj) => {
                tenableIds.push(result.id);
            }, {}));

            if (tenableIds && tenableIds.length > 0) {
                // GET data from mongo compare with tenable ids
                let credentials = await credentialModel._collection(organisationId, tenableIds);
                if (credentials) {
                    let result = await credentialHelper.mapGetResult(request, credentials);
                    return response.jsend.success(result);
                }
                return response.status(422).jsend.fail(constantErrors.generic.notExist);
            }
            return response.status(422).jsend.fail(constantErrors.generic.notExist);
        }

        if (credentialId && tenableResult && tenableResult.response) {
            return response.jsend.success(credential);
        }
        const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.tenable.failed;
        return response.status(422).jsend.fail(tenableError);
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        return response.status(422).jsend.fail(message);
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
        let [requestBody, requestParameters] = [request.body, {}];

        // Validate mandatory params
        const validation = await credentialHelper.validateMondatoryParams(requestBody);
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
        requestParameters = await credentialHelper.mapParamsForTenable(requestBody);
        const tenableResult = await pifyRequest(organisationId, 'credential', 'POST', {}, requestParameters);
        if (tenableResult && tenableResult.error_code === 0) {
            requestBody = await credentialHelper.mapParamsForMongo(requestBody, tenableResult);
            requestBody.is_tenable_deleted = false;
            // Insert into mongo DB
            const insertResult = await credentialModel._insert(organisationId, requestBody);
            if (insertResult === null) {
                return response.status(404).jsend.fail(constantErrors.generic.failed);
            }
            return response.jsend.success(constantErrors.generic.createSuccess);
        }
        const tenableError = tenableResult && tenableResult.error_msg != 0 ? tenableResult.error_msg : constantErrors.tenable.failed;
        return response.status(422).jsend.fail(tenableError);
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        return response.status(422).jsend.fail(message);
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
        const [organisationId, credentialId] = [request.params.id, request.params.credentialId];
        let requestBody = request.body;
        const credentialByIdQuery = {
            _id: new mongoObjectId(credentialId)
        };

        // Validate mandatory params
        const validation = await credentialHelper.validateMondatoryParams(requestBody);
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

        const credential = await credentialModel._findOne(organisationId, credentialByIdQuery);
        if (credential == null) {
            return response.status(422).jsend.fail(constantErrors.generic.notExist);
        }

        // Lets map the request attributes with the tenable fields
        requestParameters = await credentialHelper.mapParamsForTenable(requestBody);
        // Update tenable
        const tenableResult = await pifyRequest(organisationId, 'credential/' + credential.tenable_credential_id, 'PATCH', {}, requestParameters);

        if (tenableResult && tenableResult.error_code === 0) {
            requestBody = await credentialHelper.mapParamsForMongo(requestBody, tenableResult);
            // Update mongo DB
            const updateResult = await credentialModel._updateOne(organisationId, credentialByIdQuery, requestBody);
            if (updateResult === null) {
                return response.status(422).jsend.fail(constantErrors.generic.updateFail);
            }
            return response.jsend.success(constantErrors.generic.updateSuccess);
        }
        const tenableError = tenableResult && tenableResult.error_msg != 0 ? tenableResult.error_msg : constantErrors.tenable.failed;
        return response.status(422).jsend.fail(tenableError);
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
        const [organisationId, credentialId] = [request.params.id, request.params.credentialId];
        const credentialByIdQuery = {
            _id: new mongoObjectId(credentialId)
        };

        //Get credential from mongo DB based on id
        const credential = await credentialModel._findOne(organisationId, credentialByIdQuery, {});
        if (credential == null) {
            return response.status(422).jsend.fail(constantErrors.generic.notExist);
        }

        //Delete credential from tenable
        const tenableResult = await pifyRequest(organisationId, 'credential/' + credential.tenable_credential_id, 'DELETE', {}, {});
        if (tenableResult.error_code === 0) {
            const fieldsToSet = { is_tenable_deleted: true };
            // Delete from mongo DB
            const result = await credentialModel._updateOne(organisationId, credentialByIdQuery, fieldsToSet);
            if (result === null) {
                return response.status(422).jsend.fail(constantErrors.generic.deleteFailed);
            }
            return response.jsend.success(constantErrors.generic.deleteSuccess);
        }
        const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.tenable.failed;
        return response.status(422).jsend.fail(tenableError);
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        return response.status(422).jsend.fail(message);
    }
}

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

router.use('/:id', [apiValidators.organisationExists, authenticate.authenticateOrganisation]);
router.get('/:id/credentials/:credentialId?', getCredentials);
router.get('/:id/types', getCredentialTypes);
router.post('/:id/credentials', addCredentials);
router.patch('/:id/credentials/:credentialId', updateCredentials);
router.delete('/:id/credentials/:credentialId', deleteCredentials);
module.exports = router;

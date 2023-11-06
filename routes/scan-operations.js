const express = require('express');
const config = require('config');
const scanModel = require('../models/scan');
const constantErrors = require('../helpers/constant-errors');
const apiValidators = require('../helpers/api/validators');
const pifyRequest = require('../helpers/pifyer').pifyRequest;
const authenticate = require('../middleware/authenticate');
const mongo = require('../helpers/mongo');
const scanHelper = require('../helpers/scans');
const mongoObjectId = require('mongodb').ObjectID;
const BSRIdentifier = config.globals.tenable.Repository.BSR_Identifier;
const [BSR_Prefix, BSR_Suffix] = [`${BSRIdentifier}_`, `_${BSRIdentifier}`];

const scanDocument = config.mongo.tables.scans;
const router = express.Router();
const _ = require('lodash');

/**
* Create Scan.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Success or Error 
*/
const createScan = async (request, response) => {
    const organisationId = request.params.id;
    const requestBody = request.body;

    // Validate mandatory params
    const validation = scanHelper.validateMondatoryParams(requestBody);
    if (validation.length > 0) {
        return response.status(400).jsend.fail('Missing params - ' + validation.join(' & '));
    }

    // Remove duplicate Targets
    const targets = requestBody.targets;
    requestBody.targets = scanHelper.removeDuplicateTargets(requestBody.targets);

    // Check for duplicate scan name
    try {
        let query = { "name": requestBody.scan_name };
        const scan = await scanModel.findScan(organisationId, query, { name: 1 });
        if (scan !== null && scan._id) {
            return response.status(400).jsend.fail('Scan name is already in use');
        }
    } catch (error) {
        const message = error && error.message ? error.message : "Error getting scan";
        return response.status(422).jsend.fail(message);
    }

    // Create Scan into tenable                 
    try {
        // Map request body for Tenable
        let mappedTenableParams = scanHelper.mapTenableScanParams(requestBody);

        const tenableResult = await pifyRequest(organisationId, 'scan', 'POST', {}, mappedTenableParams);

        if (tenableResult && tenableResult.error_code == 0) {

            // Append Tenable scan Id and store into DB
            requestBody.tenable_scan_id = tenableResult.response.id;
            requestBody.scan_end = tenableResult.response.modifiedTime;
            requestBody.status = tenableResult.response.status;

            // Map the scan for Mongo
            requestBody.targets = targets;
            let scanToInsert = scanHelper.mapDBScanParams(requestBody);
            const insertResult = await mongo.insert(organisationId, scanDocument, scanToInsert);
            if (insertResult === null) {
                return response.status(404).jsend.fail(constantErrors.scans.deleteFailed);
            } else {
                return response.jsend.success('Success');
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
* Update Scan.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Success or Error 
*/
const updateScan = async (request, response) => {
    const organisationId = request.params.id;
    const requestBody = request.body;
    const tenableScanId = request.body.tenable_scan_id;
    const scanByIdQuery = {
        _id: new mongoObjectId(request.params.scanID)
    };

    // Get scan from mongo DB based on id  
    try {
        const scan = await scanModel.findScan(organisationId, scanByIdQuery, { name: 1 });
        if (scan === null) {
            return response.status(400).jsend.fail('Scan is not present for this ID');
        }
    } catch (error) {
        const message = error && error.message ? error.message : "Error getting scan";
        return response.status(422).jsend.fail(message);
    }

    // Validate mandatory params
    const validation = scanHelper.validateMondatoryParams(requestBody);
    if (validation.length > 0) {
        return response.status(400).jsend.fail('Missing params - ' + validation.join(' & '));
    }

    // Remove duplicate Targets
    const targets = requestBody.targets;
    requestBody.targets = scanHelper.removeDuplicateTargets(requestBody.targets);
    // Check for duplicate scan name
    try {
        let query = {
            '_id': { $ne: scanByIdQuery._id },
            'name': requestBody.scan_name
        };

        const scan = await scanModel.findScan(organisationId, query, { name: 1 });
        if (scan !== null && scan._id) {
            return response.status(400).jsend.fail('Scan name is already in use');
        }
    } catch (error) {
        const message = error && error.message ? error.message : "Error getting scan";
        return response.status(422).jsend.fail(message);
    }

    // Update Scan into tenable                 
    try {
        // Map request body for Tenable
        let mappedTenableParams = scanHelper.mapTenableScanParams(requestBody);
        const tenableResult = await pifyRequest(organisationId, `scan/${tenableScanId}`, 'PATCH', {}, mappedTenableParams);

        if (tenableResult && tenableResult.error_code == 0) {
            // Bring back to fit for MSS
            mappedTenableParams.schedule = requestBody.schedule;

            // Map the scan for Mongo
            requestBody.targets = targets;
            let scanToUpdate = scanHelper.mapDBScanParams(requestBody);

            const updateResult = await mongo.updateOne(organisationId, scanDocument, scanByIdQuery, scanToUpdate);

            if (updateResult === null) {
                return response.status(404).jsend.fail(constantErrors.scans.deleteFailed);
            } else {
                return response.jsend.success('Success');
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
* Delete scan.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Error on failure
*/
const deleteScan = async (request, response) => {
    try {
        const organisationId = request.params.id;
        const scanId = request.params.scanID;
        const queryParams = {
            _id: mongoObjectId(scanId)
        };

        //Get scan from mongo DB based on id   
        const scan = await mongo.findOne(organisationId, scanDocument, queryParams, {});
        if (scan && scan.name !== null) {
            //Delete scan from tenable                 
            const tenableResult = await pifyRequest(organisationId, 'scan/' + scan.tenable_scan_id, 'DELETE', {}, {});
            if (tenableResult && tenableResult.error_code === 0) {
                //Update is_tenable_deleted field to true in mongo DB  
                const fieldsToSet = { is_tenable_deleted: true };
                const result = await mongo.updateOne(organisationId, scanDocument, queryParams, fieldsToSet)
                if (result === null) {
                    response.status(404).jsend.fail(constantErrors.scans.deleteFailed);
                } else {
                    response.jsend.success(constantErrors.scans.deleteSuccess);
                }
            } else {
                const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.tenable.failed;
                response.status(422).jsend.fail(tenableError);
            }
        } else {
            response.status(422).jsend.fail(constantErrors.scans.notExist);
        }
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.failed;
        response.status(422).jsend.fail(message);
    }
}
/**
 * Launch scan.
 * @param {Object} request The Standard ExpressJS request
 * @param {Object} response The Standard ExpressJS response
 * @return {json} Error on failure
 */
const launchScan = async (request, response) => {
    try {
        const organisationId = request.params.id;
        const scanId = request.params.scanID;
        // Launch scan
        const tenableResult = await pifyRequest(organisationId, 'scan/' + scanId + '/launch', 'POST', {}, {});
        if (tenableResult && tenableResult.error_code === 0) {
            response.jsend.success(constantErrors.scans.launch);
        } else {
            const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.scans.launchFail;
            response.status(422).jsend.fail(tenableError);
        }

    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.scans.launchFail;
        response.status(422).jsend.fail(message);
    }
}

/**
 * Scan Results or Scan status.
 * @param {Object} request The Standard ExpressJS request
 * @param {Object} response The Standard ExpressJS response
 * @return {json} Error on failure
 */
const scanResults = async (request, response) => {
    try {
        const organisationId = request.params.id;
        const endPoint = scanHelper.getScanResultQuery();
        // Get  scan results from tenable
        const tenableResult = await pifyRequest(organisationId, endPoint, 'GET', {}, {});
        let resultArray = [];
        if (tenableResult && tenableResult.error_code === 0) {
            const scansResults = tenableResult && tenableResult.response && tenableResult.response.usable ? tenableResult.response.usable : [];
            scansResults.forEach((scan) => {
                if (scan.repository && scan.repository.name.indexOf(BSR_Suffix) < 0 && scan.repository.name.indexOf(BSR_Prefix) < 0 && scan.status !== 'Completed') {
                    resultArray.push(scan);
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

const diagnosticScan = async (request, response) => {
    try {
        const organisationId = request.params.id;
        const scanId = request.params.scanID;
        const requestBody = request.body;

        // Validate mandatory params
        const validation = scanHelper.validateDiagnoseMondatoryParams(requestBody);
        if (validation.length > 0) {
            return response.status(400).jsend.fail('Missing params - ' + validation.join(' & '));
        }

        const scanDetails = await pifyRequest(organisationId, 'scan/' + scanId, 'GET', {}, {});
        if (scanDetails && scanDetails.response && scanDetails.response.ipList && scanDetails.error_code === 0) {
            const scanIps = scanDetails.response.ipList;
            const scanIpsArray = scanIps.split(',');

            if (scanIpsArray.indexOf(requestBody.diagnosticTarget) !== -1) {
                // Launch diagnostic scan
                const tenableResult = await pifyRequest(organisationId, 'scan/' + scanId + '/launch', 'POST', {}, requestBody);
                if (tenableResult && tenableResult.error_code === 0) {
                    return response.jsend.success(tenableResult);
                }
                const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.scans.launchFail;
                return response.status(422).jsend.fail(tenableError);
            }
            return response.status(422).jsend.fail(constantErrors.scans.diagnosticScanFailed);
        }
        return response.status(422).jsend.fail(constantErrors.scans.ipNotFound);
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.scans.launchFail;
        response.status(422).jsend.fail(message);
    }
}

router.use('/:id/*', authenticate.organisationHasService);
router.post('/:id/scans', apiValidators.organisationExists, authenticate.authenticateOrganisation, createScan);
router.patch('/:id/scans/:scanID', apiValidators.organisationExists, authenticate.authenticateOrganisation, updateScan);
router.post('/:id/scan-launch/:scanID', apiValidators.organisationExists, authenticate.authenticateOrganisation, launchScan);
router.get('/:id/scan-results', apiValidators.organisationExists, authenticate.authenticateOrganisation, scanResults);
router.delete('/:id/scans/:scanID', apiValidators.organisationExists, authenticate.authenticateOrganisation, apiValidators.scanExists, deleteScan);
router.post('/:id/scans/:scanID/diagnose', apiValidators.organisationExists, authenticate.authenticateOrganisation, diagnosticScan);
module.exports = router;
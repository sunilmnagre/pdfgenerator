const express = require('express');
const config = require('config');
const constantErrors = require('../helpers/constant-errors');
const apiValidators = require('../helpers/api/validators');
const vulnerabilityQueueModel = require('../models/vulnerability-queue');
const vulnerabilityHelper = require('../helpers/vulnerability-queue');
const pifyRequest = require('../helpers/pifyer').pifyRequest;
const router = express.Router();
const moment = require('moment');

/**
* Get all scan results by hours
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Error on failure
*/
const getScanResults = async (request, response) => {    
    const organisationId = request.params.id;
    const hours = parseInt(request.params.hours);    
    const scanName = request.params.scanName;

    // Get Unix time for past selected hours
    let completedTime = moment().subtract(hours, 'hours').unix();
    let scanQueryString = '?filter=usable,completed&fields=canUse,canManage,owner,groups,ownerGroup,status,name,details,diagnosticAvailable,importStatus,createdTime,startTime,finishTime,importStart,importFinish,running,totalIPs,scannedIPs,completedIPs,completedChecks,totalChecks,dataFormat,downloadAvailable,downloadFormat,repository,resultType,resultSource,scanDuration&startTime=' + completedTime;
    
    try {
        // Get scan results from tenable
        const tenableResult = await pifyRequest(organisationId, 'scanResult' + scanQueryString, 'GET', {}, {});
        if (tenableResult && tenableResult.response && tenableResult.response.usable) {
            // Filter data based on the scan name
            let filterByName = (tenableResult.response.usable).filter((scan) => {               
                return scan.name === scanName;
            });
            return response.jsend.success({ total: filterByName.length, scans: filterByName });
        }
        const tenableError = tenableResult && tenableResult.error_msg ? tenableResult.error_msg : constantErrors.tenable.scansError;
        return response.status(422).jsend.fail(tenableError);
      
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.tenable.scansError;
        return response.status(422).jsend.fail(message);
    }
}

/**
* Create vulnerability queue.
* @param {Object} request The Standard ExpressJS request
* @param {Object} response The Standard ExpressJS response
* @return {json} Success or Error 
*/
const createVulnerabilityQueue = async (request, response) => {
    const organisationId = request.params.id;
    const requestBody = request.body;
    const jobType = config.globals.queueTypes.vulnerability;

    // Validate mandatory params
    const validation = vulnerabilityHelper.validateMondatoryParams(requestBody);
    if (validation.length > 0) {
        return response.status(400).jsend.fail('Missing params - ' + validation.join(' & '));
    }

    try {       
        // Insert into vulnerability queue
        const vulnerabilityQueue = await vulnerabilityQueueModel.create(organisationId, jobType, requestBody);           
        if (vulnerabilityQueue.id && vulnerabilityQueue.organisation_id) {         
            return response.jsend.success(vulnerabilityQueue);
        }
        const failMessage = vulnerabilityQueue[0].id && !vulnerabilityQueue[0].organisation_id ? constantErrors.generic.exist : constantErrors.generic.failed;
        return response.status(422).jsend.fail(failMessage);
    } catch (error) {
        const message = error && error.message ? error.message : constantErrors.generic.failed;
        return response.status(422).jsend.fail(message);
    }
}

router.use('/:id/*', apiValidators.organisationExists);
router.get('/:id/missing-scans/:scanName/:hours', getScanResults);
router.post('/:id/missing-scans', createVulnerabilityQueue);

module.exports = router;
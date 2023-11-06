const orgModel = require('../../models/organization');
const scanModel = require('../../models/scan');
const tenableHelper = require('../../helpers/tenable');
const _ = require('lodash');
const config = require('config');
const models = require('../../db_models');
const vulnerabilityJobQueueModel = models.VulnerabilitiesJobQueue;
const mongo = require('../../helpers/mongo');
const servicesHelper = require('../../helpers/services');
const constantErrors = require('../../helpers/constant-errors');
const moment = require('moment');
const BSRIdentifier = config.globals.tenable.Repository.BSR_Identifier;
const [BSR_Prefix, BSR_Suffix] = [`${BSRIdentifier}_`, `_${BSRIdentifier}`];

/**
 * Build and return query to get existing scans
 * @param tenableScanReults
 * @returns {{$or: Array}}
 */
const getExistingScanQuery = (tenableScanReults) => {
    const scanQuery = { $or: [] };
    _.each(tenableScanReults, (scanResult) => {
        scanQuery.$or.push({
            name: scanResult.name
        });
    });

    return scanQuery;
};

const getVulnerabilityJobQuery = (organisationId, jobType, scanId, scanResultId, last_modification_date) => {
    // Check the item hasn't already been added to the queue
    // Raw query needed to support REGEX which is needed to support JSON fields
    let baseQuery = 'SELECT id ' +
        'FROM vulnerabilities_job_queue AS VulnerabilitiesJobQueue ' +
        'WHERE VulnerabilitiesJobQueue.organisation_id = ' + Number(organisationId) + ' ' +
        'AND VulnerabilitiesJobQueue.job_type = "' + jobType + '"';

    baseQuery = baseQuery + ' AND VulnerabilitiesJobQueue.params REGEXP \'\"scan_id\"\\s?:\\s?' + scanId + '\'';

    baseQuery = baseQuery + ' AND VulnerabilitiesJobQueue.params REGEXP \'\"scanResultId\"\\s?:\\s?' + scanResultId + '\'';

    baseQuery = baseQuery + ' AND VulnerabilitiesJobQueue.params REGEXP \'\"last_modification_date\"\\s?:\\s?' + last_modification_date + '\'';

    // Limit the result, one is enough
    baseQuery += ' LIMIT 1';

    return baseQuery;
};

const updateTenableDeletedStatus = (scanId, organisationId) => {
    let scanQueryPromise = mongo.findOne(organisationId, config.mongo.tables.scans, {
        tenable_scan_id: scanId
    });

    scanQueryPromise.then(function (scanResult) {
        if (scanResult && scanResult.schedule && scanResult.schedule.frequency === tenableHelper.LAUNCH_DURATION_ONETIME) {
            let scanQuery = {
                _id: scanResult._id
            };
            let updateScanObject = {
                'is_tenable_deleted': false // Updating false for and we will add another logic for it
            };

            mongo.collection(organisationId, config.mongo.tables.scans).then((scanCollection) => {
                scanCollection.updateOne(scanQuery, { $set: updateScanObject });
            });
        }
    });
};

const updateScanOnProcessComplete = (processedCount, scanResults, organisationId) => {
    // if (processedCount >= scanResults.length && scanResults.length > 0) {
    //     scanResults = _.orderBy(scanResults, ['finishTime'], ['desc']);

    //     // mongo.updateMany(organisationId, config.mongo.tables.scans, { scan_end: { $lt: scanResults[0].finishTime } }, { $set: { is_fetch_vm_required: false } });
    //     mongo.updateMany(organisationId, config.mongo.tables.scans, { scan_end: { $lt: scanResults[0].finishTime } }, { $set: { is_fetch_vm_required: false, scan_end: scanResults[0].finishTime } });
    // }
};

const insertIntoVulnerabilityJobQueue = (scanResults, groupedScanObject, organisationId) => {
    let processedCount = 0;

    _.each(scanResults, (scanResult) => {
        let scanObject = groupedScanObject[scanResult.name];
        if (scanObject && scanObject.length > 0 && scanResult.status === 'Completed') {
            let jobType = config.globals.queueTypes.vulnerability;
            let scanId = parseInt(scanObject[0].tenable_scan_id);
            let scanResultId = parseInt(scanResult.id);

            let baseQuery = getVulnerabilityJobQuery(organisationId, jobType, scanId, scanResultId, parseInt(scanResult.finishTime));

            // If it isn't already on the queue, add it
            return models.sequelize.query(baseQuery, {
                type: models.Sequelize.QueryTypes.SELECT
            }).then(function (result) {
                if (result.length === 0) {
                    let vulnerablityJobQueueObject = {
                        scanResultId,
                        scan_id: scanId,
                        scan_start: parseInt(scanResult.startTime),
                        scan_end: parseInt(scanResult.finishTime),
                        last_modification_date: parseInt(scanResult.finishTime)
                    };

                    vulnerabilityJobQueueModel.create({
                        organisation_id: organisationId,
                        job_type: jobType,
                        params: JSON.stringify(vulnerablityJobQueueObject),
                        status: null,
                        attempts: 0
                    }).then((savedJob) => {
                        if (savedJob) {
                            updateTenableDeletedStatus(scanId, organisationId);
                        }
                        processedCount++;
                        updateScanOnProcessComplete(processedCount, scanResults, organisationId);
                    }).catch(error => {
                        const message = error && error.message ? error.message : 'Fail to insert';
                        console.log(message, 'on vulnerability job queue entry')
                    });
                } else {
                    processedCount++;
                    updateScanOnProcessComplete(processedCount, scanResults, organisationId);
                }
            }).catch((error) => {
                processedCount++;
                updateScanOnProcessComplete(processedCount, scanResults, organisationId);
            });
        } else {
            processedCount++;
            updateScanOnProcessComplete(processedCount, scanResults, organisationId);
        }
    });
};

const ignoreBSRResults = (scansResults) => {
    let resultArray = [];

    if (scansResults && scansResults.length > 0) {
        scansResults.forEach((scan) => {
            if (scan.repository && scan.repository.name.indexOf(BSR_Suffix) < 0 && scan.repository.name.indexOf(BSR_Prefix) < 0) {
                resultArray.push(scan);
            }
        });
    }

    return resultArray;
};

const getLatestScanResults = (organisationId) => {
    // Get Unix time for past 2 hour
    let completedTime = generatePastTimeUnix(2);

    let scanQueryString = '?filter=usable,completed&fields=status,name,createdTime,startTime,finishTime,id&startTime=' + completedTime;

    tenableHelper.requestTenable(organisationId, 'scanResult' + scanQueryString, {}, 'GET', {}, async (tenableError, resultedScans) => {

        if (resultedScans && resultedScans.response && resultedScans.response.usable && resultedScans.response.usable.length > 0) {
            let scanResults = ignoreBSRResults(resultedScans.response.usable);
            let scanProjection = {
                "name": 1,
                "tenable_scan_id": 1,
                "scan_end": 1
            };

            // Get all reports from DB
            let existingReports = await getExistingReports(organisationId);
            if (existingReports && existingReports.length > 0) {
                // Delete existing reports from Tenable result by comparing finishTime
                scanResults = await removeExistingReports(existingReports, scanResults);
            }

            const existingScansPromise = scanModel.getExistingScans(
                organisationId,
                getExistingScanQuery(scanResults),
                scanProjection
            );

            existingScansPromise.then((existingScanCursor) => {
                existingScanCursor.toArray((mongoError, existingScans) => {
                    if (existingScans && existingScans.length > 0) {
                        let groupedScanObject = _.groupBy(existingScans, "name");

                        insertIntoVulnerabilityJobQueue(scanResults, groupedScanObject, organisationId);
                    } else {
                        console.log("No scans found for organisation : ", organisationId);
                    }
                });
            }).catch((mongoError) => {
                console.log("Mongo error..", mongoError);
            });
        } else {
            let noScanResultError = '';
            if (resultedScans && resultedScans.response && resultedScans.response.usable && resultedScans.response.usable.length == 0) {
                noScanResultError = "No scans results found for organisation :" + organisationId + "in tenable";
            }
            const errorMessage = tenableError ? (constantErrors.tenable.scansError + " due to: " + tenableError) : noScanResultError ? noScanResultError : constantErrors.tenable.scansError;
            console.log(errorMessage);
        }
    });
}

const getOrganisationArray = (resultArray) => {
    let organisationArray = [];

    if (resultArray && resultArray.length > 0) {
        _.map(resultArray, function (organisationService) {
            let organisationId;
            let organisationVMCredentials;
            try {
                organisationId = JSON.parse(organisationService.id);
                organisationVMCredentials = JSON.parse(organisationService['Services.OrgService.credentials']);
            } catch (e) {
                // Do nothing
            }

            if (organisationId && organisationVMCredentials && organisationVMCredentials.tenable) {
                organisationArray.push({
                    id: organisationId,
                    credentials: organisationVMCredentials
                });
            }
        });
    }

    return organisationArray;
};

const getScanResults = async () => {
    const supportedTypes = await servicesHelper.getServicesSlugs(true);

    if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
        /**
     * ======================================================================
         * Get All customer who subscribed for VM service
     * ======================================================================
     */
        orgModel.organization().getAllOrgsCredentials(supportedTypes.VM.short).then((result) => {
            let enrolledOrganizations = getOrganisationArray(result.rows);

            if (enrolledOrganizations && enrolledOrganizations.length > 0) {
                // Process earch organisation to get vulnerablities
                _.each(enrolledOrganizations, (organisation) => {
                    getLatestScanResults(organisation.id);
                });
            }
        });
    } else {
        console.error(constantErrors.organizationService.supportedTypesNotAvailable);
    }
};

const generatePastTimeUnix = (toSubstractNo = 1, typeString = 'hours') => {
    return moment().subtract(toSubstractNo, typeString).unix();
};

const getExistingReports = async (organisationId) => {
    let reportCollection = config.mongo.tables.reports;
    let fields = { last_modification_date: 1 };

    try {
        let reportList = await mongo.find(organisationId, reportCollection, {}, fields);
        return reportList.toArray();
    } catch (error) {
        console.log('Error getting reports from DB', error);
        return [];
    }
};


const removeExistingReports = async (dbReports, tenableReports) => {
    // Update last_modification field as a string and rename for compare
    dbReports && dbReports.map(report => {
        report.finishTime = report && report.last_modification_date && report.last_modification_date.toString();
        delete report.last_modification_date;
    });
    const finalResults = _.differenceBy(tenableReports, dbReports, 'finishTime');
    return finalResults;
};

module.exports = {
    getScanResults,
    getVulnerabilityJobQuery
};

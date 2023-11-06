const models = require('../../db_models');
const config = require('config');
const vmQueueModel = models.VulnerabilitiesJobQueue;
const tenableHelper = require('../../helpers/tenable');
const _ = require('lodash');
const reportsModel = require('../../models/reports');
const mongo = require('../../helpers/mongo');
const Sequelize = require('sequelize');
const constantErrors = require('../../helpers/constant-errors');
const BSRIdentifier = config.globals.tenable.Repository.BSR_Identifier;
const [BSR_Prefix, BSR_Suffix] = [`${BSRIdentifier}_`, `_${BSRIdentifier}`];

/**
* Function is a callback to format fields in fetched vulnerabilities object.
* @param {Object} vulnerabilityCollection - vulnerabilities collection.
* @return {Object} - Return vulnerabilities collection after formating vulnerability object.
*/
const formatVulnerabilityFields = (vulnerabilityCollection, scanId) => {
    vulnerabilityCollection.severity = parseInt(vulnerabilityCollection.severity.id);
    vulnerabilityCollection.port_protocol = vulnerabilityCollection.port + '/' + vulnerabilityCollection.protocol;
    vulnerabilityCollection.seeAlso = [vulnerabilityCollection.seeAlso];
    vulnerabilityCollection.cve = [vulnerabilityCollection.cve];
    vulnerabilityCollection.host_id = 0;

    return _.extend(vulnerabilityCollection, { tenable_scan_id: scanId });
}

const getVulnerabilityFromTenable = (organisationId, parameters, callback) => {
    let requestBody = {
        "query": {
            "type": "vuln",
            "sourceType": "individual",
            "startOffset": config.globals.tenable.analysis.startOffset,
            "endOffset": config.globals.tenable.analysis.endOffset,
            "tool": "vulndetails",
            "scanID": parameters.scanResultId,
            "view": "all",
            "sortColumn": "severity",
            "sortDirection": "desc"
        },
        "sourceType": "individual",
        "scanID": parameters.scanResultId,
        "sortDir": "desc",
        "sortField": "severity",
        "type": "vuln"
    };

    return tenableHelper.requestTenable(organisationId, 'analysis', {}, 'POST', requestBody, callback);
};

const updateVulnerabilites = (organisationId, parameters, vulnerabilitiesList) => {

    let vulnerabilities = _.map(vulnerabilitiesList, vulnerability => formatVulnerabilityFields(vulnerability, parameters.scan_id));
    let targets = [];
    vulnerabilities.forEach((vulnerability) => {
        if (targets.indexOf(vulnerability.ip) < 0) {
            targets.push(vulnerability.ip);
        }
    });
    const inventoryQuery = { soc: { $in: targets } };

    return mongo.find(organisationId, config.mongo.tables.inventory, inventoryQuery).then((inventoryCursor) => {
        if (inventoryCursor) {
            return inventoryCursor.toArray().then((inventories) => {
                let targetInventory = _.groupBy(inventories, 'soc');
                vulnerabilities.forEach((vulnerability) => {
                    vulnerability.acr = targetInventory[vulnerability.ip] ? targetInventory[vulnerability.ip][0].acr : 0;
                });

                return reportsModel.syncReport(organisationId, parameters, vulnerabilities).then(function (response) {
                    return Promise.resolve(response);
                }).catch(function (jobError) {
                    return Promise.reject(jobError);
                });
            }).catch(function (jobError) {
                return Promise.reject(jobError);
            });
        }
        return reportsModel.syncReport(organisationId, parameters, vulnerabilities).then(function (response) {
            return Promise.resolve(response);
        }).catch(function (jobError) {
            return Promise.reject(jobError);
        });
    });
};

const updateLastUpdatedTimeinScanObject = (result, parameters) => {
    let updatedScanObject = {
        scan_end: parameters.last_modification_date,
        is_fetch_vm_required: false
    };

    mongo.collection(result.organisation_id, config.mongo.tables.scans).then((scanCollection) => {
        scanCollection.updateOne({ tenable_scan_id: parameters.scan_id }, { $set: updatedScanObject }).then((updatedResp) => {

        }).catch((mongoError) => {

        });
    });
};

const getVulnerabilites = async () => {
    let queryParams = {
        where: {
            params: { [Sequelize.Op.and]: [{ [Sequelize.Op.notLike]: '%' + BSR_Prefix + '%' }, { [Sequelize.Op.notLike]: '%' + BSR_Suffix + '%' }] },
            job_type: config.globals.queueTypes.vulnerability,
            status: null,
            attempts: {
                [Sequelize.Op.lt]: config.cron.failAttempts
            }
        },
        order: [
            Sequelize.fn('isnull', Sequelize.col('priority')),
            ['priority', 'ASC']
        ]
    };

    vmQueueModel.findOne(queryParams).then((result) => {
        if (result) {
            // Before anything, increment the number of attempts
            result.update({
                status: "running",
                attempts: result.attempts + 1
            }).then((result) => {
                const parameters = JSON.parse(result.params);

                getVulnerabilityFromTenable(result.organisation_id, parameters, (tenableError, scanResults) => {
                    if (scanResults) {
                        let vulnerabilitiesList = scanResults && scanResults.response && scanResults.response.results ? scanResults.response.results : [];

                        if (vulnerabilitiesList && vulnerabilitiesList.length > 0) {
                            updateVulnerabilites(result.organisation_id, parameters, vulnerabilitiesList).then((response) => {
                                // updateLastUpdatedTimeinScanObject(result, parameters);
                                result.destroy();
                            }).catch((error) => {
                                result.update({
                                    status: null,
                                    attempts: 0
                                });
                                const message = error && error.message ? error.message : 'Failed to update vulnerabilities';
                                console.log(message, 'update vulnerabilities');
                            });
                        } else {
                            result.destroy();
                            console.log('No vulnerability found for the scan Id ....', parameters.scanResultId);
                        }
                    } else {
                        const errorMessage = tenableError ? (constantErrors.tenable.vulnerabilities + " due to: " + JSON.stringify(tenableError)) : constantErrors.tenable.vulnerabilities;

                        console.log(errorMessage);

                        if (tenableError && tenableError.error_code && tenableError.error_code.toString() === "143") {
                            result.destroy();
                        } else {
                            // result.update({
                            //     status: null,
                            //     attempts: 0
                            // });
                        }
                    }
                });
            }).catch((error) => {
                console.log(error);
            });
        }
    });
};

module.exports = {
    getVulnerabilites
};

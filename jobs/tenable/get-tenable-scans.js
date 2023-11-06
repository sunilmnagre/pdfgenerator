const _ = require('lodash');
const config = require('config');
const tenableHelper = require('../../helpers/tenable');
const scanModel = require('../../models/scan');
const orgModel = require('../../models/organization');
const mongo = require('../../helpers/mongo');
const MongoObjectId = require('mongodb').ObjectID;
const servicesHelper = require('../../helpers/services');
const constantErrors = require('../../helpers/constant-errors');

const scanMongoCollection = config.mongo.tables.scans;
/**
 * Formatted Scan Objects
 * @param formattedScanObjects
 * @returns {{$or: Array}}
 */
const getExistingScanQuery = (formattedScanObjects) => {
  const scanQuery = { $or: [] };
  _.each(formattedScanObjects, (scanObject) => {
    scanQuery.$or.push({
      tenable_scan_id: scanObject.tenable_scan_id
    });
  });

  return scanQuery;
};

/**
 * Get Recently Inserted and updated Scans
 * @param existingScans
 * @param formattedScanObjects
 * @returns {Array}
 */
const getRecentlyInsertedAndUpdatedScans = (existingScans, formattedScanObjects) => {
  const recentlyInsertedScans = [];
  const recentlyUpdatedScans = [];

  _.each(formattedScanObjects, (formattedScan) => {
    let isExist = false;

    _.each(existingScans, (existingScan) => {
      //If id doe's not matches with any existing id then its a new entry and its need to be inserted
      if (formattedScan && formattedScan.tenable_scan_id && existingScan && existingScan.tenable_scan_id
        && formattedScan.tenable_scan_id.toString() === existingScan.tenable_scan_id.toString()) {
        isExist = true;
        //If id matches but scan_end field is changed then scan is updated and its need to be updated
        if (parseInt(formattedScan.scan_end) > parseInt(existingScan.scan_end)) {
          formattedScan._id = existingScan._id;

          recentlyUpdatedScans.push(formattedScan);
        }
      }
    });

    if (!isExist) {
      recentlyInsertedScans.push(formattedScan);
    }
  });
  return { recentlyInsertedScans, recentlyUpdatedScans };
};

const getScans = async () => {
  // Find the folder numbers and assign them
  const supportedTypes = await servicesHelper.getServicesSlugs(true);

  if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
    /**
   * ======================================================================
     * Get All customer who subscribed for VM service
   * ======================================================================
     */
    orgModel.organization().getAllOrgsCredentials(supportedTypes.VM.short).then((result) => {
      _.map(result.rows, (organisationService) => {

        let organisationId;
        let organisationVMCredentials;
        try {
          organisationId = JSON.parse(organisationService.id);
          organisationVMCredentials = JSON.parse(organisationService['Services.OrgService.credentials']);
        } catch (e) {
          // Do nothing
        }

        if (organisationId && organisationVMCredentials && organisationVMCredentials.tenable) {
          const scanQueryString = '?filter=usable&fields=type,policy,createdTime,modifiedTime,schedule,name,ipList,policy,repository,credentials,status,enabled,zone';

          tenableHelper.requestTenable(organisationId, 'scan' + scanQueryString, {}, 'GET', {}, (tenableError, resultedScansInfo) => {
            if (resultedScansInfo) {
              let tenableScans = [];

              try {
                tenableScans = resultedScansInfo && resultedScansInfo.response &&
                  resultedScansInfo.response.usable ? resultedScansInfo.response.usable : [];
              } catch (e) {
                // Do nothing.
              }

              /**
                * ======================================================================
                * Prepared the scan object to insert or update
                * ======================================================================
                */
              if (tenableScans && tenableScans.length > 0) {

                const formattedScanObjects = scanModel.getFormattedScanObjects(tenableScans);
                const existingScansPromise = scanModel.getExistingScans(
                  organisationId,
                  getExistingScanQuery(formattedScanObjects)
                );

                /**
                  * ======================================================================
                  * Insert the scan object into Mongo DB collection
                  * ======================================================================
                  */
                existingScansPromise.then((existingScansList) => {
                  existingScansList.toArray(async (error, existingScans) => {
                    if (!error && existingScans && existingScans.length >= 0) {
                      const scanObject = getRecentlyInsertedAndUpdatedScans(
                        existingScans,
                        formattedScanObjects
                      );

                      if (scanObject.recentlyInsertedScans && scanObject.recentlyInsertedScans.length > 0) {
                        try {
                          const scansIndex = await mongo.createIndex(organisationId, scanMongoCollection, { tenable_scan_id: 1 });
                          if (scansIndex && scansIndex === 'tenable_scan_id_1') {
                            await mongo.insert(organisationId, scanMongoCollection, scanObject.recentlyInsertedScans);
                          }
                        } catch (e) {
                          const message = e && e.message ? e.message : 'Fail to  create an index'
                          console.log(message, 'scans index or scan insert')
                        }
                      }

                      if (scanObject.recentlyUpdatedScans && scanObject.recentlyUpdatedScans.length > 0) {
                        _.each(scanObject.recentlyUpdatedScans, (updatedScan) => {
                          const scanId = updatedScan._id;
                          let updatedScanObject = {
                            name: updatedScan.name,
                            scan_end: updatedScan.scan_end,
                            is_fetch_vm_required: false
                          };

                          mongo.collection(organisationId, scanMongoCollection).then((scanCollection) => {
                            scanCollection.updateOne({ _id: MongoObjectId(scanId), tenable_scan_id: updatedScan.tenable_scan_id }, { $set: updatedScanObject }).then(() => {

                            });
                          });

                        })
                      }

                      // Add logic to mark scans as deleted from Tenable
                      if (formattedScanObjects && formattedScanObjects.length > 0) {
                        markScansDeletedFromTenable(organisationId, formattedScanObjects);
                      }
                    }
                  });
                }).catch((error) => {
                  console.log(error.message);
                });
              } else {
                // Mark scans as deleted
                markScansDeletedFromTenable(organisationId, []);
              }
            } else {
              const errorMessage = tenableError ? (constantErrors.tenable.scansError + " due to: " + tenableError) : constantErrors.tenable.scansError;
              console.log(errorMessage);
            }
          });
        }
      });
    });
  } else {
    throw new Error(constantErrors.organizationService.supportedTypesNotAvailable);
  }
};


/**
  If scan(s) deleted from Tenable, mark deleted in MSSP DB
 * @param {Number} organisationId - Id of organisation
 * @param {Array} tanbleScans - Array of scans
 */
const markScansDeletedFromTenable = async (organisationId, tanbleScans) => {
  // If there is no Scans in Tenable
  if (tanbleScans.length == 0) {
    tanbleScans = [{
      tenable_scan_id: 'FAKE-SCAN-ID'
    }];
  }

  let tenableScanIds = _.map(tanbleScans, 'tenable_scan_id');
  if (tenableScanIds && tenableScanIds.length > 0) {
    // Get all scans from DB
    const scansPromise = scanModel.getExistingScans(organisationId, {}, { tenable_scan_id: 1 });

    scansPromise.then((scansList) => {
      scansList.toArray(async (error, scans) => {

        // Check for error and scans
        if (!error && scans && scans.length >= 0) {
          let dbScanIds = _.map(scans, 'tenable_scan_id');
          let deletableScanIds = _.difference(dbScanIds, tenableScanIds);
          if (deletableScanIds && deletableScanIds.length > 0) {
            await mongo.updateMany(organisationId, scanMongoCollection,
              { tenable_scan_id: { $in: deletableScanIds } },
              {
                $set: { is_tenable_deleted: true }
              });
          }
        }
      });
    });
  }
}

module.exports = {
  getScans
};

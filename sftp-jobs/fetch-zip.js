
const _ = require('lodash');
const config = require('config');
const models = require('../db_models');
const Client = require('ssh2-sftp-client');
const AdmZip = require('adm-zip');
const fs = require('fs');
const servicesHelper = require('../helpers/services');
const sftpHelper = require('../helpers/sftp');
const constantErrors = require('../helpers/constant-errors');

/**
 *
 * @param organisations
 * @param sftp
 * @returns {Promise<Array>}
 */
const getOrganizationSlugs = (organisations, sftp) => {
  const sftpConfig = JSON.parse(process.env.sftp);
  const { BASIC_SFTP_PATH, BASIC_SFTP_PATH_OLD } = sftpConfig;
  const filesArray = [];
  const filesPromises = [];
  for (let i = 0; i < organisations.length; i++) {
    // get the next result
    const result = new Promise((resolve, reject) => {
      const organisation = organisations[i];
      const queryArguments = {
        attributes: ['id', 'slug', 'name', 'active', 'created_by', 'created_at', 'updated_at'],
        where: { id: organisation },
      };

      models.Organization.findOne(queryArguments).then((org) => {
        // const filesArray =[];
        if (org !== null) {
          const orgSlug = org.name;

          sftpHelper.getFiles(sftp, BASIC_SFTP_PATH + orgSlug + '/').then((files) => {
            //  console.log(files,"files");
            if (files.length > 0) {
              files.map((file) => {
                filesArray.push({
                  fileName: file.name,
                  path: BASIC_SFTP_PATH + orgSlug + '/' + file.name,
                  backuppath: BASIC_SFTP_PATH_OLD + orgSlug + '/' + file.name,
                  org: orgSlug,
                });
              });
              resolve(filesArray);
            } else {
              resolve([]);
            }
          }).catch((error) => {
            //console.log(error.message);
            resolve([]);
          });
          // resolve(orgSlug)
        } else {
          resolve([]);
        }
      });
    });
    filesPromises.push(result);
  }
  return Promise.all(filesPromises).then((results) => {
    // console.log(results, 'files are reading');


    return new Promise((resolve, reject) => {
      resolve(filesArray);
    });
  });
  // return total;
};
/**
 *
 * @param data
 * @param sftp
 * @returns {Promise<Array>}
 */
const getFile = (data, sftp) => {
  // console.log("files started");
  const sftpConfig = JSON.parse(process.env.sftp);
  const { LOCAL_FILES_PATH } = sftpConfig;

  const filesArray = [];
  const filesPromises = [];
  for (let i = 0; i < data.length; i += 1) {
    const inputpath = data[i].path;
    const { backuppath } = data[i];
    const outputpath = LOCAL_FILES_PATH + data[i].fileName;
    // get the next result
    const result = new Promise((resolve, reject) => {
      sftp.fastGet(inputpath, outputpath, (result, err) => {
        // reading archives
        // const zip = new AdmZip(outputpath);
        //  zip.extractAllTo(/* target path */LOCAL_FILES_PATH, /* overwrite */true);
        // reading archives
        const dateTime = new Date().getTime();
        const zip = new AdmZip(outputpath);
        const zipEntries = zip.getEntries(); // an array of ZipEntry records
        // create a zip object to hold the new zip files
        const newZip = new AdmZip();

        zipEntries.forEach(function (zipEntry) {
          const fileName = zipEntry.entryName;
          const fileContent = zip.readAsText(fileName);
          //Here remove the top level directory
          const newFileName = fileName.split('.')[0] + '-' + dateTime + '.' + fileName.split('.')[1];

          newZip.addFile(newFileName, fileContent, '', 0644 << 16);
        });
        const newZipFileName = data[i].fileName.split('.')[0] + '-latest' + '.' + data[i].fileName.split('.')[1];
        newZip.writeZip(LOCAL_FILES_PATH + newZipFileName);
        setTimeout(function () {
          const dZip = new AdmZip(LOCAL_FILES_PATH + newZipFileName);
          dZip.extractAllTo(/* target path */LOCAL_FILES_PATH, /* overwrite */true);
        }, 1000);
        if (err) throw err;
        sftp.rename(inputpath, backuppath).then((testdata) => {
          resolve({ result: testdata });
        }).catch((err) => {
          //console.log(err);
          resolve({ result: err.message });
        });
      }).catch((err) => {
        //console.log(err);
        resolve({ result: err.message });
      });
    });

    filesPromises.push(result);
  }
  return Promise.all(filesPromises).then((results) => {
    //console.log(results, 'files  are downloaded');
    return new Promise((resolve, reject) => {
      resolve(filesArray);
    });
  });
};

/**
 * Walk through  the each organization folder  and get the files
 *  Used Recursive approach
 * @param sftp
 * @param organisations
 */
const sftpAction = (sftp, organisations) => {
  getOrganizationSlugs(organisations, sftp).then((data) => {
    getFile(data, sftp).then((res) => {
      //console.log(res);
      sftp.end();
    });
  });
};

/**
 * proceedToFetchZipFiles
 */
const proceedToFetchZipFiles = async () => {
  const supportedTypes = await servicesHelper.getServicesSlugs(true);
  // console.log("files started");
  const sftpConfig = JSON.parse(process.env.sftp);
  if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
    const sftp = new Client();
    // Get the folder IDs for all organisations. We will use this to figure out
    //  which customer the scan is for
    var searchParameters = {
      attributes: ['organization_id', 'credentials'],
      include: [{
        model: models.Service,
        where: {
          short: _.toUpper(supportedTypes.VM.short),
        },
        attributes: ['id'],
      }],
    };

    // Find the folder numbers and assign them
    models.OrgService.findAll(searchParameters).then((result) => {
      const organisations = [];
      _.map(result, (organisationService) => {
        if (organisationService.dataValues.organization_id !== 1) {
          organisations.push(organisationService.dataValues.organization_id);
        }
      });
      // SFTP connection
      sftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig['$EURE-password'],
      }).then(() => {
        sftpAction(sftp, organisations, 0);
      });
    });
  } else {
    throw new Error(constantErrors.organizationService.supportedTypesNotAvailable);
  }
};

function getData() {
  const sftp = JSON.parse(process.env.sftp);
  const { LOCAL_FILES_PATH } = sftp;

  fs.readdir(LOCAL_FILES_PATH, (error, zipFiles) => {
    let zipFilesList = zipFiles;
    if (zipFilesList && zipFilesList.length > 0) {
      zipFilesList = zipFilesList.filter(function filterFiles(file) {
        return (file.indexOf('.zip') !== -1);
      });

      if (zipFilesList.length > 0) {
        zipFilesList.forEach(function parseJobFile(zipfile, index) {
          fs.unlink(LOCAL_FILES_PATH + zipfile, (err) => {
            if (err) {
              console.error(err);
            }
            //console.log(LOCAL_FILES_PATH + zipfile + 'File has been Deleted');
            if (index === zipFilesList.length - 1) {
              proceedToFetchZipFiles();
            }
          });
        });
      } else {
        proceedToFetchZipFiles();
      }
    } else {
      proceedToFetchZipFiles();
    }
  });
}

module.exports = getData;

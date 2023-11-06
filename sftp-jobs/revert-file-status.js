const fs = require('fs');
const config = require('config');
const _ = require('lodash');




/**
 * GetUnProcessedFiles
 * @param csvFilesList
 * @param dateRange
 * @returns {Array}
 */
function getUnProcessedFiles(csvFilesList, dateRange) {
  const updatedFiles = [];
  const sftp = JSON.parse(process.env.sftp);
  const CSV_FILE_PATH = sftp.LOCAL_FILES_PATH;
  csvFilesList.forEach((file) => {
    if (fs.existsSync(CSV_FILE_PATH + file)) {
      let stats;

      try {
        stats = fs.statSync(CSV_FILE_PATH + file);
      } catch (e) {
        // Do nothing
      }

      if (stats && stats.atime && stats.atime <= dateRange) {
        updatedFiles.push({
          name: file,
          createdDateTime: stats.atime
        });
      }
    }
  });

  return updatedFiles;
}

/**
 * RevertFileStatus
 */
function revertFileStatus() {
  const sftp = JSON.parse(process.env.sftp);
  const HOURS_RANGE = sftp.FILE_REVERT_HOURS_RANGE;
  const CSV_FILE_PATH = sftp.LOCAL_FILES_PATH;
  fs.readdir(CSV_FILE_PATH, function (error, csvFilesList) {
    if (csvFilesList && csvFilesList.length > 0) {
      csvFilesList = csvFilesList.filter(function filterFiles(file) {
        return (file.indexOf('.csv') > -1 && file.indexOf(sftp.FILE_TYPE.INPROGRESS) > -1);
      });

      const dateRange = new Date(new Date().setHours(new Date().getHours() - HOURS_RANGE));
      csvFilesList = getUnProcessedFiles(csvFilesList, dateRange);
      csvFilesList = _.sortBy(csvFilesList, ['createdDateTime'], ['asc']);

      if (csvFilesList && csvFilesList.length > 0) {
        _.each(csvFilesList, (file) => {
          const inprogressCSVFileName = file.name;
          const inprogressCSVFilePath = CSV_FILE_PATH + inprogressCSVFileName;
          if (fs.existsSync(inprogressCSVFilePath)) {
            // console.log('renaming the unprocessed file >>>>>>>. ', inprogressCSVFilePath);
            const csvFileName = inprogressCSVFileName.split(sftp.FILE_TYPE.INPROGRESS)[1];
            const csvFilePath = CSV_FILE_PATH + csvFileName;
            fs.rename(inprogressCSVFilePath, csvFilePath, function (err) {
              // DO nothing.
            });
          }
        });
      }
    }
  });
}

module.exports = revertFileStatus;

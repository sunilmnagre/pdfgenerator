const fs = require('fs');
const config = require('config');
const _ = require('lodash');
const fetchTickets = require('../sftp-jobs/fetch-tickets');
const updateTickets = require('../sftp-jobs/update-tickets');

function addCreatedDateTime(csvFilesList) {
    const sftp = JSON.parse(process.env.sftp);
    const CSV_FILE_PATH = sftp.LOCAL_FILES_PATH;

    let updatedFiles = [];

    csvFilesList.forEach((file) => {
        if (fs.existsSync(CSV_FILE_PATH + file)) {
            let stats;

            try {
                stats = fs.statSync(CSV_FILE_PATH + file);
            } catch (e) {
                //Do nothing
            }

            if (stats && stats.atime) {
                updatedFiles.push({
                    name: file,
                    createdDateTime: stats.atime
                });
            }
        }
    });

    return updatedFiles;
}

function processJob(fileType) {
    const sftp = JSON.parse(process.env.sftp);
    const CSV_FILE_PATH = sftp.LOCAL_FILES_PATH

    fs.readdir(CSV_FILE_PATH, function (error, csvFilesList) {

        if (csvFilesList && csvFilesList.length > 0) {

            csvFilesList = csvFilesList.filter(function filterFiles(file) {
                return (file.indexOf(".csv") > -1 && file.indexOf(fileType) > -1 && file.indexOf(sftp.FILE_TYPE.INPROGRESS) === -1);
            });

            csvFilesList = addCreatedDateTime(csvFilesList);

            csvFilesList = _.sortBy(csvFilesList, ['createdDateTime'], ['asc']);

            csvFilesList = csvFilesList.slice(0, 5); // Processing 5 files per job

            console.log("processing files for type", fileType, " >>>>>>... ", csvFilesList);

            if (csvFilesList && csvFilesList.length > 0) {
                // Processing files one by one
                if (fileType === sftp.FILE_TYPE.ALARMS) {
                    fetchTickets(0, csvFilesList);
                } else if (fileType === sftp.FILE_TYPE.TICKETS) {
                    updateTickets(0, csvFilesList);
                }
            }
        }
    });
}

module.exports = {
    processJob
};
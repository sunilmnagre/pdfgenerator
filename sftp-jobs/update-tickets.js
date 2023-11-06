const csvParse = require('csv-parse/lib/sync');
const _ = require('lodash');
const async = require('async');
const config = require('config');
const { MongoClient } = require('mongodb');
const dbOperation = require('../models/organization');
const util = require('../helpers/util');
const fs = require('fs');
const models = require('../db_models');
const vulnerabilitiesTable = config.mongo.tables.vulnerabilities

function isAlarmFileInProcess(fileName) {

  const sftp = JSON.parse(process.env.sftp);
  const CSV_FILE_PATH = sftp.LOCAL_FILES_PATH;

  const fileNameWithoutExt = fileName.split('.csv')[0];
  const splittedByDifferentiator = fileNameWithoutExt.split('-');
  const timestamp = splittedByDifferentiator[splittedByDifferentiator.length - 1];
  const alarmFile = CSV_FILE_PATH + sftp.FILE_TYPE.ALARMS + '-' + timestamp + '.csv';
  const inprogressAlarmFile = CSV_FILE_PATH + sftp.FILE_TYPE.INPROGRESS + sftp.FILE_TYPE.ALARMS + '-' + timestamp + '.csv';

  return (fs.existsSync(alarmFile) || fs.existsSync(inprogressAlarmFile));
}

/**
 * processUpdateTickets
 * @param index
 * @param csvFilesList
 */
function processUpdateTickets(index, csvFilesList) {

  const sftp = JSON.parse(process.env.sftp);
  const CSV_FILE_PATH = sftp.LOCAL_FILES_PATH;
  const csvFileName = csvFilesList[index].name;
  const csvFilePath = CSV_FILE_PATH + csvFileName;

  if (fs.existsSync(csvFilePath) && !isAlarmFileInProcess(csvFileName)) {
    // console.log('processing the file >>>>>>>. ', csvFilePath);
    const inProgressCSVFilePath = CSV_FILE_PATH + sftp.FILE_TYPE.INPROGRESS +
      csvFileName;

    fs.rename(csvFilePath, inProgressCSVFilePath, (err) => {
      if (!err) {
        // console.log('File after renaming >>>>>..', inProgressCSVFilePath);
        fs.readFile(inProgressCSVFilePath, (err, fileDate) => {
          // get the files of tickets and ready one by one
          const data = csvParse(fileDate, {
            delimiter: ',',
            skip_empty_lines: true,
            columns: cols => _.map(cols, _.camelCase)
          });

          if (_.size(data) >= 1) {
            const groupedByCustomer = _.groupBy(data, 'customerName');
            let processedCustomer = 0;

            // Remove ticket data if customer name is not present
            _.forOwn(groupedByCustomer, (value, key) => {
              if (_.isEmpty(key)) {
                delete groupedByCustomer[key];
              }
            });

            async.eachOf(groupedByCustomer, (ticketData, customerName, callback) => {
              // TBD - TBD
              // write helper for fetching the mongodb credentials for this customer/organization
              const ticketDataNew = _.map(ticketData, ticket => ticket);

              const updateTickets = (db, callback) => {
                // Get the documents collection
                const collection = db.collection(vulnerabilitiesTable);
                updateTicketsData(collection, ticketDataNew).then((result) => {
                  processedCustomer++;
                  if (processedCustomer === _.size(groupedByCustomer)) {
                    // console.log('Deleting the File >>>>>..', inProgressCSVFilePath);
                    fs.unlinkSync(inProgressCSVFilePath, () => {

                    });

                    callback(result);
                  }
                });
              };

              // Connection URL
              // TBD - TBD
              // Get mongo connection from DB

              // Build the initial query
              const queryArguments = {
                attributes: ['id', 'name', 'active', 'created_by', 'created_at', 'updated_at'],
                where: { name: customerName }
              };
              models.Organization.findOne(queryArguments).then((result) => {
                if (result !== null) {
                  dbOperation.organization()
                    .getMongoConnectionUrlByOrgId(result.dataValues.id).then((url) => {
                    // Use connect method to connect to the server
                      MongoClient.connect(url, (err, db) => {
                        updateTickets(db, (result) => {
                          db.close();

                          if ((index + 1) <= csvFilesList.length - 1) {
                            //console.log('Processing the next one in order');
                            processUpdateTickets(index + 1, csvFilesList);
                          // Initiate processing next set of files
                          }

                          callback();
                        });
                      });
                    });
                }
              });
            }, (err) => {
              // '-------- End of Update ticket job --------'
            });
          } else {
            //console.log('---- There is no new ticket ! ------ ');
          }
        });
      }
    });
  } else {
    // console.log('Processing the next File as actual is not there >>>>>..', csvFilePath);
    if ((index + 1) <= csvFilesList.length - 1) {
      processUpdateTickets(index + 1, csvFilesList); // Initiate processing next set of files
    }
  }
}

/**
 *
 * @param collection
 * @param ticketDataNew
 * @returns {Promise}
 */
let updateTicketsData = (collection, ticketDataNew) => new Promise((resolve, reject) => {
  const totalTickets = ticketDataNew.length;
  let processedTickets = 0;
  let unProcessedTickets = 0;

  async.forEachOf(ticketDataNew, (ticket, key, callback) => {
    if (ticket.modifiedDateTt !== undefined && ticket.modifiedDateTt.length > 3) {
      ticket.modifiedDateTt = util.getUTCDate(ticket.modifiedDateTt);
    }

    collection.updateMany(
      { 'ticket.troubleTicketIdTt': ticket.ttId },
      {
        $set: {
          'ticket.latestStatusTt': ticket.latestStatusTt,
          'ticket.latestPriorityTt': ticket.latestPriorityTt,
          'ticket.descriptionTt': ticket.descriptionTt,
          'ticket.totalOpenTimeTt': ticket.totalOpenTimeTt,
          'ticket.clearedTimeSLA': ticket.clearedTimeSLA,
          'ticket.restorationTimeTtSLA': ticket.restorationTimeTtSLA,
          'ticket.clearedInTimeTtSLA': ticket.clearedInTimeTtSLA,
          'ticket.modifiedDateTt': ticket.modifiedDateTt,
          'ticket.clearSlaStatusTtSla': ticket.clearSlaStatusTtSla,
          'ticket.solutionTt': ticket.solutionTt
        }
      }
    ).then((response) => {

      processedTickets++;

      if ((processedTickets + unProcessedTickets) === totalTickets) {
        if (unProcessedTickets > 0) {
          reject('Failed to update tickets');
        } else {
          resolve('Updated tickets successfully');
        }
      }
      callback();
    }).catch((mongoError) => {
      unProcessedTickets++;

      if ((processedTickets + unProcessedTickets) === totalTickets) {
        if (unProcessedTickets > 0) {
          reject('Failed to update tickets');
        } else {
          resolve('Updated tickets successfully');
        }
      }
      callback();
      // console.log('Mongo error when updating tickets: ', mongoError);
    });
  });
});

module.exports = processUpdateTickets;

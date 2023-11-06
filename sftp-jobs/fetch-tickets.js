const csvParse = require('csv-parse/lib/sync');
const async = require('async');
const _ = require('lodash');
const config = require('config');
const models = require('../db_models');
const { MongoClient } = require('mongodb');
const dbOperation = require('../models/organization');
const fs = require('fs');
const util = require('../helpers/util');

const MongoObjectId = require('mongodb').ObjectID;

const vulnerabilitiesTable = config.mongo.tables.vulnerabilities;
/**
 *
 * @param VMTickets
 * @param collection
 * @returns {Promise}
 */
const updateVMTickets = (VMTickets, collection) => {
  const promiseArray = [];
  VMTickets.map((ticket) => {
    const promise = new Promise(function (resolve, reject) {
      if (ticket && ticket.id && ticket.id.length > 6) {
        collection.updateMany(
          { _id: new MongoObjectId(ticket.id) }, {
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
              'ticket.createDateTt': ticket.createDateTt,
              'ticket.solutionTt': ticket.solutionTt,
              'ticket.troubleTicketIdTt': ticket.troubleTicketIdTt
            }
          }
        ).then((modifyResult) => {
          resolve('Tickets are updated successfully');
        }).catch((mongoError) => {
          reject('Failed to updated Tickets');
          //console.log('Mongo error when updating tickets: ', mongoError);
        });
      }
    });
    promiseArray.push(promise);
  });

  return Promise.all(promiseArray).then(function (resolve, reject) {
    return new Promise((resolve, reject) => {
      resolve('Tickets are updated successfully');
    });
  }).catch((error) => {
    //console.log('Error when updating tickets:', error);
    // reject('Mongo error when updating tickets: ' + mongoError);
  });
};

/**
 * fetchTickets
 * @param index
 * @param csvFilesList
 */
function fetchTickets(index, csvFilesList) {
  const csvFileName = csvFilesList[index].name;

  const sftp = JSON.parse(process.env.sftp);
  const CSV_FILE_PATH = sftp.LOCAL_FILES_PATH
  const csvFilePath = CSV_FILE_PATH + csvFileName;

  if (fs.existsSync(csvFilePath)) {
    //console.log('processing the file >>>>>>>. ', csvFilePath);
    const inProgressCSVFilePath = CSV_FILE_PATH + sftp.FILE_TYPE.INPROGRESS +
      csvFileName;

    fs.rename(csvFilePath, inProgressCSVFilePath, (err) => {
      if (!err) {
        //console.log('File after renaming >>>>>..', inProgressCSVFilePath);
        fs.readFile(inProgressCSVFilePath, (err, fileDate) => {
          // get the files of alarms and ready one by one
          const data = csvParse(fileDate, {
            delimiter: ',',
            skip_empty_lines: true,
            columns: cols => _.map(cols, _.camelCase)
          });


          if (_.size(data) >= 1) {
          // console.log(data,"data")
            const groupedByCustomer = _.groupBy(data, 'customerName');
            async.eachOf(groupedByCustomer, (ticketData, customerName, callback) => {
              // write helper for fetching the mongodb credentials for this customer/organization
              const ticketDataPromises = _.map(ticketData, (ticket) => {
                ticket.createDateTt = util.getUTCDate(ticket.createDateTt);
                ticket.modifiedDateTt = util.getUTCDate(ticket.modifiedDateTt);
                if (ticket.acknowledgetime !== undefined && ticket.acknowledgetime.length > 3) {
                  ticket.acknowledgetime = util.getUTCDate(ticket.acknowledgetime);
                }

                if (ticket.realReadyTimeTt !== undefined && ticket.realReadyTimeTt.length > 3) {
                  ticket.realReadyTimeTt = util.getUTCDate(ticket.realReadyTimeTt);
                }

                if (ticket.additionalString !== undefined && ticket.additionalString !== null) {
                  const additionalStringArray = ticket.additionalString.split(' ');
                  if (additionalStringArray.length > 0) {
                    const idField = _.find(additionalStringArray, object => _.startsWith(object, 'id-'));
                    if (idField !== undefined && idField !== null) {
                      const vulnerabilityId = idField.split('-')[1];
                      if (vulnerabilityId !== undefined && vulnerabilityId !== null) {
                        ticket.id = vulnerabilityId.trim();
                      }
                    }
                  }
                }

                return ticket;
              });

              let ticketDataNew = [];
              Promise.all(ticketDataPromises).then((results) => {
                ticketDataNew = results;
                // Build the initial query
                const queryArguments = {
                  attributes: ['id', 'name', 'active', 'created_by', 'created_at', 'updated_at'],
                  where: { name: customerName }
                };
                models.Organization.findOne(queryArguments).then((result) => {
                  if (result !== null) {
                    dbOperation.organization()
                      .getMongoConnectionUrlByOrgId(result.dataValues.id).then((url) => {
                        MongoClient.connect(url, (err, db) => {
                          const connection = db;
                          const collection = db.collection(vulnerabilitiesTable);


                          updateVMTickets(ticketDataNew, collection).then((result) => {
                            // console.log(ticketDataNew,"ticke");
                            if (result === 'Tickets are updated successfully') {
                              connection.close();
                              //console.log('Deleting the File >>>>>..', inProgressCSVFilePath);
                              fs.unlinkSync(inProgressCSVFilePath, () => {

                              });
                            }

                            if ((index + 1) <= csvFilesList.length - 1) {
                              //console.log('Processing the next one in order');
                              fetchTickets(index + 1, csvFilesList);
                            // Initiate processing next set of files
                            }
                            callback();
                          });
                        });
                      });
                  }
                });
              });
            }, (err) => {
              // -------- End of Fetch ticket job --------
            });
          } else {
            //console.log('---- There is no new ticket ! ------ ');
          }
        });
      }
    });
  } else if ((index + 1) <= csvFilesList.length - 1) {
    //console.log('Processing the next File as actual is not there >>>>>..', csvFilePath);
    fetchTickets(index + 1, csvFilesList); // Initiate processing next set of files
  }
}

module.exports = fetchTickets;

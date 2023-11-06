var MongoClient = require('mongodb').MongoClient;
var organisationObject = require('../models/organization');
var config = require('config');
var MongoObjectId = require('mongodb').ObjectID;
var _ = require('lodash');
var mongoDbPlugin = require('mongodb');
var cryptographyHelper = require('../helpers/cryptography');
const fs = require("fs");
var db = {};
var dbConnections = [];
/**
 * Connect to MongoDB and return promise
 * @param {String} connectionURL - Connection URL.
 * @return {Promise} Promise response.
 */
function open(connectionURL) {
  if (connectionURL === null) {
    throw new Error('Trying to connect to a Mongo database without a connection string');
  }

  if (dbConnections[connectionURL] == null) {
    var mongoConnectionOption = {
      connectTimeoutMS: 300000,
      socketTimeoutMS: 300000,
      keepAlive: true,
      reconnectTries: 100
    };

    dbConnections[connectionURL] = MongoClient.connect(connectionURL, mongoConnectionOption);
  }
  return dbConnections[connectionURL];
}

/**
 * Connect to organisation table and get the mongo credientials
 * @param {Number} organisationId - ID of organisation.§
 * @return {Promise} Promise object for connecting to Mongo
 */
const connectToOrganisationDb = (organisationId) => {
  // get credientials from organization table from Mysql
  let connectionUrlPromise = organisationObject.organization()
    .getMongoConnectionUrlByOrgId(organisationId);

  // return the mongoDB connection promise
  return connectionUrlPromise.then(connectionUrl => open(connectionUrl)).catch((err) => {
    //console.log(err);
  });
}

/**
 * Returns a promise to get the collection from mongo
 * @param {Number} organisationId - ID of organisation
 * @param {String} collectionName - Name of the collection to get
 * @return {Promise}
 */
const collection = (organisationId, collectionName) => {
  // Get the connection to Mongo
  let connection = connectToOrganisationDb(organisationId);

  return connection.then(mongoDb => {
    mongoDb.on('timeout', function () {
      //Do nothing.
    });
    return mongoDb.collection(collectionName);
  }).catch((err) => {
    //console.log(err);
  });
}

/**
 * Execute mongo query and return array of object
 * @param {Number} organisationId - ID of organisation.
 * @param {String} collectionName - Name of the collection to query
 * @param {String} query - query to execute.
 * @param {String} projection - fields to fetch.
 * @return {Object} Promise response.
 */
function find(organisationId, collectionName, query = {}, projection = {}) {
  var collectionPromise = collection(organisationId, collectionName);

  return collectionPromise.then(collectionObj => collectionObj.find(query, projection));
}

/**
 * Execute mongo query and return count of objects
 * @param {Number} organisationId - ID of organisation.
 * @param {String} collectionName - Name of the collection to query
 * @param {String} query - query to execute.
 * @param {String} projection - fields to fetch.
 * @return {Object} Promise response.
 */
function count(organisationId, collectionName, query = {}, projection = {}) {
  var collectionPromise = collection(organisationId, collectionName);

  return collectionPromise.then(collectionObj => collectionObj.find(query, projection).count()).catch((err) => {
    console.log(err);
  });
}

/**
 * Execute mongo query and update a document
 * @param {Number} organisationId - ID of organisation.
 * @param {String} collectionName - Name of the collection to query.
 * @param {String} query - query to execute.
 * @param {String} set - fields to update.
 * @return {Object} Promise response.
 */
function updateOne(organisationId, collectionName, query = {}, set = {}) {
  var collectionPromise = collection(organisationId, collectionName);
  return collectionPromise.then(collectionObj => collectionObj.update(query, {
    $set: set
  }));
}

/**
 * Execute mongo query and delete a sub-document
 * @param {Number} organisationId - ID of organisation.
 * @param {String} collectionName - Name of the collection to query.
 * @param {String} query - query to execute.
 * @param {String} set - fields to update.
 * @return {Object} Promise response.
 */
function deleteOne(organisationId, collectionName, query = {}, set = {}) {
  var collectionPromise = collection(organisationId, collectionName);
  return collectionPromise.then(collectionObj => collectionObj.update(query, {
    $pull: set
  }));
}

/**
 * Execute mongo query and update an array inside document
 * @param {Number} organisationId - ID of organisation.
 * @param {String} collectionName - Name of the collection to query.
 * @param {String} query - query to execute.
 * @param {String} set - array to update.
 * @return {Object} Promise response.
 */
function upsertArray(organisationId, collectionName, query = {}, set = {}) {
  var collectionPromise = collection(organisationId, collectionName);
  return collectionPromise.then(collectionObj => collectionObj.update(query, {
    $push: set
  }));
}

/**
 * Execute mongo query and update multiple documents
 * @param {Number} organisationId - ID of organisation.
 * @param {String} collectionName - Name of the collection to query.
 * @param {String} query - query to execute.
 * @param {String} set - fields to update.
 * @return {Object} Promise response.
 */
const updateMany = (organisationId, collectionName, query = {}, set = {}) => {
  let collectionPromise = collection(organisationId, collectionName);
  if (!collectionPromise) {
    return null;
  }
  return collectionPromise.then((collectionObj) => {
    if (!collectionObj) {
      return null;
    }
    return collectionObj.updateMany(query, set);
  });
};

/**
 * Execute mongo query and return one object
 * @param {Number} organisationId - ID of organisation.
 * @param {String} collectionName - Name of the collection to query
 * @param {String} query - query to execute.
 * @param {String} projection - fields to fetch.
 * @return {Object} Promise response.
 */
function findOne(organisationId, collectionName, query = {}, projection = {}) {
  let collectionPromise = collection(organisationId, collectionName);
  if (!collectionPromise) {
    return null;
  }
  return collectionPromise.then((collectionObj) => {
    if (!collectionObj) {
      return null;
    }
    return collectionObj.findOne(query, projection);
  });
}

/**
 * Execute mongo query and return one object
 * @param {Number} organisationId - ID of organisation.
 * @param {String} collectionName - Name of the collection to insert
 * @param {String} documentData - Docuemnt to insert data
 * @return {Object} Promise response.
 */
function insert(organisationId, collectionName, documentData) {
  let collectionPromise = collection(organisationId, collectionName);
  return collectionPromise.then(collectionObj => {
    return collectionObj.insert(documentData);
  }).catch((mongoError) => {
    console.log('mongoError: ' + mongoError.message);
  });
}

/**
 * Close the MongoDB connection.
 * @param {Object} db - MongoDB object
 */
function close(mongoDbConnection) {
  if (mongoDbConnection) {
    mongoDbConnection.close();
  }
}

/**
 * Concat False positive, Security exception
 * and Soft deleted condition to query according to Loggedin user
 * @param {Object} query - Query string wrapped into object
 * @param {Number} userType - Loggedin user user_type
 * @return {Object} - Filtered query after adding condition, if Loggedin user is Customer
 */
function filteredQueryByUserType(query, userType) {
  var conditionArray = query;
  var queryParameters = {};

  if (userType === config.user_type.Customer) {
    // Check if there's an existing $and property, and add one if not
    if (!Object.prototype.hasOwnProperty.call(query, '$and')) {
      query.$and = [];
    }

    queryParameters = {
      $and: [
        {
          $or: [
            { 'false_positive.active': { $eq: 0 } },
            { false_positive: { $exists: false } }
          ]
        },
        {
          $or: [
            { 'security_exception.active': { $eq: 0 } },
            { security_exception: { $exists: false } }
          ]
        },
        { soft_deleted_at: { $not: { $exists: true } } },
        { proposed_close_date: { $exists: false } }
      ]
    };

    conditionArray.$and.push(queryParameters);
  }

  return conditionArray;
}

/**
 * Converts the given array of IDs into Mongo object IDs ready to go into a query
 * @param {Array} arrayToConvert Array of normal IDs to be converted to Mongo IDs
 * @returns {Array} An array of Mongo IDs
 */
function convertIdsToMongoIds(arrayToConvert) {
  return _.map(arrayToConvert, function (id) {
    return MongoObjectId(id);
  });
}

/**
 * Checks if the given string is a valid Mongo ID
 * @param {String} mongoId The string to check
 * @returns {Boolean} True if the given string is a valid Mongo ID
 */
function isMongoId(mongoId) {
  MongoObjectId = mongoDbPlugin.ObjectID;
  return MongoObjectId.isValid(mongoId);
}

/**
 * Creates a Mongo database with user and password using the given slug
 * @param {String} organisationSlug A unique slug for an organisation which is used to create
 *  the database name and user name
 * @param {Function} callback If set, called with the final credentials for the new database
 */
function createOrganisationMongoDb(organisationSlug, callback = null) {
  const databaseName = 'org_' + organisationSlug;
  const userName = 'user_' + organisationSlug;

  const password = cryptographyHelper.generateRandomPassword();
  const encryptedPassword = cryptographyHelper.encrypt(password);

  const credentials = {
    database_name: databaseName,
    username: userName,
    password: encryptedPassword
  };

  let host;
  let mongourl;

  if (config.mongo.replication === true) {
    host = config.mongo.replicationObject.hosts.reduce((total, host) => {
      return total + host.host + ":" + host.port + ",";
    }, "")
    host = host.substring(0, host.length - 1);

    mongourl = config.mongo.replicationObject.protocol + host + '/' + databaseName + "?replicaSet=" + config.mongo.replicationObject.repSet;
  } else {
    host = config.mongo.host;

    mongourl = config.mongo.protocol + host + ':' + config.mongo.port + '/' + databaseName;
  }

  MongoClient.connect(mongourl, function (err, newDatabaseConnection) {
    const options = { roles: ['readWrite'] };

    if (err) {
      console.log(err)
    } else {
      newDatabaseConnection.addUser(userName, password, options, function () {
        newDatabaseConnection.close();
        callback(credentials);
      });
    }
  });
}

/**
* Execute mongo query and delete a json object
* @param {Number} organisationId - ID of organisation.
* @param {String} collectionName - Name of the collection to query.
* @param {String} query - query to execute.
* @param {String} set - fields to update.
* @return {Object} Promise response.
*/
const deleteObject = (organisationId, collectionName, query = {}, set = {}) => {
  let collectionPromise = collection(organisationId, collectionName);
  return collectionPromise.then(collectionObj => collectionObj.update(query, {
    $unset: set
  }));
}

/**
 * 
 * @param {number} organisationId --Organization ID to get the Organization specific Database url
 * @param {string} filePath 
 * @param {string} filename --filename to save in db
 * @returns  {Object} Promise response.
 */
const fileInsert = (organisationId, filePath, filename) => {
  return connectToOrganisationDb(organisationId)
    .then(connection => {
      const bucket = new mongoDbPlugin.GridFSBucket(connection);
      return fs
        .createReadStream(filePath)
        .pipe(bucket.openUploadStream(filename))
        .on("error", () => { return false })
        .on("finish", () => { return true });
    }).catch(e => { return false });;
};
/**
 * 
 * @param {number} orgID --Organization ID to get the Organization specific Database url
 * @param {string} filename  --filename saved in the DB
 * @returns {Object} Promise response.
 */
const getFile = (organisationId, filename) => {
  return connectToOrganisationDb(organisationId)
    .then(connection => {
      const bucket = new mongoDbPlugin.GridFSBucket(connection);
      return bucket
        .openDownloadStreamByName(filename)
        .on("error", (error) => error)
        .on("finish", data => {
          return data.toString();
        });
    }).catch(error => {
      return error;
    });;
};

/**
 * Execute mongo query and return one object
 * @param {Number} organisationId - ID of organisation.
 * @param {String} collectionName - Name of the collection to insert
 * @param {String} documentData - Docuemnt to create index
 * @return {Object} Promise response.
 */
const createIndex = (organisationId, collectionName, documentData) => {
  const collectionPromise = collection(organisationId, collectionName);
  return collectionPromise.then(collectionObj => collectionObj.createIndex(documentData, { unique: true }));
}

db = {
  open,
  close,
  find,
  findOne,
  count,
  collection,
  insert,
  updateOne,
  updateMany,
  filteredQueryByUserType,
  upsertArray,
  deleteOne,
  convertIdsToMongoIds,
  isMongoId,
  deleteObject,
  fileInsert,
  getFile,
  createIndex
};

module.exports = db;
module.exports.createOrganisationMongoDb = createOrganisationMongoDb;

const _ = require('underscore');
const moment = require('moment');
const MongoObjectId = require('mongodb').ObjectID;
const mongo = require('./mongo');


var validateArrayContents = {};

/**
 * The required fields for a note
 * @type {Array}
 */
var requiredFieldsNotes = [
  'note'
];

/**
 * Constant to use if a required note field is missing
 */
const ERROR_EMPTY_FIELD_NOTES = 'error_empty_field_notes';

/**
 * filters objectToBeFiltered to only contain fields available in allowedFields
 * @param {Object} objectToBeFiltered - object to be Filtered
 * @param {Object} allowedFields - Fields to be retained in arrayToBeFiltered
 * @return {Object} filteredObj - Filtered object containing only allowed Fields
 */
function filterFieldsFromObject(objectToBeFiltered, allowedFields) {
  var filteredObj = {};

  _.map(objectToBeFiltered, (value, param) => {
    if (_.include(allowedFields, param)) {
      filteredObj[param] = objectToBeFiltered[param];
    }
  });
  return filteredObj;
}

/**
 * converts milliseconds to ISO String
 * @param {String} timeInMillis - time in millis to be converted
 * @return {String}  time string in ISO format
 */
function convertMillisecondsToISOString(timeInMillis) {
  return moment.unix(timeInMillis / 1000).toISOString();
}

/**
 * Checks if items in arrayToBeVerified exist in referenceArray
 * @param {Object} arrayToBeVerified - array to be verified
 * @param {Object} referenceArray - reference array to check
 * @return {json} return true if all items in arrayToBeVerified
 * exist in referenceArray false otherwise
 */
validateArrayContents = function (arrayToBeVerified, referenceArray) {
  var isValid = true;
  _.each(arrayToBeVerified, function (group) {
    if (!(group in referenceArray)) {
      isValid = false;
    }
  });
  return isValid;
};

/**
 * Takes a string and turns it into a slug for use in a URL
 * @param {String} text - Text to turn into a slug
 * @param {String} separator - The string used to separate words (replace spaces)
 * @return {String} - The slug
 */
function slugify(text, separator = '-') {
  return text.toString().toLowerCase()
    .replace(new RegExp('\\s+', 'g'), separator) // Replace spaces with -
    .replace(new RegExp('[^\\w\\' + separator + ']+', 'g'), '') // Remove all non-word chars
    .replace(new RegExp('\\' + separator + '\\' + separator + '+', 'g'), separator) // Replace multiple - with single -
    .replace(new RegExp('^' + separator + '+'), '') // Trim - from start of text
    .replace(new RegExp('' + separator + '+$'), ''); // Trim - from end of text
}

/**
 * Checks if referenceObj contains atleast one attribute of targetObj
 * @param {Object} referenceObj - referenceObj to compare
 * @param {Object} targetObj - targetObj
 * @return {Boolean} - returns true if atleast one attribute matches, false otherwise
 */
function doObjectFieldsOverlap(referenceObj, targetObj) {
  var found = false;
  _.each(targetObj, (value, key) => {
    if (referenceObj.includes(key)) {
      found = true;
    }
  });
  return found;
}

/**
 * Checks if target Object contains all properties mentioned in referenceObj
 * @param {Array} compulsoryFields - referenceArray to compare
 * @param {Object} objectToCheck - Target Object to check
 * @return {Boolean} - returns true if objectToCheck contains all properties defined in
 *  compulsoryFields
 */
function doFieldsExist(compulsoryFields, objectToCheck) {
  var found = true;
  _.each(compulsoryFields, (key) => {
    if (!Object.prototype.hasOwnProperty.call(objectToCheck, key)) {
      found = false;
    }
  });
  return found;
}
/**
  * add notes to the specific vulnerability object in mongo
  * @param {String} organisationId - Organisation ID
  * @param {String} collectionName - name of mongo collection to update
  * @param {Object} queryParams - criteria for adding notes to vulnerability
  * @param {Object} fieldsToSet - notes object to be added inside vulnerability
  * @return {Object} - Error on failure or Promise object of vulnerability on success
  */
function addNotes(organisationId, collectionName,
  queryParams, fieldsToSet) {
  fieldsToSet.notes.id = new MongoObjectId();
  fieldsToSet.notes.created_at = moment().toISOString();
  const isNotesObjectValid = doFieldsExist(requiredFieldsNotes, fieldsToSet.notes);
  if (isNotesObjectValid) {
    return mongo.upsertArray(organisationId, collectionName,
      queryParams, fieldsToSet);
  }
  /* eslint new-cap: ["error", { "newIsCap": false }]*/
  return new Promise.resolve(ERROR_EMPTY_FIELD_NOTES);
}

/**
  * update note for the specific noteId
  * @param {String} organisationId - Organisation ID
  * @param {String} collectionName - name of mongo collection to update
  * @param {Object} queryParams - selection criteria for updating note object for given noteId
  * @param {Object} fieldsToSet - notes object with updated note for given noteId
  * @return {Object} - Error on failure or Promise object of vulnerability on success
  */
function updateNote(organisationId, collectionName,
  queryParams, fieldsToSet) {
  const isNotesObjectValid = doFieldsExist(requiredFieldsNotes, fieldsToSet.notes);

  if (isNotesObjectValid) {
    return mongo.updateOne(organisationId, collectionName,
      queryParams, { 'notes.$.note': fieldsToSet.notes.note,
        'notes.$.updated_at': moment().toISOString(),
        'notes.$.updated_by': fieldsToSet.notes.updated_by });
  }
  /* eslint new-cap: ["error", { "newIsCap": false }]*/
  return new Promise.resolve(ERROR_EMPTY_FIELD_NOTES);
}

/**
  * delete note for the specific noteId
  * @param {String} organisationId - Organisation ID
  * @param {String} noteId - Note ID
  * @param {String} collectionName - name of mongo collection to update
  * @param {Object} queryParams - selection criteria for updating note object for given noteId
  * @return {Object} - Error on failure or Promise object of vulnerability on success
  */
function deleteNote(organisationId, noteId, collectionName,
  queryParams) {
  return mongo.deleteOne(organisationId, collectionName,
    queryParams, { notes: { id: new MongoObjectId(noteId) } });
}

module.exports = {
  filterFieldsFromObject,
  convertMillisecondsToISOString,
  slugify,
  validateArrayContents,
  doObjectFieldsOverlap,
  doFieldsExist,
  addNotes,
  updateNote,
  deleteNote,
  ERROR_EMPTY_FIELD_NOTES
};

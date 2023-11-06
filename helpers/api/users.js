var userModel = require('../../models/user');
var _ = require('lodash');

/**
 * Fillout each element of array with user info
 * @param {Array} objects - Array of objects to fill-in user info.
 * @return {Array} objects - Updated Objects with user information.
 */
var filloutObjectsWithUserInfo = function (objects) {
  var userIds = [];

  var userObject;
  var userId;
  var userFields = {
    'requested_by': { 'destination_field': 'requested_by_user_info' }
    , 'updated_by': { 'destination_field': 'updated_by_user_info' }
    , 'created_by': { 'destination_field': 'created_by_user_info' }
  };

  _.each(objects, function (object) {

    _.each(userFields, function (fieldValue, fieldName) {

      if (object[fieldName]) {
        userIds.push(object[fieldName]);
      }
    });
  });
  _.uniq(userIds);

  // Pick user info for all users from database
  return userModel.getUsersByIDs(userIds).then(function (users) {

    // loop through each  tem & add user info to it
    _.each(objects, function (object) {

      _.each(userFields, function (fieldValue, fieldName) {
        if (object[fieldName]) {
          // Populate user info object for given field type user field
          userId = object[fieldName];

          userObject = _.find(users, { id: userId });

          object[fieldValue.destination_field] = userObject;
        }
      });

    });

    return objects;
  });
};

module.exports = {
  filloutObjectsWithUserInfo,
};

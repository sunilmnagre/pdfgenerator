const models = require('../db_models');
const Sequelize = require('sequelize');

// Array of fields to be mapped when responding to an API
const mapApi = {
  id: 'id',
  user_type: 'user_type',
  first_name: 'first_name',
  last_name: 'last_name',
  username: 'username',
  email: 'email',
  organizations: 'organizations'
};

/**
 * Get User by userId.
 * @param {number} id - ID & username of the user
 * @return {object} result - user info for given user ID
 */
var getUserById = function (id) {
  var args = {
    attributes: ['id', 'username', 'user_type', 'first_name', 'last_name'],
    where: { id },
    raw: true
  };

  return models.User.findOne(args).then(function (result) {
    return result;
  });
};

/**
 * Get Users by userIds.
 * @param {number} ids - IDs & usernames of the users
 * @return {object} result - user info for all userIDs
 */
var getUsersByIDs = function (ids) {
  var args = {
    attributes: ['id', 'username', 'user_type', 'first_name', 'last_name'],
    where: { id: { [Sequelize.Op.in]: ids } },
    raw: true
  };

  return models.User.findAll(args).then(function (result) {
    return result;
  });
};

module.exports = {
  getUserById,
  getUsersByIDs
};

module.exports.mapApi = mapApi;

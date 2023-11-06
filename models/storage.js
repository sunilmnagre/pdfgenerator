var models = require('../db_models'),
	config = require('config')

/**
 * Creates Organization Model for Business Logic.
 */
var storage = function() {
	/**
	 * Sets a storage item given the key and data to store
	 * @param {String} key - The key to save in the database against. This is lowercased before saving
	 * @param {Mixed} data - Data to save against the key
	 */
	this.set = function(key, data) {

		// Check if this storage key already exists. If so, update.
		return this.get(key).then(function(result) {

			// It doesn't exist, add it
			if (result === null) {
				models.Storage.create({
					storage_name: key.toLowerCase(),
					storage_value: data
				}).then(function() {
					return true
				}, function() {
					return false
				});
			} else {
				// It does exist, update the value
				result.update({
					storage_value: data
				}).then(function() {
					return true
				}, function() {
					return false
				});
			}
		}, function() {
			return false
		})
	}

	/**
	 * Gets a storage value given the key
	 * @param {String} key - The key to search against in the storage table
	 * @return {Mixed} - The value stored in the table or null if one doesn't exist
	 */
	this.get = function(key) {
		return models.Storage.findOne({
			attributes: ['id', 'storage_value'],
			where: { storage_name: key.toLowerCase() }
		});
	}

	return this;
}

module.exports = {
	storage: storage,
}

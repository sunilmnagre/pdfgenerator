var mongo = require('../helpers/mongo'),
	config = require('config');
/**
 * Fetch the Location for provided IP address.
 * @param {Number} organisationId - Unique ID of the organisation.
 * @param {String} ipAddress - searchable IP Address.
 * @return {Promse} - Promise of the Mongo query
 */
function getNameByIp(organisationId, ipAddress) {

	queryPromise = mongo.findOne(organisationId, config.mongo.tables.geoLocation, {
		target: ipAddress
	})

	return queryPromise
}

let location = {
	getNameByIP: getNameByIp
}

module.exports = location;

/**
 * Creates a response array for the Api
 *
 * @param {Object} responseObject - Express response object
 * @param {Boolean} successful - Set to true if the response was a success
 * @param {Array} data - Array of data to return. Isn't used if successful is false
 * @param {Number} response_code - The response code for the call, defaults to 200
 * @param {String} message - The message to send back to the API, human readable
 * @returns {Object} - API response object
 */
var getApiResponse = function(responseObject, successful = true, data = {}, response_code = 200, message = '') {
	this.responseObject = responseObject;
	this.successful = successful;
	this.response_code = response_code;
	this.message = message;
	this.data = data;

	/**
	 * Actually responds with the array to be sent back
	 */
	this.respond = function() {

		if (this.successful) {
			response_data = {
				successful: true,
				message: this.message,
				data: this.data
			}
		} else {
			response_data = {
				successful: false,
				message: this.message,
				data: this.data
			}
		}

		this.responseObject.status(this.response_code)
		this.responseObject.send(response_data)
	}

	return this;
}

module.exports = {
	apiResponse: getApiResponse
}

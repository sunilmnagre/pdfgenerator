const pify = require('pify');
const tenableHelper = require('../helpers/tenable');
const constantErrors = require('../helpers/constant-errors');

//Pify request
const pifyRequest = async (organisationId, endpoint, method, queryArray = {}, requestBody = {}) => {
    const pRequest = pify(tenableHelper, { errorFirst: false, multiArgs: true });
    const [error, result] = await pRequest.requestTenable(organisationId, endpoint, queryArray, method, requestBody);
    let customError = {
        message: constantErrors.tenable.failed
    };
    if (error) {
        if (typeof error === 'object' && error.error_msg) {
            customError.message = error.error_msg;
        } else {
            customError.message = error;
        }
        throw customError;
    }
    return result;
}

module.exports = {
    pifyRequest
};
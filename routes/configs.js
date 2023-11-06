const express = require('express');
const router = express.Router();
const { getConfigurations } = require('../models/configs');

/**
 * 
 * @param {*} request 
 * @param {*} response 
 */
const sync = async (request, response) => {
  const { service_id, sync } = request.query || {};
  const configs = await getConfigurations(service_id, sync, request.headers);
  if (configs && configs.length) {
    return response.jsend.success({ message: 'The VM configs are successfully synced' });
  } else {
    return response.jsend.fail({ message: configs && configs.message ? configs.message : 'The VM configs are not synced' })
  }
}



router.patch('/sync', sync);
module.exports = router;
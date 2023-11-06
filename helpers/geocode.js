//const redis = require('redis');
const NodeGeocoder = require('node-geocoder');
const config = require('config');
const _ = require('lodash');
//const bluebird = require('bluebird');

//bluebird.promisifyAll(redis.RedisClient.prototype);
//bluebird.promisifyAll(redis.Multi.prototype);

const redisClient = require('../models/redis-cache');

const saveGeocode = function (location, geocodeObj) {
  const geocodeObjJSON = JSON.stringify(geocodeObj);
  redisClient.hsetAsync('geolocations', location, geocodeObjJSON);
};

const geocodeWithService = function (location) {
  const geocoder = NodeGeocoder();
  return geocoder.geocode(location)
    .then(function (result) {
      const obj = _.pick(result[0], [ 'city','latitude', 'longitude', 'countryCode', 'country', 'formattedAddress']);
      // obj = result[0]
      saveGeocode(location, obj);
      return obj;
    });
};

const geocode = function (location) {
  return redisClient.hgetAsync('geolocations', location)
    .then(function (response) {
      if (response === null || response === '{}') {
        return geocodeWithService(location);
      }

      return JSON.parse(response);
    });
};

const reverseGeoCode = function (lat, long) {
  const geocoder = NodeGeocoder(config.get('geocode'));

  return geocoder.reverse({ lat, lon: long })
    .then(function (res) {
      res[0].latitude = lat;
      res[0].longitude = long;
      return res[0];
    })
    .catch(function (err) {
      console.log(err);
      return null;
    });
};


module.exports = {
  geocode,
  reverseGeoCode,
};

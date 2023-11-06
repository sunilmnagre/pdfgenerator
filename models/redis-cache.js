const models = require('../db_models');

/**
 * Find and return redis_cache object
 * @param {String} cacheKey - Key of the redis_cache object to be searched
 * @returns {Object} redis_cache object
 */
const find = async (cacheKey) => {
  try {
    const args = { where: { cache_key: cacheKey }, raw: true };
    return await models.RedisCache.findOne(args);
  } catch (error) {
    return null;
  }
};

/**
 * Fetch redis_cache object
 * @param {String} cacheKey - Key of the redis_cache object to be searched
 * @param {Function} callback - Function to be called on success or error calls
 */
const get = async (cacheKey, callback) => {
  try {
    const redisCache = await find(cacheKey);
    let cacheValue = redisCache && redisCache.cache_value ? redisCache.cache_value : '';
    try {
      cacheValue = JSON.parse(cacheValue);
    } catch (error) {
      // Do nothing.
    }

    callback(null, cacheValue);
  } catch (error) {
    callback(error);
  }
};

/**
 * Save redis_cache object in database
 * @param {String} cacheKey - Key of the redis_cache object
 * @param {Object} cacheValue - Value of the redis_cache object
 */
const set = async (cacheKey, cacheValue, ttl = null) => {
  if(ttl) {
    const minutes = Math.floor(ttl / 60);     
    ttl = new Date().setMinutes(new Date().getMinutes() + minutes);
  } else {
    ttl = new Date().setDate(new Date().getDate() + 1);
  }
  try {    
    const redisCache = await find(cacheKey);
    const cacheObject = {
      cache_key: cacheKey,
      cache_value: cacheValue,
      modified_at: new Date(),
      ttl: ttl
    };

    if (redisCache && redisCache.id) {
      await models.RedisCache.update(cacheObject, { where: { id: redisCache.id } });
    } else {
      await models.RedisCache.create(cacheObject);
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Delete redis_cache record from database
 * @param {String} cacheKey - Key of the redis_cache object to be deleted
 * @returns {Object} response from delete operation
 */
const del = async (cacheKey) => {
  try {
    const args = { where: { cache_key: cacheKey } };
    return await models.RedisCache.destroy(args);
  } catch (error) {
    return null;
  }
};

module.exports = {
  get,
  set,
  del
};

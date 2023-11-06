const config = require('config');
const redisClient = require('../models/redis-cache');

// Function will return key
const getCacheKey = (request) => {
    // Get Access token
    const user = request && request.decoded && request.decoded.username ? request.decoded.username : 'ericsson';
    let key = user + '-' + request.originalUrl;
    return key;
}

const _get = (request, response, next) => {
    // Default cache flag is set true
    let cacheFlag = config.cache.enable;

    // Check if the query paramter has cache flag
    if (request.hasOwnProperty('query') && request.query.hasOwnProperty('cache')) {
        cacheFlag = parseInt(request.query.cache);
    }

    // Get unique key for each endpoint
    const key = getCacheKey(request);

    // Get cached data from Redis
    if (cacheFlag === true) {
        redisClient.get(key, (error, cachedData) => {
            if (error) {
                return next();
            } else {
                if (cachedData) {
                    console.log('Cache data');
                    try {
                        cachedData = JSON.parse(cachedData);
                    } catch (error) {
                        //Do nothing
                    }
                    return response.jsend.success(cachedData);
                } else {
                    console.log('Set data');
                    let oldSend = response.send;
                    response.send = (data) => {
                        let resData = JSON.parse(data);
                        if (resData && resData.status == 'success' && resData.data) {
                            _set(request, resData.data);
                            response.send = oldSend;
                            return response.send(data);
                        }
                    }
                    next();
                }
            }
        });
    } else {
        next();
    }
};

// Set the data Redis as a Cached data
const _set = (request, data) => {

    try {
        // Get unique key for each endpoint
        const key = getCacheKey(request);
        let expiry = config.cache.ttl;
        //redisClient.set(key, JSON.stringify(data), 'EX', expiry);
        redisClient.set(key, JSON.stringify(data), expiry);
    } catch (error) {
        // Do nothing
    }
};

module.exports = {
    _get,
    _set
}

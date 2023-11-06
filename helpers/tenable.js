const request = require('request');
const config = require('config');
const redisClient = require('../models/redis-cache');;
const _ = require('lodash');
const servicesHelper = require('../helpers/services');
const constantErrors = require('../helpers/constant-errors');
const moment = require('moment');
const cryptography = require('./cryptography');
const organizationModel = require('../models/organization');

const TOKEN_PREFIX = 'Tenable_Token_';
const ADMIN_TOKEN_PREFIX = 'Tenable_Token_Admin';
const LAUNCH_DURATION_ONETIME = 'ad-hoc';
const LAUNCH_DURATION_DAILY = 'daily';
const LAUNCH_DURATION_WEEKLY = 'weekly';
const LAUNCH_DURATION_MONTHLY = 'monthly';
const LAUNCH_DURATION_QUARTERLY = 'quarterly';
const LAUNCH_DURATION_SEMI_ANNUAL = 'semi-annual';
const LAUNCH_DURATION_ANNUAL = 'annual';
const TENABLE_SCHEDULE_FREQ_ONETIME = '';
const TENABLE_SCHEDULE_FREQ_DAILY = 'DAILY';
const TENABLE_SCHEDULE_FREQ_WEEKLY = 'WEEKLY';
const TENABLE_SCHEDULE_FREQ_MONTHLY = 'MONTHLY';
const TENABLE_SCHEDULE_INTERVAL_MONTHLY = 1;
const TENABLE_SCHEDULE_INTERVAL_QUARTERLY = 3;
const TENABLE_SCHEDULE_INTERVAL_SEMI_ANNUAL = 6;
const TENABLE_SCHEDULE_INTERVAL_ANNUAL = 12;
const LAUNCH_FREQUENCY_ANNUAL = 'FREQ=MONTHLY;INTERVAL=12';
const LAUNCH_FREQUENCY_INTERVAL_ONE = 'INTERVAL=1';
const TENABLE_MONTH_BY_PREFIX = 'BYMONTHDAY=';
const TENABLE_DAY_BY_PREFIX = 'BYDAY=';
const TENABLE_WEEK_DAYS = {
    [0]: 'SU',
    [1]: 'MO',
    [2]: 'TU',
    [3]: 'WE',
    [4]: 'TH',
    [5]: 'FR',
    [6]: 'SA'
};

const TENABLE_LOGIN_ERROR_CODE = 12;
const TENABLE_LOGIN_ERROR_MESSAGE = 'This request contains an invalid token.';

/**
 *  Default token expire time is 57 Minutes
 * @param tokenKey
 * @param tokenValue
 * @param sessionTimeout
 */
const setToken = (tokenKey, tokenValue, sessionTimeout = 3600) => {
    // setting the token expire  time for both Security Manager and Admin
    //  time in seconds
    const sessionTimeoutValue = Number(sessionTimeout);
    if (sessionTimeoutValue && sessionTimeoutValue > 0) {
        // Sub tract 5% of  Tenable income sessionValue
        const sessionSubTraction = Math.round(sessionTimeoutValue * (5 / 100));
        const timeOut = sessionTimeoutValue - sessionSubTraction;
        //redisClient.set(tokenKey, JSON.stringify(tokenValue), 'EX', timeOut);
        redisClient.set(tokenKey, JSON.stringify(tokenValue), timeOut);
    }
};


/**
 *
 * @param tokenInfo
 * @returns {request.Request}
 */
const getLoginSessionTimeout = (tokenInfo) => {

    const tenable = JSON.parse(process.env.tenable);

    return new Promise((resolve, reject) => {
        const requestOptions = {
            url: tenable.baseURL + 'configSection',
            method: 'GET',
            headers: {
                'X-SecurityCenter': tokenInfo.token,
                cookie: getCookieFromRequest(tokenInfo.cookies)
            },
            json: true, insecure: true, proxy: ''
        };

        request(requestOptions, (error, response, body) => {
            if (error) {
                reject(error);
            } else if (response.statusCode !== 200) {
                reject('Invalid login credentials ' + response.statusCode);
            } else {

                const securityConfigSection = body.response.find((config) => {
                    if (config !== null && config.hasOwnProperty('name')) {
                        return config.name === 'Security';
                    }
                    return false;
                });
                if (securityConfigSection && securityConfigSection.id) {
                    requestOptions.url = requestOptions.url + '/' + securityConfigSection.id;
                    request(requestOptions, (error, response, body) => {
                        if (error) {
                            reject(error);
                        } else if (response.statusCode !== 200) {
                            reject('Invalid login credentials ' + response.statusCode);
                        } else {
                            resolve(body.response.LoginSessionTimeout);
                        }
                    });
                } else {
                    reject('Error retrieving the Tenable configSection Id');
                }
            }
        });
    });
};


const getCookieFromRequest = (cookies) => {
    // As per the clarification got from the tenable community responses, we should set the cookie that we are getting as the second one from the request header from tenable. For more refer to: https://community.tenable.com/s/question/0D5f200004rM0ImCAK/unable-to-talk-to-api
    let cookieString = cookies && cookies[1] ? cookies[1].split(';')[0] : '';

    return cookieString;
};

const generateToken = async (organizationId, tokenKey, callback) => {
    const supportedTypes = await servicesHelper.getServicesSlugs(true);
    const tenable = JSON.parse(process.env.tenable);
    if (supportedTypes && supportedTypes.VM && supportedTypes.VM.short) {
        organizationModel.organization().getServiceCredentialData(organizationId, supportedTypes.VM.short).then(tenableCredentials => {
            if (tenableCredentials && tenableCredentials.tenable) {
                const options = {
                    url: tenable.baseURL + 'token',
                    method: 'POST',
                    body: {
                        username: tenableCredentials.tenable.username,
                        password: cryptography.decrypt(tenableCredentials.tenable.password),
                        releaseSession: tenable.releaseSession
                    },
                    json: true,
                    insecure: true,
                    proxy: ""
                };

                return request(options, (error, response) => {
                    if (error) {
                        return callback(error);
                    } else if (response.statusCode !== 200) {
                        redisClient.del(tokenKey);
                        return callback(constantErrors.tenable.invalidLogin + ': ' + response.statusCode);
                    } else {
                        const tenableSession = {
                            token: response.body.response.token,
                            cookies: response.headers['set-cookie']
                        };

                        return getAdminToken((error, tokenObject) => {
                            if (error) {
                                return callback(error);
                            } else {

                                return getLoginSessionTimeout(tokenObject).then(timeout => {
                                    // Set token to memory
                                    setToken(tokenKey, tenableSession, timeout);
                                    return callback(null, tenableSession);
                                }).catch(error => {
                                    return callback(error);
                                });
                            }
                        });
                    }
                });
            } else {
                return callback('Error getting Tenable credentials');
            }
        }).catch((dbError) => {
            return callback('Failed to get organisation credentials due to: ' + dbError);
        });
    } else {
        return callback(constantErrors.organizationService.supportedTypesNotAvailable);
    }
};

const getLoginToken = (organizationId, callback) => {
    const tokenKey = TOKEN_PREFIX + organizationId;
    // Get token from memory
    redisClient.get(tokenKey, (error, token) => {
        if (error) {
            return callback(error);
        } else if (token) {
            try {
                token = JSON.parse(token);
            } catch (error) {
                // Do nothing
            }

            return callback(null, token);
        } else {
            return generateToken(organizationId, tokenKey, (error, generatedToken) => {
                if (generatedToken) {
                    return callback(null, generatedToken);
                } else {
                    return callback(error);
                }
            });
        }
    });
};

/**
 * Call Tenable API's using organization credentials
 */
const requestTenable = (organizationId, endpoint, queryArray = {}, methodType = 'GET', requestBody, callback) => {
    return getLoginToken(organizationId, (error, tokenObject) => {
        const tenable = JSON.parse(process.env.tenable);
        if (error) {
            return callback(error);
        } else {
            const requestObject = {
                url: tenable.baseURL + endpoint,
                method: methodType,
                headers: {
                    'X-SecurityCenter': tokenObject.token,
                    cookie: getCookieFromRequest(tokenObject.cookies)
                },
                qs: queryArray,
                json: true, insecure: true, proxy: ""
            };

            if (requestBody) {
                _.extend(requestObject, { body: requestBody, json: true });
            }

            if (endpoint == 'file/upload' && methodType == 'POST') {
                delete requestObject.qs;
                requestObject.formData = queryArray;
            }

            return request(requestObject, (error, response, body) => {
                if (error) {
                    return callback(error);
                } else if (response.statusCode !== 200) {
                    let errorMessage = `${response.statusCode} - Tenable operation has been failed`;
                    if (response && response.body && response.body.error_msg) {
                        errorMessage = `${response.statusCode} - ${response.body.error_msg}`;
                    }

                    console.error(errorMessage);
                    if (response && response.body && response.body.error_code && response.body.error_msg && response.body.error_code === TENABLE_LOGIN_ERROR_CODE && response.body.error_msg && response.body.error_msg === TENABLE_LOGIN_ERROR_MESSAGE) {
                        redisClient.del(TOKEN_PREFIX + organizationId);
                    }
                    return callback(body);
                } else {
                    return callback(null, body);
                }
            });
        }
    });
};

const getAdminToken = (callback) => {
    // Get token from memory
    redisClient.get(ADMIN_TOKEN_PREFIX, (error, token) => {
        const tenable = JSON.parse(process.env.tenable);
        if (error) {
            return callback(error);
        } else if (token) {
            return callback(null, token);
        } else {
            const options = {
                url: tenable.baseURL + 'token',
                method: 'POST',
                body: {
                    username: tenable.username,
                    password: tenable['$ECURE-password'],
                    releaseSession: tenable.releaseSession
                },
                json: true, insecure: true, proxy: ""
            };

            return request(options, (error, response) => {
                if (error) {
                    return callback(error);
                } else if (response.statusCode !== 200) {

                    if (response && response.body && response.body.error_code && response.body.error_msg && response.body.error_code === TENABLE_LOGIN_ERROR_CODE && response.body.error_msg && response.body.error_msg === TENABLE_LOGIN_ERROR_MESSAGE) {
                        redisClient.del(ADMIN_TOKEN_PREFIX);
                    }
                    return callback(constantErrors.tenable.invalidLogin + ': ' + response.statusCode);
                } else {
                    const tenableSession = {
                        token: response.body.response.token,
                        cookies: response.headers['set-cookie']
                    };

                    return getLoginSessionTimeout(tenableSession).then(timeout => {
                        // Set token to memory
                        setToken(ADMIN_TOKEN_PREFIX, tenableSession, timeout);
                        return callback(null, tenableSession);
                    }).catch(error => {
                        return callback(error);
                    });
                }
            });
        }
    });
};

/**
 * Call Tenable API's using admin credentials
 */
const requestTenableAsAdmin = (endpoint, queryArray = {}, methodType = 'GET', requestBody, callback) => {
    return getAdminToken((error, tokenObject) => {
        const tenable = JSON.parse(process.env.tenable);
        if (error) {
            return callback(error);
        } else {
            const requestObject = {
                url: tenable.baseURL + endpoint,
                method: methodType,
                headers: {
                    'X-SecurityCenter': tokenObject.token,
                    cookie: getCookieFromRequest(tokenObject.cookies)
                },
                qs: queryArray,
                json: true, insecure: true, proxy: ""
            };

            if (requestBody) {
                _.extend(requestObject, { body: requestBody, json: true });
            }

            return request(requestObject, (error, response, body) => {
                if (error) {
                    return callback(error);
                } else if (response.statusCode !== 200) {
                    console.log('---- Failed to connect to Tenable, statusCode: ' + response.statusCode + '----');
                    if (response && response.body && response.body.error_code && response.body.error_msg && response.body.error_code === TENABLE_LOGIN_ERROR_CODE && response.body.error_msg && response.body.error_msg === TENABLE_LOGIN_ERROR_MESSAGE) {
                        redisClient.del(ADMIN_TOKEN_PREFIX);
                    }
                    return callback(body);
                } else {
                    return callback(null, body);
                }
            });
        }
    });
};

/**
 * Function will return formatted schedule data for scan and that will store into database
 * @param {Object} scanInfo - Object contains data of scan
 * @return {Object} scan schedule
 */
const tenableToMSSPParams = (scanInfo) => {
    let scanScheduleInfo = {};
    // splitting rrule string and making an object to process
    let scheduleResult = {};
    let scanSchedule = {};
    if (scanInfo.start && scanInfo.start.indexOf(':') > -1) {

        if (scanInfo.repeatRule === TENABLE_SCHEDULE_FREQ_ONETIME) {
            scanScheduleInfo.frequency = 'ad-hoc';
        }
        scanInfo.repeatRule.split(';').forEach(function (stringArray) {
            let elementArray = stringArray.split('=');
            elementArray[1] && (scheduleResult[elementArray[0]] = elementArray[1]);
        });
        let [date, hour, minute] = '';
        // start: 'TZID=Asia/Kolkata:20200529T043000'
        scanInfo.start.split(':').forEach(function (stringArray) {
            let elementArray = stringArray.split('=');
            elementArray[1] && (scanSchedule[elementArray[0]] = elementArray[1]);
            if (elementArray.length === 1) {
                scanSchedule.time = elementArray[0];
            }
        });

        if (scanSchedule.time) {
            let utcDate = moment.tz(scanSchedule.time, scanSchedule.TZID).utc();
            date = scanSchedule.time.slice(0, 4) + '-' + scanSchedule.time.slice(4, 6) +
                '-' + scanSchedule.time.slice(6, 8); // get date
            hour = scanSchedule.time.slice(9, 11); // get hours
            minute = scanSchedule.time.slice(11, 13); // get minutes
            scanScheduleInfo.timezone = scanSchedule.TZID;
            scanScheduleInfo.start_time = utcDate ? utcDate.valueOf() : null;
            scanScheduleInfo.start_time_utc = utcDate ? utcDate.format() : null;
            scanScheduleInfo.start_schedule_time = scanSchedule.time
        }
        const FREQ = scheduleResult.FREQ;
        const INTERVAL = parseInt(scheduleResult.INTERVAL)
        // checking values with defined variables and returning the scan type
        if (FREQ === TENABLE_SCHEDULE_FREQ_MONTHLY && INTERVAL === TENABLE_SCHEDULE_INTERVAL_QUARTERLY) {
            scanScheduleInfo.frequency = LAUNCH_DURATION_QUARTERLY;
        } else if (FREQ === TENABLE_SCHEDULE_FREQ_MONTHLY && INTERVAL === TENABLE_SCHEDULE_INTERVAL_MONTHLY) {
            scanScheduleInfo.frequency = LAUNCH_DURATION_MONTHLY;
        } else if (FREQ === TENABLE_SCHEDULE_FREQ_MONTHLY && INTERVAL === TENABLE_SCHEDULE_INTERVAL_SEMI_ANNUAL) {
            scanScheduleInfo.frequency = LAUNCH_DURATION_SEMI_ANNUAL;
        } else if (FREQ === TENABLE_SCHEDULE_FREQ_MONTHLY && INTERVAL === TENABLE_SCHEDULE_INTERVAL_ANNUAL) {
            scanScheduleInfo.frequency = LAUNCH_DURATION_ANNUAL;
        } else if (FREQ === TENABLE_SCHEDULE_FREQ_DAILY) {
            scanScheduleInfo.frequency = LAUNCH_DURATION_DAILY;
            scanScheduleInfo.interval = INTERVAL
        } else if (FREQ === TENABLE_SCHEDULE_FREQ_WEEKLY) {
            scanScheduleInfo.frequency = LAUNCH_DURATION_WEEKLY;
            scanScheduleInfo.interval = INTERVAL
            scanScheduleInfo.week_day = scheduleResult.BYDAY
        }
        return scanScheduleInfo;
    } else if (scanInfo.start == TENABLE_SCHEDULE_FREQ_ONETIME) {
        if (scanInfo.repeatRule === TENABLE_SCHEDULE_FREQ_ONETIME) {
            scanScheduleInfo.frequency = 'ad-hoc';
        }
        return scanScheduleInfo;
    } else {
        return null;
    }
};

/**
 * Function will return formatted schedule data for scan and that will store into database
 * @param {Object} scanInfo - Object contains data of scan
 * @return {Object} scan schedule
 */
const getScanScheduleInfoFormatted = (scanInfo) => {
    // if repeatRule are blank then return with null
    if (scanInfo.repeatRule === TENABLE_SCHEDULE_FREQ_ONETIME) {
        return LAUNCH_DURATION_ONETIME;
    } else if (scanInfo.repeatRule && scanInfo.repeatRule.indexOf(';') > -1) {

        // splitting rrule string and making an object to process
        let scheduleResult = {};
        scanInfo.repeatRule.split(';').forEach(function (stringArray) {
            let elementArray = stringArray.split('=');
            elementArray[1] && (scheduleResult[elementArray[0]] = elementArray[1]);
        });

        // checking values with defined variables and returning the scan type

        if (scheduleResult.FREQ == TENABLE_SCHEDULE_FREQ_MONTHLY && scheduleResult.INTERVAL == TENABLE_SCHEDULE_INTERVAL_QUARTERLY) {
            return LAUNCH_DURATION_QUARTERLY;
        } else if (scheduleResult.FREQ == TENABLE_SCHEDULE_FREQ_MONTHLY && scheduleResult.INTERVAL == TENABLE_SCHEDULE_INTERVAL_MONTHLY) {
            return LAUNCH_DURATION_MONTHLY;
        } else if (scheduleResult.FREQ == TENABLE_SCHEDULE_FREQ_MONTHLY && scheduleResult.INTERVAL == TENABLE_SCHEDULE_INTERVAL_SEMI_ANNUAL) {
            return LAUNCH_DURATION_SEMI_ANNUAL;
        } else if (scheduleResult.FREQ == TENABLE_SCHEDULE_FREQ_MONTHLY && scheduleResult.INTERVAL == TENABLE_SCHEDULE_INTERVAL_ANNUAL) {
            return LAUNCH_DURATION_ANNUAL;
        } else if (scheduleResult.FREQ == TENABLE_SCHEDULE_FREQ_DAILY) {
            return LAUNCH_DURATION_DAILY;
        } else if (scheduleResult.FREQ == TENABLE_SCHEDULE_FREQ_WEEKLY) {
            return LAUNCH_DURATION_WEEKLY;
        }
    } else {
        return null;
    }
    return resolve(body);
};

module.exports = {
    requestTenable,
    requestTenableAsAdmin,
    getScanScheduleInfoFormatted,
    tenableToMSSPParams,
    LAUNCH_DURATION_ONETIME,
    LAUNCH_DURATION_DAILY,
    LAUNCH_DURATION_WEEKLY,
    LAUNCH_DURATION_MONTHLY,
    LAUNCH_DURATION_QUARTERLY,
    LAUNCH_DURATION_SEMI_ANNUAL,
    LAUNCH_DURATION_ANNUAL,
    LAUNCH_FREQUENCY_ANNUAL,
    LAUNCH_FREQUENCY_INTERVAL_ONE,
    TENABLE_MONTH_BY_PREFIX,
    TENABLE_DAY_BY_PREFIX,
    TENABLE_WEEK_DAYS
};

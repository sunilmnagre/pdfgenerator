var express = require('express');
var cityModel = require('../models/city');
var router = express.Router();
var mapperHelper = require('../helpers/db/mapper');
var apiParametersHelper = require('../helpers/api/parameters');
var dbPaginationHelper = require('../helpers/db/pagination');
const gecoder = require('../helpers/geocode');
const Sequelize = require('sequelize');

// Remove special char from the array of string
const removeSpclCharArrString = (cityArray) => {
    cityArray.forEach(element => {
        element.name = element.name.replace(/[^a-zA-Z0-9\s]/g, "");
    });
    return cityArray;
};

/**
 * @api {get} /api/v1/locations/cities?name=duba List of cities
 * @apiVersion 1.0.0
 * @apiName GetListOfCities
 * @apiGroup Locations
 * 
 * @apiParam (Query) {String} [name] Search by city name using SQL `like` command. `%` characters are automatically added to either side of the string
 * @apiParam (Query) {Number} [page] The page number if using pagination
 * @apiParam (Query) {Number} [limit] Number of items to return (defaults to 20)
 * 
 * @apiSuccess {Object} cities Array of city objects
 * @apiSuccessExample {json} Cities response:
 *     {
  "status": "success",
  "data": {
    "cities": [
      {
        "id": 12,
        "name": "Dubai",
        "country_code": "AE",
        "latitude": 25.0657,
        "longitude": 55.17128,
        "timezone": "Asia/Dubai"
      },
      {
        "id": 32305,
        "name": "Duba-Yurt",
        "country_code": "RU",
        "latitude": 43.03534,
        "longitude": 45.73046,
        "timezone": "Europe/Moscow"
      },
      {
        "id": 33422,
        "name": "Duba",
        "country_code": "SA",
        "latitude": 27.35134,
        "longitude": 35.69014,
        "timezone": "Asia/Riyadh"
      }
    ]
  }
}
 */

/**
 * Exposes a list of cities (searchable) for the API
 * 
 * @author Dan Kennedy (dan.kennedy@screeninteraction.com)
 * @param {Object} req - The Standard ExpressJS request variable.
 * @param {Object} res - The Standard ExpressJS response variable.
 * @param {Object} next - The Standard ExpressJS callback function.
 */
function getCities(request, response, next) {
    var queryArguments = {};

    // See if there's a name to filter by
    var cityName = apiParametersHelper.getQueryParameter(request, 'name');

    if (cityName) {
        queryArguments['where'] = { name: { [Sequelize.Op.like]: '%' + cityName + '%' } };
    }

    // Default the size of the return
    var paginationOptions = apiParametersHelper.extractPaginationParameters(request);
    // dbPaginationHelper.mySql(queryArguments, paginationOptions.itemsPerPage, paginationOptions.pageNumber);

    // make a query and get the services from database
    cityModel.model.findAll(queryArguments).then(function (locations) {
        if (locations.length === 0) {
            gecoder.geocode(cityName).then(function (locationres) {
                var queryArgumentswithLocations = {};
                if (Object.keys(locationres).length > 0) {
                    queryArguments['where'] = { name: { [Sequelize.Op.like]: '%' + locationres.city + '%' } };
                    queryArgumentswithLocations['where'] = { name: { [Sequelize.Op.like]: '%' + locationres.city + '%' } };

                    cityModel.model.findAll(queryArgumentswithLocations).then(function (datalocations) {
                        if (datalocations.length === 0) {
                            cityModel.model.create({
                                'name': locationres.city,
                                'country_name': locationres.countryCode,
                                'latitude': locationres.latitude,
                                'longitude': locationres.longitude
                            }).then(function (insert) {
                                cityModel.model.findAll(queryArguments).then(function (locations) {
                                    var mappedCities = mapperHelper.mapSequelizeObjects(locations, cityModel.mapApi);
                                    mappedCities = removeSpclCharArrString(mappedCities);
                                    response.jsend.success({ cities: mappedCities });
                                }).catch((error) => {
                                    response.jsend.success({ cities: [] });
                                });
                            }).catch(function (err) {
                                cityModel.model.findAll(queryArguments).then(function (locations) {
                                    var mappedCities = mapperHelper.mapSequelizeObjects(locations, cityModel.mapApi);
                                    mappedCities = removeSpclCharArrString(mappedCities);
                                    response.jsend.success({ cities: mappedCities });
                                }).catch((error) => {
                                    response.jsend.success({ cities: [] });
                                });
                            });
                        } else {
                            cityModel.model.findAll(queryArguments).then(function (locationsdata) {
                                var mappedCities = mapperHelper.mapSequelizeObjects(locationsdata, cityModel.mapApi);
                                mappedCities = removeSpclCharArrString(mappedCities);
                                response.jsend.success({ cities: mappedCities });
                            }).catch((error) => {
                                response.jsend.success({ cities: [] });
                            });
                        }

                    }).catch((error) => {
                        response.jsend.success({ cities: [] });
                    });
                } else {
                    response.jsend.success({ cities: [] });
                }

            }).catch((error) => {
                response.jsend.success({ cities: [] });
            });
        } else {
            var mappedCities = mapperHelper.mapSequelizeObjects(locations, cityModel.mapApi);
            mappedCities = removeSpclCharArrString(mappedCities);
            response.jsend.success({ cities: mappedCities });
        }
    }).catch((error) => {
        console.log(error);
        response.jsend.success({ cities: [] });
    });
};

router.get('/cities', getCities);
module.exports = router;

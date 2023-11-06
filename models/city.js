var models = require('../db_models');
var sequelizeDb = models.sequelize;
var Sequelize = models.Sequelize;

var City = sequelizeDb.define('cities', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    geonames_id: {
        type: Sequelize.INTEGER
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    country_name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    aliases: {
        type: Sequelize.TEXT,
        allowNull: true
    },
    latitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false
    },
    longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false
    },
    timezone: {
        type: Sequelize.TEXT,
        allowNull: true
    }
}, {
    tableName: 'cities',
    underscored: true,
    timestamps: false
});

// Array of fields to be mapped when responding to an API
var mapApi = {
    'id': 'id',
    'name': 'name',
    'country_name': 'country_code',
    'latitude': 'latitude',
    'longitude': 'longitude',
    'timezone': 'timezone'
};

module.exports.model = City;
module.exports.mapApi = mapApi;
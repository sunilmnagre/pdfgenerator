module.exports = function(sequelize, DataTypes) {
  var models = require('./index.js'),
    Service = sequelize.define('Service', {
      id: {
        type: DataTypes.INTEGER(11),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true
      },
      short: {
        type: DataTypes.STRING,
        allowNull: true
      },
      service_type: {
        type: DataTypes.ENUM('Module', 'Storage', 'External'),
	      allowNull: true
      },
      credentials: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: true
      }
    }, {
      tableName: 'services',
      underscored : true
    });
    Service.associate = models => {
      Service.belongsToMany(models.Organization, { through: "UserService" });
      Service.hasMany(models.OrgService);
    };
  return Service;
};

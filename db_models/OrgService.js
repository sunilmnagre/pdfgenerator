module.exports = function(sequelize, DataTypes) {
	var models = require('./index.js'),
		OrgService = sequelize.define('OrgService', {
	    id: {
	      type: DataTypes.INTEGER(11),
	      allowNull: false,
	      primaryKey: true,
	      autoIncrement: true
	    },
			credentials: {
        type: DataTypes.TEXT,
        allowNull: true
      },
			status: {
	      type: DataTypes.ENUM('inActive','active'),
	      allowNull: true
	    }
	  },
		{
			tableName: 'org_services',
			underscored : true,
		});
		OrgService.associate  = (models) => {
			OrgService.belongsToMany(models.User, {through: 'UserService'});
			OrgService.belongsTo(models.Service);
		}
	return OrgService;
};

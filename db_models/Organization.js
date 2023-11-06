module.exports = function(sequelize, DataTypes) {
	var models = require('./index.js'),
		Organization = sequelize.define('Organization', {
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
			slug: {
	      type: DataTypes.STRING,
	      allowNull: true
	    },
	    active: {
	      type: DataTypes.BOOLEAN,
	      allowNull: true
	    },
	    created_by: {
	      type: DataTypes.INTEGER(11),
	      allowNull: true
	    }
	  },
		{
	    tableName: 'organizations',
			underscored : true
	  });
	  Organization.associate  = (models) => {
		Organization.hasMany(models.User);
		Organization.belongsToMany(models.Service, {through: 'OrgService'});
	}	
	return Organization;
};

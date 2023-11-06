module.exports = function(sequelize, DataTypes) {
	var models = require('./index.js'),
		Storage = sequelize.define('Storage', {
	    id: {
	      type: DataTypes.INTEGER(11),
	      allowNull: false,
	      primaryKey: true,
	      autoIncrement: true
	    },
			relational_id: {
	      type: DataTypes.INTEGER(5),
	      allowNull: true
	    },
			storage_name: {
				type: DataTypes.STRING,
				allowNull: false
			},
			storage_value: {
				type: DataTypes.STRING,
				allowNull: false
			}
	  },
		{
			tableName: 'storage',
			underscored : true
		});
	return Storage;
};

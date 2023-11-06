module.exports = function(sequelize, DataTypes) {
	var models = require('./index.js'),
		VulnerabilitiesJobQueue = sequelize.define('VulnerabilitiesJobQueue', {
	    id: {
	      type: DataTypes.INTEGER(11),
	      allowNull: false,
	      primaryKey: true,
	      autoIncrement: true
	    },
			job_type: {
				type: DataTypes.STRING,
				allowNull: false
			},
			params: {
				type: DataTypes.TEXT,
				allowNull: false
			},
			organisation_id: {
				type: DataTypes.STRING,
				allowNull: false
			},
			status: {
	      type: DataTypes.ENUM('Running'),
	      allowNull: true
	    },
			attempts: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0
			},
	  },
		{
			tableName: 'vulnerabilities_job_queue',
			underscored : true
		});
	return VulnerabilitiesJobQueue;
};

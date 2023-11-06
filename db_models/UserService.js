module.exports = function (sequelize, DataTypes) {
	var models = require('./index.js'),
		UserService = sequelize.define('UserService', {
			id: {
				type: DataTypes.INTEGER(11),
				allowNull: false,
				primaryKey: true,
				autoIncrement: true
			},
			status: {
				type: DataTypes.ENUM('inActive', 'active'),
				allowNull: true
			},
			credentials: {
				type: DataTypes.TEXT,
				allowNull: true
			},
		},
			{
				tableName: 'user_services',
				underscored: true,
			});
	UserService.associate = models => {
		UserService.belongsTo(models.OrgService);
	};
	return UserService;
};

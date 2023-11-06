
module.exports = function(sequelize, DataTypes) {
	var models = require('./index.js'),
		User = sequelize.define('User', {
	    id: {
	      type: DataTypes.INTEGER(11),
	      allowNull: false,
	      primaryKey: true,
	      autoIncrement: true
	    },
	    first_name: {
	      type: DataTypes.STRING,
	      allowNull: true
	    },
	    last_name: {
	      type: DataTypes.STRING,
	      allowNull: true
	    },
	    username: {
	      type: DataTypes.STRING,
	      allowNull: false,
				unique: true
	    },
	    email: {
	      type: DataTypes.STRING,
	      allowNull: false,
				unique: true
	    },
	    password: {
	      type: DataTypes.STRING,
	      allowNull: true
	    },
	    status: {
	      type: DataTypes.ENUM('pending','approved','rejected'),
	      allowNull: true
	    },
	    action_message: {
	      type: DataTypes.STRING,
	      allowNull: true
	    },
	    created_by: {
	      type: DataTypes.INTEGER(11),
	      allowNull: true
	    }
	  },
		{
	    tableName: 'users',
			underscored : true
	  });
	  User.associate = models => {
		User.belongsToMany(models.OrgService, { through: "UserService" });
		User.belongsTo(models.Role);
		User.belongsTo(models.Organization);
		User.hasMany(models.UserService);
	  };
	return User;
};

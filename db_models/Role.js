module.exports = function(sequelize, DataTypes) {
  var Role = sequelize.define('Role', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    role: {
      type: DataTypes.STRING,
      allowNull: true
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    }
  }, {
    tableName: 'roles',
    classMethods: {
        findId: function (role) {
            return Role.find({
                where: {
                    role: role
                },
                attributes: ['id']
            });
        }
    },
    underscored : true
  });
  Role.associate = models => {
    Role.hasMany(models.User);
  };
  return Role;
};

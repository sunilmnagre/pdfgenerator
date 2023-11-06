module.exports = function (sequelize, DataTypes) {
  const RedisCache = sequelize.define('RedisCache', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    cache_key: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cache_value: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    modified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    ttl: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'redis_cache',
    underscored: true,
    timestamps: false
  });

  return RedisCache;
};

"use strict";

const fs = require("fs"),
  path = require("path"),
  Sequelize = require("sequelize"),
  config = require("config");
const dbSync = process.env.SYNC_DB || false;
const db = {};
let database = config.mysql.database;
let username = config.mysql.username;
let password = config.mysql.password;

let option = {
  logging: false,
  define: {
    underscored: true
  },
  pool: {
    maxConnections: 10,
    minConnections: 0,
    maxIdleTime: 1000
  },
  dialect: 'mysql',
  host: config.mysql.host,
  acquire: 1000000
};

if (config.mysql.replicationObject === true) {
  database = null;
  username = null;
  password = null;
  option.replication = config.mysql.replicationObject;
}

let sequelize = new Sequelize(database, username, password, option);

fs
  .readdirSync(__dirname)
  .filter(function (file) {
    return (file.indexOf(".") !== 0) && (file !== "index.js") && (file !== "package.json");
  })
  .forEach(function (file) {
    var model = sequelize.import(path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach(function (modelName) {
  if ("associate" in db[modelName]) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;
if (dbSync) {
  sequelize.sync({
    logging: console.log
  })
}
module.exports = db;

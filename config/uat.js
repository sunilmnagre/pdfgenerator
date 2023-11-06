const crypto = require('../helpers/crypto-manager').decryptString;

const secure = process.env.SECURE || false;
const protocol = secure ? 'https' : 'http';
const TENABLE_IP = '100.82.18.14';
const SERVER_IP = '100.82.18.14';
const SECONDARY_SERVER_IP = '100.82.18.75';
const REDIS_PORT = '6379';
const SFTP_IP = '100.82.18.14';
const SFTP_PORT = '22';
const MONGO_PORT = '27017';
const ELASTICSERVER_IP = '100.82.18.75'
const ELASTIC_USER = 'mssp_elastic_user_uat';
const ELASTIC_PASSWORD = crypto("WroQW6uFSYB06wJcYWCY1WweYGPhVisGlXA0uB5FcHo=");

module.exports = {
  "server": {
    "host": `${protocol}://${SERVER_IP}:7081`,
  },
  "adminModule": {
    "host": `${protocol}://localhost:7084/api/v1/authenticate/`,
  },
  "mysql": {
    "host": `${SECONDARY_SERVER_IP}`,
    "user": crypto("482GKH9VZ6JG4G9cmlp3qw=="),
    "username": crypto("482GKH9VZ6JG4G9cmlp3qw=="),
    "password": crypto("1+IEcZ0RVuctLZC5lYBY6w=="),
    "database": crypto("ie96ipPqYnJIlwQTyC6Zxg=="),
    "replication": false,
    "replicationObject": {
      "write": {
        "host": `${SERVER_IP}`,
        "username": crypto("482GKH9VZ6JG4G9cmlp3qw=="),
        "password": crypto("1+IEcZ0RVuctLZC5lYBY6w=="),
        "database": crypto("ie96ipPqYnJIlwQTyC6Zxg=="),
      },
      "read": [
        {
          "host": `${SECONDARY_SERVER_IP}`,
          "username": crypto("482GKH9VZ6JG4G9cmlp3qw=="),
          "password": crypto("1+IEcZ0RVuctLZC5lYBY6w=="),
          "database": crypto("ie96ipPqYnJIlwQTyC6Zxg=="),
        }

      ]
    },
  },
  "mongo": {
    "host": `${SECONDARY_SERVER_IP}`,
    "port": `${MONGO_PORT}`,
    "username": crypto("UouoPwkX15aTWRQBDtsv5Q=="),
    "password": crypto("t0WKICIxQXSgBnJ8V+HXxA=="),
    "replication": false,
    "replicationObject": {
      "protocol": "mongodb://",
      "hosts": [
        {
          "host": `${SERVER_IP}`,
          "port": `${MONGO_PORT}`
        },
        {
          "host": `${SECONDARY_SERVER_IP}`,
          "port": `${MONGO_PORT}`
        }
      ],
      "repSet": "rs0"
    },
  },
  "geocode": {
    "apiKey": "AIzaSyAa3Ezzhb8dPHg50nJiVzRPb41xQum96YY",
    "formatter": null
  },
  "tenable": {
    "baseURL": `https://${TENABLE_IP}/rest/`,
    "username": crypto("jnoLhzsE5SA7X/cCSnIb2w=="),
    "password": "mssadmin@2021",
    "releaseSession": false
  },
  "snmp": {
    "host": `${SERVER_IP}`,
    "port": 161,
    "retries": 1,
    "timeout": 5000,
    "transport": "udp4",
    "trapPort": 162,
    "idBitsSize": 16,
    "community": "test"
  },
  "sftp": {
    "host": `${SFTP_IP}`,
    "username": crypto("zbPSpfL0s0rCX1aXwi2B2A=="),
    "password": crypto("k6StRN/l8Ia6owBC99ET/w=="),
    "port": `${SFTP_PORT}`,
    "BASIC_SFTP_PATH": "/home/vm_ods_reports/",
    "BASIC_SFTP_PATH_OLD": "/home/vm_ods_reports_old/",
    "LOCAL_FILES_PATH": "/home/vm_reports/",
    "FILE_REVERT_HOURS_RANGE": 5
  },
  "cron": {
    "fetchZipFiles": {
      "name": "fetchZipFiles",
      "attempts": 3,
      "priority": "normal",
      "schedule": "1",
      "unit": "minute",
      "runOnBoot": false,
      "status": "enabled"
    },
    "fetchTickets": {
      "name": "fetchTickets",
      "attempts": 3,
      "priority": "normal",
      "schedule": "1",
      "unit": "minute",
      "runOnBoot": true,
      "status": "enabled"
    },
    "updateTickets": {
      "name": "updateTickets",
      "attempts": 3,
      "priority": "normal",
      "schedule": "1",
      "unit": "minute",
      "runOnBoot": true,
      "status": "enabled"
    },
    "revertFileStatus": {
      "name": "revertFileStatus",
      "attempts": 3,
      "priority": "normal",
      "schedule": "1",
      "unit": "minute",
      "runOnBoot": true,
      "status": "enabled"
    },
    "fetchTenableScans": {
      "name": "fetchTenableScans",
      "attempts": 3,
      "priority": "normal",
      "schedule": "17",
      "unit": "minutes",
      "runOnBoot": true,
      "status": "enabled"
    },
    "fetchTenableScanResult": {
      "name": "fetchTenableScanResult",
      "attempts": 3,
      "priority": "normal",
      "schedule": "13",
      "unit": "minutes",
      "runOnBoot": true,
      "status": "enabled"
    },
    "fetchTenableVulnerabilities": {
      "name": "fetchTenableVulnerabilities",
      "attempts": 3,
      "priority": "normal",
      "schedule": "4",
      "unit": "minutes",
      "runOnBoot": true,
      "status": "enabled"
    },
    "failAttempts": 3
  },
  "logging": {
    "isEnabled": true,
    "elasticHost": `http://${ELASTIC_USER}:${ELASTIC_PASSWORD}@${ELASTICSERVER_IP}:9200`
  }
};

const crypto = require('../helpers/crypto-manager').decryptString;
const ELASTIC_SERVER_IP = '172.29.161.156';
const PROTOCOL = 'http://';
const ELASTIC_USER = 'mssp_elastic_user_prod';
const ELASTIC_PASSWORD = crypto("WroQW6uFSYB06wJcYWCY1ZKPqhNTxuMhT3mcYch6vcM=");

module.exports = {
  "server": {
    "host": "https://mssportal-usr-app.prod.sdt.ericsson.net:7081",
    "proxy": "http://www-proxy.ericsson.se:8080"
  },
  "adminModule": {
    "host": "https://localhost:7084/api/v1/authenticate/",
  },
  "mysql": {
    "host": "172.29.161.140",
    "port": "3306",
    "username": crypto("482GKH9VZ6JG4G9cmlp3qw=="),
    "password": crypto("fUPFPpYnn/xzteiOZ9DpVQ=="),
    "database": 'msp_acl',
    "replication": false
  },
  "mongo": {
    "host": "172.29.161.138",
    "port": "27017",
    "username": crypto("7/gl6seJ/Kyz8apSDEaqGAk1ZPqaM59vee8pmy8tQxI="),
    "password": crypto("7/gl6seJ/Kyz8apSDEaqGBN0wBi4sS5DObSIytuVPZI="),
    "replication": false
  },
  "geocode": {
    "apiKey": "AIzaSyAa3Ezzhb8dPHg50nJiVzRPb41xQum96YY",
    "formatter": null
  },
  "tenable": {
    "baseURL": "https://172.29.161.149/rest/",
    "username": crypto("76CJHY32KUsAUb+zC/Ri9w=="),
    "password": crypto("QAJ3WduVa1o9Ns51W4Z1aw=="),
    "releaseSession": false
  },
  "snmp": {
    "host": "13.58.95.250",
    "port": 161,
    "retries": 1,
    "timeout": 5000,
    "transport": "udp4",
    "trapPort": 162,
    "idBitsSize": 16,
    "community": "test"
  },
  "sftp": {
    "host": "172.29.161.138",
    "username": crypto("IQkI5HtzI2n9LovtVZ+1/A=="),
    "password": "p!PAM@#4Jb7p7d0jM",
    "port": "22",
    "BASIC_SFTP_PATH": "/opt/mssp/ods/vm_ods_reports/",
    "BASIC_SFTP_PATH_OLD": "/opt/mssp/ods/vm_ods_reports_old/",
    "LOCAL_FILES_PATH": "/opt/mssp/ods/vm_reports/",
    "FILE_REVERT_HOURS_RANGE": 5
  },
  "cron": {
    "fetchZipFiles": {
      "name": "fetchZipFiles",
      "attempts": 3,
      "priority": "normal",
      "schedule": "10",
      "unit": "minute",
      "runOnBoot": false,
      "status": "disabled"
    },
    "fetchTickets": {
      "name": "fetchTickets",
      "attempts": 3,
      "priority": "normal",
      "schedule": "5",
      "unit": "minute",
      "runOnBoot": false,
      "status": "disabled"
    },
    "updateTickets": {
      "name": "updateTickets",
      "attempts": 3,
      "priority": "normal",
      "schedule": "8",
      "unit": "minute",
      "runOnBoot": false,
      "status": "disabled"
    },
    "revertFileStatus": {
      "name": "revertFileStatus",
      "attempts": 3,
      "priority": "normal",
      "schedule": "59",
      "unit": "minute",
      "runOnBoot": false,
      "status": "disabled"
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
    "elasticHost": `${PROTOCOL}${ELASTIC_USER}:${ELASTIC_PASSWORD}@${ELASTIC_SERVER_IP}:9200`
  }
};

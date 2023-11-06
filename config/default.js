const crypto = require('../helpers/crypto-manager').decryptString;

const SERVER_IP = '127.0.0.1';
const STAGE_SERVER_IP = '87.200.95.206'; // where  Tenable is running
const secure = process.env.SECURE || false;
const protocol = secure ? 'https' : 'http';
const ELASTIC_USER = 'mssp_elastic_user';
const ELASTIC_PASSWORD = crypto("WroQW6uFSYB06wJcYWCY1eOVfGqmGPyCAJibRFcmcUs=");

module.exports = {
  "ssl": {
    "keyPath": "/etc/ssl/private/mssp-selfsigned.key",
    "crtPath": "/etc/ssl/certs/mssp-selfsigned.crt"
  },
  "server": {
    "host": `${protocol}://${STAGE_SERVER_IP}:7081`,
  },
  "adminModule": {
    "host": `${protocol}://${SERVER_IP}:7084/api/v1/authenticate/`,
    "endpoints": {
      "isAuthenticated": "isauthenticated",
      "authenticateOrganisation": "authenticateorganisation",
    },
    "config": `${protocol}://${SERVER_IP}:7084/api/v1/configs`
  },
  "mysql": {
    "host": `${SERVER_IP}`,
    "username": crypto("482GKH9VZ6JG4G9cmlp3qw=="),
    "password": crypto("PMFW9R80DqjvPnaQehzHOw=="),
    "database": crypto("ie96ipPqYnJIlwQTyC6Zxg=="),
    "dialect": "mysql",
    "logging": false,
    "replication": false,
    "replicationObject": {
      "write": {
        "host": `${SERVER_IP}`,
        "username": crypto("482GKH9VZ6JG4G9cmlp3qw=="),
        "database": crypto("ie96ipPqYnJIlwQTyC6Zxg=="),
        "password": crypto("PMFW9R80DqjvPnaQehzHOw==")
      },
      "read": [
        {
          "host": `${SERVER_IP}`,
          "username": crypto("482GKH9VZ6JG4G9cmlp3qw=="),
          "database": crypto("ie96ipPqYnJIlwQTyC6Zxg=="),
          "password": crypto("PMFW9R80DqjvPnaQehzHOw==")
        }

      ]
    },
  },
  "mongo": {
    "protocol": "mongodb://",
    "host": `${SERVER_IP}`,
    "port": "27017",
    "username": crypto("UouoPwkX15aTWRQBDtsv5Q=="),
    "password": crypto("gZNXy4X3Sdz64E0PttmvFw=="),
    "isAuthenticate": true,
    "limit": {
      "dashboardCharts": 300
    },
    "tables": {
      "geoLocation": "geo-location",
      "scans": "scans",
      "reports": "reports",
      "vulnerabilities": "vulnerabilities",
      "downloadableReports": "downloadableReports",
      "credentials": "credentials",
      "inventory": "inventory"
    },
    "replication": false,
    "replicationObject": {
      "protocol": "mongodb://",
      "hosts": [
        {
          "host": `${SERVER_IP}`,
          "port": "27017"
        },
        {
          "host": `${SERVER_IP}`,
          "port": "27017"
        }
      ],
      "repSet": "rs0"
    },
  },
  "geocode": {
    "provider": "google",
    "httpAdapter": "request",
    "apiKey": "AIzaSyAa3Ezzhb8dPHg50nJiVzRPb41xQum96YY",
    "formatter": null
  },
  "tenable": {
    "baseURL": `https://${STAGE_SERVER_IP}/rest/`,
    "username": crypto("jnoLhzsE5SA7X/cCSnIb2w=="),
    "password": crypto("/dzHPKQhvqctJ7Fo7+cyNA=="),
    "releaseSession": false,
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
    "host": `${STAGE_SERVER_IP}`,
    "username": crypto("KiRxgSzlUkyY5wRE6FDpTA=="),
    "password": crypto("RI9oOazAfTJfzfsQWtnr+A=="),
    "port": "22",
    "BASIC_SFTP_PATH": "/home/vm_ods_reports/",
    "BASIC_SFTP_PATH_OLD": "/home/vm_ods_reports_old/",
    "LOCAL_FILES_PATH": "/Users/apple/Desktop/vm_reports/",
    "FILE_TYPE": {
      "INPROGRESS": "INPROGRESS_",
      "ALARMS": "ALARMS",
      "TICKETS": "TICKETS"
    },
    "FILE_REVERT_HOURS_RANGE": 5
  },
  "vulnerabilities": {
    "types": {
      "securityException": {
        "daysToAlertBeforeEnd": 30
      }
    },
    "minutesToLock": 30
  },
  "globals": {
    "tenable": {
      "analysis": {
        "startOffset": 0,
        "endOffset": 20000
      },
      Repository: {
        BSR_Identifier: 'BSR'
      }
    },
    "reports": {
      "monthsUntilArchived": 36
    },
    "queueTypes": {
      "scan": "scan",
      "vulnerability": "vulnerability"
    },
    "launchDuration": {
      "ad-hoc": {
        "label": "Ad-hoc",
        "value": "ONDEMAND"
      },
      "ad-hoc-with-schedule": {
        "label": "Ad-hoc with Schedule",
        "value": "ONETIME"
      },
      "daily": {
        "label": "Daily",
        "value": "DAILY"
      },
      "weekly": {
        "label": "Weekly",
        "value": "WEEKLY"
      },
      "monthly": {
        "label": "Monthly",
        "value": "MONTHLY;INTERVAL=1"
      },
      "quarterly": {
        "label": "Quarterly",
        "value": "MONTHLY;INTERVAL=3"
      },
      "semi-annual": {
        "label": "Semi Annual",
        "value": "MONTHLY;INTERVAL=6"
      },
      "annual": {
        "label": "Annual",
        "value": "YEARLY"
      }
    },
    "reportType": {
      "preliminary": {
        "label": "Preliminary",
        "value": "preliminary"
      },
      "finalised": {
        "label": "Finalised Report",
        "value": "finalised"
      }
    }
  },
  "paths": {
    "tmpDirectory": "./temp/",
    "reportsConfigurableDirectory": "./reports/",
    "reportsConfigurableDirectoryForHost": "/reports"
  },
  "pagination": {
    "itemsPerPage": 20
  },
  "cron": {
    "units": {
      "seconds": {
        "index": 0,
        "maxmimumLimit": "59"
      },
      "minutes": {
        "index": 1,
        "maxmimumLimit": "59"
      },
      "hours": {
        "index": 2,
        "maxmimumLimit": "23"
      }
    },
    "fetchZipFiles": {
      "name": "fetchZipFiles",
      "attempts": 3,
      "priority": "normal",
      "schedule": "2",
      "unit": "minute",
      "runOnBoot": false,
      "status": "disabled"
    },
    "fetchTickets": {
      "name": "fetchTickets",
      "attempts": 3,
      "priority": "normal",
      "schedule": "3",
      "unit": "minute",
      "runOnBoot": false,
      "status": "disabled"
    },
    "updateTickets": {
      "name": "updateTickets",
      "attempts": 3,
      "priority": "normal",
      "schedule": "4",
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
      "schedule": "5",
      "unit": "minutes",
      "runOnBoot": true,
      "status": "enabled"
    },
    "fetchTenableVulnerabilities": {
      "name": "fetchTenableVulnerabilities",
      "attempts": 3,
      "priority": "normal",
      "schedule": "3",
      "unit": "minutes",
      "runOnBoot": true,
      "status": "enabled"
    },
    "failAttempts": 3
  },
  "cryptography": {
    "algorithm": "aes256",
    "salt": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
  },
  "tenable_scans": {
    "schedule_buffer_minutes": 30,
  },
  "user_type": {
    "SuperAdmin": "SuperAdmin",
    "Admin": "Admin",
    "Customer": "Customer"
  },
  "credentials_types": [
    {
      "type": "Database",
      "authType": [
        "MySQL",
        "Oracle"
      ]
    },
    {
      "type": "SNMP",
      "authType": [
        "SNMP"
      ]
    },
    {
      "type": "SSH",
      "authType": [
        "Password",
        "Publickey"
      ]
    },
    {
      "type": "Windows",
      "authType": [
        "Password"
      ]
    }
  ],
  "logging": {
    "isEnabled": true,
    "access": "mssp-access-logs",
    "exception": "mssp-exception-logs",
    "accessLogFile": "/opt/mssplogs/access-log",
    "exceptionLogFile": "/opt/mssplogs/error-log",
    "elasticHost": `${protocol}://${ELASTIC_USER}:${ELASTIC_PASSWORD}@${SERVER_IP}:9200`
  },
  "cache": {
    "ttl": 1800,
    "enable": true
  },
  VEPRange: {
    significant: 79.21,
    moderate: 26.91,
    low: 0.1
  },
  VEPLevels: {
    significant: 'Significant',
    moderate: 'Moderate',
    low: 'Low'
  },
  vprBySeverity: {
    1: 3.9,
    2: 6.9,
    3: 9.9,
    4: 10
  }
};

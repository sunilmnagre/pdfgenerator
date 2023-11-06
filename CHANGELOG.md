# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [3.0.0](https://bitbucket.org/splitdubai/mssp-be-vm/branch/master) - 2020-February-05

### Changed
- Modify mongo & tenable functionalities based on COB data structure modifications
- Clean up configuration files
- Bug Fixes and error handling for few cases
- Add filter for scan list endpoint
- Upgrade Node version to 10.18.1
- Upgrade relevant dependencies to latest version

### Removed
- Remove unused files


## [2.0.6](https://bitbucket.org/splitdubai/mssp-be-vm/branch/develop) - 2019-November-25

### Changed
- Bug fix in download reports


## [2.0.5](https://bitbucket.org/splitdubai/mssp-be-vm/branch/develop) - 2019-November-14

- No changes


## [2.0.4](https://bitbucket.org/splitdubai/mssp-be-vm/branch/develop) - 2019-October-23

- No changes


## [2.0.3](https://bitbucket.org/splitdubai/mssp-be-vm/branch/develop) - 2019-September-03

- No changes


## [2.0.2](https://bitbucket.org/splitdubai/mssp-be-vm/branch/develop) - 2019-September-01

### Added
- Add encryption mechanism for configuration keys


## 2.0.1 - 2019-August-28

### Added
- Implement DB replication feature


## 2.0.0 - 2019-August-08

### Added
- Implement app logs
- Implement sftp jobs
- Implement generate ticket

### Changed
- Modifications on PM2 process
- Update config file
- Modify reports display condition
- Include protocol field in SNMP trap
- Update the message logger in VM
- Parse Additionalstring to get vulnerability id

### Removed
- Remove msp-global-models
- Remove ticket unused fields
- Remove plugin_output tag from vulnerabilities
- Remove `||` before id



let schedule = require('node-schedule');
let tenableScan = require('../jobs/tenable/get-tenable-scans');
let tenableVulnerability = require('../jobs/tenable/get-tenable-vulnerabilities');
let tenableScanResult = require('../jobs/tenable/job-get-scan-result');
let config = require('config');
const { getConfigurations } = require('../models/configs');
const servicesHelper = require('../helpers/services');
const sync = async () => {
  const supportedTypes = await servicesHelper.getServicesSlugs(true);
  await getConfigurations(supportedTypes.VM.id, '1');

  let jobConfig = config.cron;
  const availableUnits = jobConfig.units;

  let fetchTenableScanStatus = jobConfig.fetchTenableScans.status;
  let fetchTenableVulnerabilities = jobConfig.fetchTenableVulnerabilities.status;
  let fetchTenableScanResultStatus = jobConfig.fetchTenableScanResult.status;

  let tenableVulnerabilitiesFrequency = '*/1 * * * *'; // By default it will run for every 1 minute
  let tenableScanFrequency = '*/1 * * * *'; // By default it will run for every 1 minute
  let tenableScanResultFrequency = '*/1 * * * *'; // By default it will run for every 1 minute

  let fetchTenableScanMessage = '1 minutes';
  let fetchTenableVulnerabilityMessage = '1 minutes';
  let fetchTenableScanResultMessage = '1 minutes';

  function getScheduleFrequency(frequency, scanJobObj) {
    if (scanJobObj && scanJobObj.schedule && scanJobObj.unit) {
      let unitObj = availableUnits[scanJobObj.unit];

      if (unitObj && parseInt(scanJobObj.schedule, 10) <= parseInt(unitObj.maxmimumLimit, 10)) {
        frequency = '';

        for (var i = unitObj.index; i < 6; i++) {
          if (i > unitObj.index && i < 6) {
            frequency += ' ';
          }

          if (i === unitObj.index) {
            frequency += '*/' + scanJobObj.schedule;
          } else {
            frequency += '*';
          }
        }

        if (scanJobObj.name === 'fetchTenableScans') {
          fetchTenableScanMessage = scanJobObj.schedule + ' ' + scanJobObj.unit;
        } else if (scanJobObj.name === 'fetchTenableVulnerabilities') {
          fetchTenableVulnerabilityMessage = scanJobObj.schedule + ' ' + scanJobObj.unit;
        } else if (scanJobObj.name === 'fetchTenableScanResult') {
          fetchTenableScanResultMessage = scanJobObj.schedule + ' ' + scanJobObj.unit;
        }
      }
    }

    return frequency;
  }

  tenableScanFrequency = getScheduleFrequency(tenableScanFrequency, jobConfig.fetchTenableScans);
  tenableVulnerabilitiesFrequency = getScheduleFrequency(tenableVulnerabilitiesFrequency, jobConfig.fetchTenableVulnerabilities);
  tenableScanResultFrequency = getScheduleFrequency(tenableScanResultFrequency, jobConfig.fetchTenableScanResult);

  if (fetchTenableScanStatus === "enabled") {
    schedule.scheduleJob(tenableScanFrequency, async () => {
      await getConfigurations(supportedTypes.VM.id, '1');
      tenableScan.getScans();
      console.info('Get Scan from tenable running in every ' + fetchTenableScanMessage + ' .....' + new Date());
    });
  }

  if (fetchTenableVulnerabilities === "enabled") {
    schedule.scheduleJob(tenableVulnerabilitiesFrequency, async () => {
      await getConfigurations(supportedTypes.VM.id, '1');
      tenableVulnerability.getVulnerabilites();
      console.info('Get Vunerabilities from tenable running in every ' + fetchTenableVulnerabilityMessage + ' .....' + new Date());
    });
  }

  if (fetchTenableScanResultStatus === "enabled") {
    schedule.scheduleJob(tenableScanResultFrequency, async () => {
      await getConfigurations(supportedTypes.VM.id, '1');
      tenableScanResult.getScanResults();
      console.info('Get Scan Result from tenable running in every ' + fetchTenableScanResultMessage + ' .....' + new Date());
    });
  }
}
sync();
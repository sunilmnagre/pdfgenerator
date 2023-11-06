const schedule = require('node-schedule');
const sftpJobsHelper = require('../helpers/sftp-jobs-helper');
const fetchZIPFiles = require('./fetch-zip');
const revertFileStatus = require('./revert-file-status');
const config = require('config');
const { getConfigurations } = require('../models/configs');
const servicesHelper = require('../helpers/services');

const jobConfig = config.cron;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 *
 * @param unit
 * @param time
 * @returns {string}
 */
const getScheduling = (unit, time) => {
  let pattern = '';
  switch (unit) {
    case 'minute':
      pattern = `*/${time} * * * *`;
      break;

    default:
      pattern = '* * * * *';
      break;
  }
  return pattern;
};



if (jobConfig.fetchTickets.status === 'enabled') {
  const frequency = getScheduling(jobConfig.fetchTickets.unit, jobConfig.fetchTickets.schedule);
  schedule.scheduleJob(frequency, async () => {
    const supportedTypes = await servicesHelper.getServicesSlugs(true);
    await getConfigurations(supportedTypes.VM.id, '1');
    const sftp = JSON.parse(process.env.sftp);
    sftpJobsHelper.processJob(sftp.FILE_TYPE.ALARMS);
    console.info('------ Fetch tickets Job running in every ' + jobConfig.fetchTickets.schedule + ' ' + jobConfig.fetchTickets.unit + '------' + new Date());
  });
}

if (jobConfig.fetchZipFiles.status === 'enabled') {
  const frequency = getScheduling(jobConfig.fetchZipFiles.unit, jobConfig.fetchZipFiles.schedule);
  schedule.scheduleJob(frequency, async () => {
    const supportedTypes = await servicesHelper.getServicesSlugs(true);
    await getConfigurations(supportedTypes.VM.id, '1');
    fetchZIPFiles();
    console.info('------ Fetch Zip files Job running in every ' + jobConfig.fetchZipFiles.schedule + ' ' + jobConfig.fetchZipFiles.unit + '------' + new Date());
  });
}

if (jobConfig.updateTickets.status === 'enabled') {
  const frequency = getScheduling(jobConfig.updateTickets.unit, jobConfig.updateTickets.schedule);
  schedule.scheduleJob(frequency, async () => {
    const supportedTypes = await servicesHelper.getServicesSlugs(true);
    await getConfigurations(supportedTypes.VM.id, '1');
    const sftp = JSON.parse(process.env.sftp);
    sftpJobsHelper.processJob(sftp.FILE_TYPE.TICKETS);
    console.info('------ Update tickets Job running in every ' + jobConfig.updateTickets.schedule + ' ' + jobConfig.updateTickets.unit + '------' + new Date());
  });
}

if (jobConfig.revertFileStatus.status === 'enabled') {
  const frequency = getScheduling(jobConfig.revertFileStatus.unit, jobConfig.revertFileStatus.schedule);
  schedule.scheduleJob(frequency, function () {
    revertFileStatus();
    console.info('------ Revert file status Job running in every ' + jobConfig.updateTickets.schedule + ' ' + jobConfig.updateTickets.unit + '------' + new Date());
  });
}

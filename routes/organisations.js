const express = require('express');
const vulnerabilitiesApi = require('../routes/vulnerabilities');
const historyApi = require('../routes/history');
const reportsApi = require('../routes/reports');
const reportsConfigurableApi = require('../routes/reports-configurable');
const scanApi = require('../routes/scans');
const apiValidators = require('../helpers/api/validators');
const authenticate = require('../middleware/authenticate');
const caching = require('../middleware/api-cache')._get;
const router = express.Router();
const { validateMandatoryParamsOfActions } = require('../helpers/api/vulnerability');


router.use('/:id/*', authenticate.organisationHasService);
router.get('/:id/reports/vulnerabilities-for-map', apiValidators.organisationExists,
  authenticate.authenticateOrganisation,
  vulnerabilitiesApi.validateOrganisationVulnerabilityNameParameters, vulnerabilitiesApi.updateReportsForScans,
  vulnerabilitiesApi.getVulnerabilitiesForMap);
router.patch('/:id/reports/:reportId/', apiValidators.organisationExists,
  authenticate.authenticateOrganisation, apiValidators.reportExists,
  reportsApi.validateReportUpdateParameters, reportsApi.updateReport);
router.get('/:id/reports/', apiValidators.organisationExists, authenticate.authenticateOrganisation, reportsApi.validateReportsParameters, reportsApi.getReports);
router.get('/:id/reports/:reportId', apiValidators.organisationExists,
  authenticate.authenticateOrganisation, apiValidators.reportExists, reportsApi.getReport);
router.delete('/:id/reports/:reportId', apiValidators.organisationExists,
  authenticate.authenticateOrganisation, apiValidators.reportExists, reportsApi.deleteReport);
router.get('/:id/reports/:reportId/vulnerabilities', apiValidators.organisationExists,
  authenticate.authenticateOrganisation, apiValidators.reportExists,
  vulnerabilitiesApi.validateOrganisationVulnerabilityNameParameters,
  vulnerabilitiesApi.getVulnerabilities);
router.get('/:id/reports/:reportId/vulnerabilities/pending', apiValidators.organisationExists,
  authenticate.authenticateOrganisation, apiValidators.reportExists,
  vulnerabilitiesApi.getPendingForReport);
router.get('/:id/reports/:reportId/vulnerabilitiesCount/:targetId?', apiValidators.organisationExists,
  authenticate.authenticateOrganisation, apiValidators.reportExists,
  vulnerabilitiesApi.validateOrganisationVulnerabilityNameParameters,
  vulnerabilitiesApi.getVulnerabilitiesCountByType);
router.get('/:id/reports/:reportId/vulnerabilities/:vulnerabilityId',
  apiValidators.organisationExists, authenticate.authenticateOrganisation,
  apiValidators.reportExists, vulnerabilitiesApi.validateOrganisationVulnerabilityNameParameters,
  vulnerabilitiesApi.getVulnerability);
router.get('/:id/scans/:scanID/vulnerabilities/', apiValidators.organisationExists,
  authenticate.authenticateOrganisation, apiValidators.scanExists,
  apiValidators.validateStartAndEndDate, scanApi.getGroupedVulnerabilities);


router.get('/:id/scans/:scanID', apiValidators.organisationExists,
  authenticate.authenticateOrganisation, apiValidators.scanExists, scanApi.getScanDetails);
router.get('/:id/scans', apiValidators.organisationExists, authenticate.authenticateOrganisation, reportsApi.validateReportsParameters, scanApi.getScanList);
router.patch('/:id/scans/:scanID', apiValidators.organisationExists, authenticate.authenticateOrganisation, apiValidators.scanExists, apiValidators.scanNameNotExists, scanApi.updateTenableScan);
router.patch('/:id/reports/:reportId/vulnerabilities/:vulnerabilityId',
  apiValidators.organisationExists, authenticate.authenticateOrganisation, vulnerabilitiesApi.validateOrganisationVulnerabilityNameParameters,
  apiValidators.checkAndLockVulnerability, validateMandatoryParamsOfActions, vulnerabilitiesApi.updateVulnerability);
router.patch('/:id/reports/:reportId/vulnerabilities/:vulnerabilityId/generate-ticket',
  apiValidators.organisationExists, authenticate.authenticateOrganisation, vulnerabilitiesApi.validateOrganisationVulnerabilityNameParameters,
  apiValidators.checkAndLockVulnerability, vulnerabilitiesApi.generateVulnerabilityTicket);
router.get('/:id/vulnerabilities/:vulnerabilityId/isLocked',
  apiValidators.organisationExists, authenticate.authenticateOrganisation,
  vulnerabilitiesApi.isVulnerabilityLocked);
router.patch('/:id/vulnerabilities/lock',
  apiValidators.organisationExists, authenticate.authenticateOrganisation,
  vulnerabilitiesApi.lockVulnerabilities);
router.put('/:id/reports/:reportId/vulnerabilities/:vulnerabilityId/notes',
  apiValidators.organisationExists, authenticate.authenticateOrganisation, apiValidators.reportExists, apiValidators.vulnerabilityExists,
  apiValidators.checkAndLockVulnerability, vulnerabilitiesApi.addNote);
router.patch('/:id/reports/:reportId/vulnerabilities/:vulnerabilityId/notes/:noteId',
  apiValidators.organisationExists, authenticate.authenticateOrganisation, apiValidators.reportExists, apiValidators.vulnerabilityExists,
  apiValidators.checkAndLockVulnerability, apiValidators.noteExists, vulnerabilitiesApi.updateNote);
router.delete('/:id/reports/:reportId/vulnerabilities/:vulnerabilityId/notes/:noteId',
  apiValidators.organisationExists, authenticate.authenticateOrganisation, apiValidators.reportExists, apiValidators.vulnerabilityExists,
  apiValidators.noteExists, apiValidators.checkAndLockVulnerability,
  vulnerabilitiesApi.deleteNote);
router.get('/:id/reports/:reportId/vulnerabilities/:vulnerabilityId/notes',
  apiValidators.organisationExists, authenticate.authenticateOrganisation, apiValidators.reportExists, apiValidators.vulnerabilityExists,
  vulnerabilitiesApi.getNotes);
router.patch('/:id/reports/:reportId/vulnerabilities/:vulnerabilityId/history/:historyId',
  apiValidators.organisationExists, authenticate.authenticateOrganisation,
  vulnerabilitiesApi.validateOrganisationVulnerabilityNameParameters,
  apiValidators.checkAndLockVulnerability, historyApi.updateHistory);

router.get('/:id/reports/:reportId/download',
  apiValidators.organisationExists, authenticate.authenticateOrganisation,
  apiValidators.reportExists, apiValidators.validateReportFormatParameter
  , apiValidators.validateReportTemplateParameter, reportsConfigurableApi.downloadSingle);

router.get('/:id/reports/:reportId/view',
  apiValidators.organisationExists, authenticate.authenticateOrganisation,
  apiValidators.reportExists, apiValidators.validateReportFormatParameter
  , apiValidators.validateReportTemplateParameter, reportsConfigurableApi.viewSingle);

router.post('/:id/reports/view',
  apiValidators.organisationExists, authenticate.authenticateOrganisation,
  reportsConfigurableApi.validateConfigurableParameters,
  reportsConfigurableApi.viewConfigurable);

router.post('/:id/reports/download',
  apiValidators.organisationExists, authenticate.authenticateOrganisation,
  reportsConfigurableApi.validateConfigurableParameters, reportsConfigurableApi.downloadConfigurable);

router.get('/:id/reports/saved/download/:downloadableReportId',
  apiValidators.organisationExists, authenticate.authenticateOrganisation,
  apiValidators.downaloadableReportExists,
  reportsConfigurableApi.downloadSaved);

router.get('/:id/reports/saved/view/:downloadableReportId',
  apiValidators.organisationExists, authenticate.authenticateOrganisation,
  apiValidators.downaloadableReportExists,
  reportsConfigurableApi.viewSaved);

router.get('/:id/vulnerabilities/', apiValidators.organisationExists, authenticate.authenticateOrganisation, vulnerabilitiesApi.getVulnerabilitiesForOrganisation);
router.get('/:id/vulnerabilities/pending', apiValidators.organisationExists, authenticate.authenticateOrganisation, vulnerabilitiesApi.getPendingForOrganisation);

router.get('/:id/dashboard/vulnerability-by-organisation', apiValidators.organisationExists, authenticate.authenticateOrganisation, caching, vulnerabilitiesApi.getAllVulnerabilitiesByOrganisation);

router.get('/:id/dashboard/vulnerability-by-fields', apiValidators.organisationExists, authenticate.authenticateOrganisation, caching, vulnerabilitiesApi.getVulnerabilitiesByFields);

router.get('/:id/dashboard/scan-efficiency', apiValidators.organisationExists, authenticate.authenticateOrganisation, caching, vulnerabilitiesApi.getScanEfficiency);

router.get('/:id/dashboard/vm-sla', apiValidators.organisationExists, authenticate.authenticateOrganisation, caching, vulnerabilitiesApi.getVMSLAChart);
router.get('/:id/dashboard/mom', apiValidators.organisationExists, authenticate.authenticateOrganisation, caching, vulnerabilitiesApi.getMoM);
router.get('/:id/dashboard/average-time-taken', apiValidators.organisationExists, authenticate.authenticateOrganisation, caching, vulnerabilitiesApi.getAverageTimeTaken);
router.get('/:id/dashboard/remediation-trend-summary', apiValidators.organisationExists, authenticate.authenticateOrganisation, caching, vulnerabilitiesApi.getRemediationTrendSummary);
router.get('/:id/dashboard/vulnerabilities-closure', apiValidators.organisationExists, authenticate.authenticateOrganisation, caching, vulnerabilitiesApi.getVulnerabilitiesClosure);

module.exports = router;

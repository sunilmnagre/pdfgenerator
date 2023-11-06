const express = require('express');
const authenticate = require('./middleware/authenticate');
const addNoCacheHeaders = require('./middleware/addNoCacheHeaders');
const config = require('config');
const { Client } = require('@elastic/elasticsearch');
const { accessLogger, esPing } = require('./middleware/loggers');
const mongoose = require('mongoose');
const connectionString = config.mongo.isAuthenticate ? config.mongo.protocol + config.mongo.username + ':' + config.mongo.password + '@' + config.mongo.host + ':' + config.mongo.port : config.mongo.protocol + config.mongo.host + ':' + config.mongo.port;

mongoose.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true });

const app = express();
const path = require('path');

const router = express.Router();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// =======================
// API Routes ============
// =======================
router.use('/authenticate', authenticate.request);
//Access logger
if (config.logging.isEnabled) {
    const elasticClient = new Client({
        node: config.logging.elasticHost,
        maxRetries: 3
    });
    esPing(elasticClient);

    router.use((req, res, next) => {
        req.EClient = elasticClient;
        next();
    });
    router.use(accessLogger);
}

// add no cache headers to prevent caching in IE
router.get('/*', addNoCacheHeaders);

// =================== Vulnerability Management ==================== //
router.use('/organisations', authenticate.isAuthenticated, require('./routes/organisations'));
router.use('/scans', authenticate.isAuthenticated, require('./routes/scans').router);
router.use('/vulnerabilities', authenticate.isAuthenticated, require('./routes/vulnerabilities').router);
router.use('/locations', authenticate.isAuthenticated, require('./routes/locations'));
router.use('/org-scan-configs', authenticate.isAuthenticated, require('./routes/scan-configuration'));
router.use('/org-scan-operations', authenticate.isAuthenticated, require('./routes/scan-operations'));
router.use('/org-missing-reports', authenticate.isAuthenticated, require('./routes/missing-reports'));
router.use('/org-downloads', authenticate.isAuthenticated, require('./routes/organization-downloads'));
router.use('/org-credentials', authenticate.isAuthenticated, require('./routes/credentials'));
router.use('/configs', authenticate.isAuthenticated, require('./routes/configs'));


// Route to get API docs
router.use(express.static(path.join(__dirname, './doc/')));
router.get('/docs', (req, res) => { res.sendFile(path.join(__dirname, './doc', 'index.html')); });
router.use('/sample', authenticate.isAuthenticated, express.static(path.join(__dirname, './sample')));

// Append api/v1 to all routes
app.use('/api/v1', router);

module.exports = app;

/* eslint-disable no-console */

const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const routes = require('./router');
const expressValidator = require('express-validator');
const jsend = require('jsend');
const path = require('path');
const buildReportCSS = require('./scripts/generate-report-css');
const https = require('https');
const http = require('http');
const fs = require('fs');
const config = require('config');
const responseTime = require('response-time');

const secure = process.env.SECURE || false;
const port = process.env.PORT || 7081;
const app = express();

app.use(cors());
app.use(logger('dev'));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(expressValidator([]));
app.use(express.static(path.join(__dirname, '/public')));
app.use('/reports/assets', express.static(path.join(__dirname, '/reports/assets')));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(jsend.middleware);
app.use(responseTime());

// =======================
// Routes ================
// =======================
app.use('/', function (req, res, next) {
  process.on('unhandledRejection', (reason, error) => {
    const responseHeaders = res.getHeaders();

    if ((reason || error) && !responseHeaders['etag']) {
      return res.status(422).jsend.fail(['The application has encountered an unknown error']);
    }
  });

  process.on('uncaughtException', (reason, error) => {
    const responseHeaders = res.getHeaders();

    if ((reason || error) && !responseHeaders['etag']) {
      return res.status(422).jsend.fail(['The application has encountered an unknown error']);
    }
  });

  next();

}, routes);

// This will generate CSS by reading SASS placed in report/assets/scss folder
buildReportCSS.generateReportCss();

// 404 catch-all handler (middleware)
app.use(function (req, res) {
  res.status(404);
  res.json({
    success: 'Failed',
    message: '404 Not Found',
    data: []
  });
});

// 500 error handler (middleware)
app.use(function (err, req, res) {
  console.log(err);
  res.status(500);
  res.json({
    success: 'Failed',
    message: 'Internal Server Error',
    data: err
  });
});

// =======================
// start the server ======
// =======================
console.log('Booting with following config:');
let server = null;
if (secure) {
  server = https.createServer({
    key: fs.readFileSync(config.ssl.keyPath),
    cert: fs.readFileSync(config.ssl.crtPath)
  }, app);
} else {
  server = http.createServer(app);
}
server.listen(port, async () =>{
  console.log('VM App Backend listening on port ' + port);
  const { getConfigurations} = require('./models/configs');
  const servicesHelper = require('./helpers/services');
  const supportedTypes = await servicesHelper.getServicesSlugs(true);
  await getConfigurations(supportedTypes.VM.id, '1');
});
module.exports = app;
/* eslint-enable */

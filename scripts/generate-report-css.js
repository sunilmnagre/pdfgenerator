const fs = require('fs');
const Console = require('better-console');
const sass = require('node-sass');
const getFileLocation = require('../helpers/report-configurable').getFileLocation;

// Generate the CSS
var generateReportCss = () => {
  const cssFileLocation = getFileLocation('assets/css/report.css');
  const scssFileLocation = getFileLocation('assets/scss/report.scss');
  const reportViewcssFileLocation = getFileLocation('assets/css/report-view.css');
  const reportViewscssFileLocation = getFileLocation('assets/scss/report-view.scss');

  sass.render({
    file: scssFileLocation,
    outFile: cssFileLocation,
  }, function (renderError, result) {
    if (!renderError) {
       // No errors during the compilation, write this result on the disk
      fs.writeFile(cssFileLocation, result.css, function (writeError) {
        if (!writeError) {
          // file written on disk
        } else {
          Console.log(writeError);
        }
      });
    } else {
      Console.log(renderError);
    }
  });

  sass.render({
    file: reportViewscssFileLocation,
    outFile: reportViewcssFileLocation,
  }, function (renderError, result) {
    if (!renderError) {
       // No errors during the compilation, write this result on the disk
      fs.writeFile(reportViewcssFileLocation, result.css, function (writeError) {
        if (!writeError) {
          // file written on disk
        } else {
          Console.log(writeError);
        }
      });
    } else {
      Console.log(renderError);
    }
  });
};

module.exports.generateReportCss = generateReportCss;

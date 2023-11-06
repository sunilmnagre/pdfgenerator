var handlebars = require('handlebars');
var fs = require('fs');
var reportConfigurableHelper = require('../helpers/report-configurable');
var _ = require('lodash');
var moment = require('moment');
const Promise = require('bluebird');

/**
 * Enables the debugging for Handlebars. Use by adding `{{debug}}` to any template
 */
function enableHandlebarDebug() {
  // In this block we're ignoring warnings about console.log. It's for debugging purposes
  /* eslint-disable no-console */
  handlebars.registerHelper('debug', function (optionalValue) {
    console.log('Current context');
    console.log('====================');
    console.log(this);

    if (optionalValue) {
      console.log('Value');
      console.log('====================');
      console.log(optionalValue);
    }
  });
  /* eslint-enable */
}

/**
 * Defines and enables any special helpers we want to use in Handlebars
 */
function defineHandlebarHelpers() {
  handlebars.registerHelper('toLowerCase', function (string) {
    return string ? string.toLowerCase() : '';
  });

  handlebars.registerHelper('nl2br', function (string) {
    // The concatenation below is fhr format for the "replace" method
    // eslint-disable-next-line no-useless-concat
    var nl2br = (string + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + '<br>' + '$2');
    return new handlebars.SafeString(nl2br);
  });

  handlebars.registerHelper('concat', function (...args) {
    var arg = Array.prototype.slice.call(args, 0);
    arg.pop();
    return arg.join('');
  });

  handlebars.registerHelper('formatDate', function (datetime) {
    return moment(datetime).format('MMM DD, YYYY');
  });
}

/**
 * Generates an HTML report
 * @param {Number} organisationId The organisation this report will be generated from
 * @param {Array} reportIds An array of report IDs this report is for
 * @param {String} templateName The name of the template to generate. Defaults to 'default'
 * @param {Array} blocks Array of block names to be included in a configurable report
 * @param {Object} additionalParameters Any additional information or parameters that need to
 *  be passed onto the report and its blocks
 * @returns {String} The generated report HTML
 */
function generateReportHtml(organisationId, reportIds, templateName = 'default',
  blocks = [], additionalParameters = {}) {
  // Set up Handlebars
  enableHandlebarDebug();
  defineHandlebarHelpers();

  let templateToUse = templateName;

  // Check the template config and layout exists
  if (blocks.length > 0) {
    templateToUse = 'configurable';
  }

  const templateConfigLocation = reportConfigurableHelper.getTemplateJsLocation(templateToUse);
  const fullTemplateName = reportConfigurableHelper.getReportTemplateLocation(templateToUse);

  let compiledTemplate = null;
  let html = null;

  if (!fs.existsSync(templateConfigLocation)) {
    return Promise.reject('Report template configuration for "' + templateToUse + '" does not exist');
  }

  if (!fs.existsSync(fullTemplateName)) {
    return Promise.reject('Report template for "' + templateToUse + '" does not exist');
  }

  // ESLint doesn't like us including JS files dynamically, so we're forced to disable it for
  //  the following line
  // eslint-disable-next-line
  const templateBlocks = require(templateConfigLocation).getBlocks(blocks);
  // eslint-disable-next-line
  const preloadBlocks = require(templateConfigLocation).getPreloadBlocks();
  const template = fs.readFileSync(fullTemplateName, 'utf8');

  // Compile the template data into a function
  try {
    compiledTemplate = handlebars.compile(template);
  } catch (error) {
    return Promise.reject('Failed to compile template with error: ' + error);
  }

  const blockPromises = {};
  let blockObject = null;

  // Preload the required blocks
  _.each(preloadBlocks, function (templateBlockName) {
    // ESLint doesn't like us including JS files dynamically, so we're forced to disable it for
    //  the following line
    // eslint-disable-next-line
    blockObject = require(reportConfigurableHelper.getBlockJsLocation(templateBlockName));

    try {
      blockObject.build(organisationId, reportIds);
    } catch (error) {
      Promise.reject('Failed to build block "' + templateBlockName + '" with error: ' + error);
    }
  });

  _.each(templateBlocks, function (templateBlockName) {
    // ESLint doesn't like us including JS files dynamically, so we're forced to disable it for
    //  the following line
    // eslint-disable-next-line
    blockObject = require(reportConfigurableHelper.getBlockJsLocation(templateBlockName));

    try {
      blockPromises[templateBlockName] = blockObject.build(organisationId, reportIds,
        additionalParameters);
    } catch (error) {
      Promise.reject('Failed to build block "' + templateBlockName + '" with error: ' + error);
    }
  });

  // Get all the data we need for the defined blocks
  return Promise.props(blockPromises).then((promiseResults) => {
    // Prepare the layout data if required
    _.each(promiseResults, function (promiseResult, templateBlockName) {
      // ESLint doesn't like us including JS files dynamically, so we're forced to disable it for
      //  the following line
      // eslint-disable-next-line
      blockObject = require(reportConfigurableHelper.getBlockJsLocation(templateBlockName));

      if (typeof blockObject.prepare === 'function') {
        try {
          promiseResults[templateBlockName] = blockObject.prepare(promiseResult);
        } catch (error) {
          Promise.reject('Failed to prepare block "' + templateBlockName + '" with error: ' + error);
        }
      }
    });

    const layoutData = {
      layout_blocks: promiseResults,
      reports_directory: reportConfigurableHelper.getRootDirectory()
    };

    // And generate the template
    try {
      html = compiledTemplate(layoutData);
    } catch (error) {
      return Promise.reject('Compiled template failed to build with error: ' + error);
    }

    return html;
  }, function (blockPromisesError) {
    return Promise.reject('A block promise failed to run with error: ' + blockPromisesError);
  });
}


module.exports = {
  generateReportHtml
};

const partialName = 'header';
const reportConfigurableHelper = require('../../../helpers/report-configurable');
const handlebars = require('handlebars');

const build = () => {
  handlebars.registerPartial(partialName,
    reportConfigurableHelper.fsReadBlockTemplate(partialName));
};

module.exports.build = build;
module.exports.partialName = partialName;

const models = require('../db_models');

const getServicesSlugs = async (completeResponse) => {
    // Make a query and get the services from database
    const args = {
        attributes: ['id', 'name', 'short'],
        where: { active: 1 }, // only active services condition
        raw: true
    };
    try {
        const services = await models.Service.findAll(args);
        if (services === null || services.length === 0) {
            return [];
        } else {
            if (completeResponse) {
                let slug = {};

                services.map(service => {
                    slug[service.short] = { short: service.short, id: service.id };
                });

                return slug;
            } else {
                let slugs = [];

                services.map(service => {
                    slugs.push(service.short);
                });

                return slugs;
            }
        }
    } catch (e) {
        return [];
    }
};

module.exports = {
    getServicesSlugs
};

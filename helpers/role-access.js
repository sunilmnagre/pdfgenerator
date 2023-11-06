const _ = require('lodash');
const config = require('config');

/**
 * Check if user has permission to access the resource and return the status
 * @param {Object[]} capabilities - Objects of role and capabilties that is assigned to the user
 * @param {Object[]} roleSlugObjects - Object of roles to be cross checked
 * @return {Boolean} - returns the Object of access info
 */
const getAccessStatus = (capabilities, roleSlugObjects) => {
    let groupedByAction = _.groupBy(roleSlugObjects, 'isAction');
    let accessStatus = {
        slugList: []
    };

    _.each(capabilities, (capability) => {
        _.forOwn(groupedByAction, (actionCapabilities, isAction) => {
            let groupedRoleSlug = _.groupBy(actionCapabilities, 'slug');

            if (isAction.toString().toLowerCase() === 'true') {

                let capabilityActions = capability.actions && capability.actions.length > 0 ? capability.actions : [];

                _.each(capabilityActions, (capabilityAction) => {
                    if (groupedRoleSlug[capabilityAction.slug] && groupedRoleSlug[capabilityAction.slug][0] && capabilityAction.access && capabilityAction.access.length > 0 && capabilityAction.access.indexOf(groupedRoleSlug[capabilityAction.slug][0].access) > -1) {
                        accessStatus.slugList.push(groupedRoleSlug[capabilityAction.slug][0]);
                    }
                });
            } else {
                if (groupedRoleSlug[capability.slug] && groupedRoleSlug[capability.slug][0] && capability.access && capability.access.length > 0 && capability.access.indexOf(groupedRoleSlug[capability.slug][0].access) > -1) {
                    accessStatus.haveAccess = true;
                    accessStatus.slugList.push(groupedRoleSlug[capability.slug][0]);
                }
            }
        });
    });

    return accessStatus;
};

/**
 * Check and return list of slugs accessible by the user
 * @param {Object[]} roleSlugObjects - Object of roles to be cross checked
 * @param {Object[]} userInfo - Object of user info got from access token
 * @return {Object[]} - returns Objects of slug list
 */
const getAccessibleSlug = (roleSlugObjects, userInfo) => {
    let slugList = [];
    let roleCapabilities = userInfo.capabilities;

    if (userInfo.user_type === config.user_type.SuperAdmin) {
        slugList = roleSlugObjects;
    } else {
        if (roleCapabilities && roleCapabilities.length > 0) {
            _.each(roleCapabilities, (roleCapability) => {
                if (roleCapability && roleCapability.service && roleCapability.service.capabilities && roleCapability.service.capabilities.length > 0) {
                    const capabilities = roleCapability.service.capabilities;

                    slugList = slugList.concat(getAccessStatus(capabilities, roleSlugObjects).slugList);
                }
            });
        }
    }

    return slugList;
};

module.exports = {
    getAccessibleSlug
};
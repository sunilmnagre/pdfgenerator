const _ = require('lodash');
const config = require('config');

const PRIVILE_ESCALATIONS = [
    {
        privilegeEscalation: 'none',
        parameters: []
    },
    {
        privilegeEscalation: 'su',
        parameters: [
            { name: "escalationPassword", mandatory: false },
            { name: "escalationPath", mandatory: false },
            { name: "escalationUsername", mandatory: false }]
    },
    {
        privilegeEscalation: 'sudo',
        parameters: [
            { name: "escalationPassword", mandatory: false },
            { name: "escalationPath", mandatory: false },
            { name: "escalationUsername", mandatory: false }]
    },
    {
        privilegeEscalation: 'su+sudo',
        parameters: [
            { name: "escalationPassword", mandatory: false },
            { name: "escalationPath", mandatory: false },
            { name: "escalationUsername", mandatory: false },
            { name: "escalationSuUser", mandatory: true }
        ]
    }, {
        privilegeEscalation: 'dzdo',
        parameters: [
            { name: "escalationPassword", mandatory: false },
            { name: "escalationPath", mandatory: false },
            { name: "escalationUsername", mandatory: false }]
    },
    {
        privilegeEscalation: 'pbrun',
        parameters: [
            { name: "escalationPassword", mandatory: true },
            { name: "escalationPath", mandatory: false }]
    },
    {
        privilegeEscalation: 'cisco',
        parameters: [{ name: "escalationPassword", mandatory: true }]
    },
    {
        privilegeEscalation: '.k5login',
        parameters: [
            { name: "escalationUsername", mandatory: true }]
    }
]


const privilegeEscalations = (privilegeEscalation) => {
    const privilege = PRIVILE_ESCALATIONS.find( item => item.privilegeEscalation === privilegeEscalation);
    return privilege;
}

/**
* Validate credentials mandatory fields
* @param {String} params Request params
* @return {Array} Error
*/
const validateMondatoryParams = async (params) => {
    const erros = [];
    const attributes = ['name', 'type', 'authType'];

    attributes.forEach(attribute => {
        if (!params.hasOwnProperty(attribute) || !params[attribute]) {
            erros.push(attribute);
        }
    });
    return erros;
}

/**
* Map parameters for mongo
* @param {Object} requestBody Request body
* @param {Object} tenableResult tenable result
* @return {Array} Error
*/
const mapParamsForMongo = async (requestBody, tenableResult) => {
    if (requestBody.type == 'SSH' && requestBody.authType == 'Publickey' && tenableResult.response && tenableResult.response.typeFields && tenableResult.response.typeFields.privateKey) {
        requestBody.publickKeyFile = tenableResult.response.typeFields.privateKey;
    }    

    if (requestBody && requestBody.password) {
        requestBody.password = 'SET';
    }

    if (tenableResult.response && tenableResult.response.typeFields && tenableResult.response.typeFields.password == 'SET') {
        requestBody.password = 'SET';
    }


    if (requestBody && requestBody.escalationPassword) {
        requestBody.escalationPassword = 'SET';
    }

    if (tenableResult.response && tenableResult.response.typeFields && tenableResult.response.typeFields.escalationPassword == 'SET') {
        requestBody.escalationPassword = 'SET';
    }

    if (requestBody && requestBody.passphrase) {
        requestBody.passphrase = 'SET';
    }

    if (tenableResult.response && tenableResult.response.typeFields && tenableResult.response.typeFields.passphrase == 'SET') {
        requestBody.passphrase = 'SET';
    }

    requestBody.tenable_credential_id = tenableResult.response.id;
    requestBody.modifiedTime = tenableResult.response.modifiedTime;
    requestBody.createdTime = tenableResult.response.createdTime; 

    return requestBody;
}    

/**
* Map parameters for tenable
* @param {Object} data Request body
* @return {Array} Error
*/
const mapParamsForTenable = async (data) => {
    const { type, authType, privilegeEscalation } = data;
    const privilege = privilegeEscalation == "" || privilegeEscalation === undefined ? 'None' : privilegeEscalation;
    let fields = {
        name: data.name,
        description: data.description,
        type: type.toLowerCase(),
    };
    if (data.password != "" && data.password != null) { fields.password = data.password; }
    switch (type) {
        case 'SSH':
            if (authType === 'Password') {
                fields.authType = authType.toLowerCase();
                fields.username = data.username;
                fields.privilegeEscalation = privilege.toLowerCase();
                if (fields.privilegeEscalation) {
                    const prParameters = privilegeEscalations(fields.privilegeEscalation);
                    const privileges = prParameters.parameters || [];
                    privileges && privileges.map(privilege => {
                        if (privilege.name ==='escalationPassword' && data.escalationPassword !== ''  && data.escalationPassword !== null) {
                            fields.escalationPassword = data.escalationPassword;
                        } else if (privilege.name !== 'escalationPassword') {
                            fields[privilege.name] = data[privilege.name];
                        }
                    });
                }
            } else if (authType === 'Publickey') {
                fields.authType = 'publicKey';
                fields.username = data.username;
                fields.privateKey = data.publickKeyFile;
                fields.privilegeEscalation = privilege.toLowerCase();  
                if ( data.passphrase && data.passphrase !== '' && data.passphrase !== null) {
                    fields.passphrase = data.passphrase;
                }
                if (fields.privilegeEscalation) {
                    const prParameters = privilegeEscalations(fields.privilegeEscalation);
                    const privileges = prParameters.parameters || [];
                    privileges && privileges.map(privilege => {
                        if (privilege.name === 'escalationPassword' && data.escalationPassword !== '' && data.escalationPassword !== null) {
                            fields.escalationPassword = data.escalationPassword;
                        } else if(privilege.name !== 'escalationPassword' ) {
                            fields[privilege.name] = data[privilege.name];
                        }
                    });
                }
            }
            break;
        case 'SNMP':
            fields.communityString = data.communityString;
            break;
        case 'Windows':
            if (authType === 'Password') {
                fields.authType = authType.toLowerCase();
                fields.username = data.username;
                fields.domain = data.domain || '';
            }
            break;
        case 'Database':
            if (authType === 'Oracle' || authType === 'MySQL') {
                const port = authType === 'MySQL' ? 3306 : 1521;
                fields.authType = 'password';
                fields.dbType = authType;
                fields.port = port;
                fields.login = data.username;

                if (authType === 'Oracle') {
                    fields.oracleAuthType = 'Normal';
                    fields.oracle_service_type = 'SID';
                }
            }
            break;
    }
    return fields;
};

/**
* Map result
* @param {Object} request Request body
* @param {Object} result tenable result
* @return {Array} Error
*/
const mapGetResult = (request, result) => {
    let limit = request.query.limit || config.pagination.itemsPerPage;
    let page = request.query.page || 0;
    let sortBy = request.query.sortBy || 'name';
    let filterBy = request.query.filterBy || '';    
    let total = 0;
    if (Object.keys(request.query).length === 0) {       
        // GET credentials for scan schedule      
        result = _.chain(result)
        .groupBy('type')
        .map((value, key) => {
            let keys = {};
            let keyValue = key === "windows" || key === "database" ? key.charAt(0).toUpperCase() + key.slice(1) : key.toUpperCase();
            keys[keyValue] = value;
            return keys;
        }).value();
        return result;
    } else {    
         // GET credentials for list
        total = result.length;
        if (filterBy) {                   
            result =_.filter(result, (item) => {
                return item.name.indexOf(filterBy)>-1;
            }); 
            total = result.length;                      
        }

        result = _.chain(result)
        .orderBy(sortBy, ['asc'])
        .drop((page - 1) * limit) 
        .take(limit)                       
        .value();               
        return {total, credentials: result}
    }  
}

module.exports = { 
    validateMondatoryParams,
    mapParamsForMongo,
    mapParamsForTenable,
    mapGetResult
};
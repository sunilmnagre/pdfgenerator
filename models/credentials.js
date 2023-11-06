const config = require('config');
const mongo = require('../helpers/mongo');
const credentialsDocument = config.mongo.tables.credentials;

const _findOne = async (organisationId, credentialQuery, credentialProjection = {}) => {
    return await mongo.findOne(organisationId, credentialsDocument, credentialQuery, credentialProjection);
};

const _insert = async (organisationId, credentialQuery) => {
    return await mongo.insert(organisationId, credentialsDocument, credentialQuery);
};

const _updateOne = async (organisationId, credentialQuery, credentialProjection) => {
    return await mongo.updateOne(organisationId, credentialsDocument, credentialQuery, credentialProjection);
};


const _collection = async (organisationId, tenableIds) => { 
    try {
        credentialCollection = await mongo.collection(organisationId, credentialsDocument);    
        if (credentialCollection) {
            syncTenable(organisationId, credentialCollection, tenableIds);
            return credentialCollection.aggregate([
                { $match: { $or: [ {'is_tenable_deleted': false },  { 'is_tenable_deleted': { $exists: false } } ],
                        
                            tenable_credential_id : {
                                $in: tenableIds
                            }           
                            }           
                }           
            ]).toArray();
        } else {
            return null;
        }        
    } catch (error) {
        return error;
    }   
}

const syncTenable = async (organisationId, credentialCollection, tenableIds) => {
    try { 
        const mongoIds = [];
        let credentials = await credentialCollection.aggregate([
            { $match: { $or: [ {'is_tenable_deleted': false },  { 'is_tenable_deleted': { $exists: false } } ] } }           
        ]).toArray();

        Object.keys(credentials.map((result, obj) => {
            mongoIds.push(result.tenable_credential_id);
        }, {}));

        const difference = mongoIds.filter(d => !tenableIds.includes(d));    
        if (difference && difference.length > 0) {
            await mongo.updateMany(organisationId, credentialsDocument,
            { tenable_credential_id: { $in: difference } },
            { $set: { is_tenable_deleted: true } });
        }        
    } catch (error) {
        console.log(error);        
    }
}

module.exports = { 
    _findOne,
    _insert,
    _collection,
    _updateOne
};

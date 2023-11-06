/**
 * 
 * @param {String} num 
 */
const isNumeric = (num) => /^-{0,1}\d*\.{0,1}\d+$/.test(num);

const severites = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }
/**
 * 
 * @param {String} fieldValue 
 */
const getSeverity = (fieldValue) => {
    const keys = Object.keys(severites);
    let value = null;
    keys.map(key => {
        if (key.includes(fieldValue.toLowerCase())) {
            value = severites[key];
        }
    });
    return value;
}

/**
 * 
 * @param {String} fieldValue 
 * @param {Object} fields 
 * @param {Boolean} iscontainNumericfields 
 */
const buildFilterByAttributeQuery = (fieldValue, fields = {}, iscontainNumericfields = false) => {
    const query = [];
    if (iscontainNumericfields && isNumeric(fieldValue)) {
        fields.numericFields && fields.numericFields.map(field => {
            query.push({ [field]: field === 'count' ? Number(fieldValue) : fieldValue })
        });
    } else {
        fields.textFields && fields.textFields.map(field => {
            query.push({ [field]: field === 'severity' ? getSeverity(fieldValue) : { $regex: new RegExp(fieldValue), $options: 'i' } })
        });
    }
    return query;
};

module.exports = {
    buildFilterByAttributeQuery
};

const snmp = require("net-snmp");
const config = require('config');

// Default options
const options = {
    port: config.snmp.port,
    retries: config.snmp.retries,
    timeout: config.snmp.timeout,
    transport: config.snmp.transport,
    trapPort: config.snmp.trapPort,
    version: snmp.Version2c,
    idBitsSize: config.snmp.idBitsSize
};


/**
 *
 * @param vulenerabilityObj
 * @param customerInfo
 * @returns {string}
 */
const getSNMPMessageFormatted = (vulenerabilityObj,customerInfo) => {

    let snmpMessage = "";
    const snmpTrapObjects = [
        'protocol','tenable_scan_id','count','cve_numbers',
        'portInfo','target','description','risk_factor',
        'tenable_plugin_id','name','severity','customer_id',
        'customer_name','solution'
    ];
    snmpMessage =   snmpMessage + 'id:' +  vulenerabilityObj._id;
    snmpTrapObjects.forEach(messageKey => {
        if(messageKey !== 'customer_name' && messageKey !== 'customer_id'){
            const formattedValue = messageKey + ':' + vulenerabilityObj[messageKey]
            if (snmpMessage.length < 1) {
                snmpMessage = formattedValue;
            } else {
                snmpMessage = snmpMessage + '||' + formattedValue;
            }
        }
    });
    snmpMessage =   snmpMessage + '||' + 'customer_id:' +  customerInfo.customer_id;
    snmpMessage =   snmpMessage + '||' + 'customer_name:' +  customerInfo.customer_name;
    //   let snmpMessage=  "d:5d08933e32e2a54c0260034d || tenable_scan_id : 34chandu || tenable_host_id : 34 || target : 167.99.94.158 || protocol : TCP || portInfo : 8834 ||cvss :  || cve_numbers : [] || port : 8834/TCP || tenable_plugin_id : 10147 || name : Nessus Server Detection ||synopsis : A Nessus daemon is listening on the remote port. || severity : 7 || description : A Nessus daemon is listening on the remote port. || solution : Ensure that the remote Nessus installation has been authorized. || risk_factor : None  || count : 61 || searchable_id : 418319 ||title : sample ticket new description: sample description"
    return snmpMessage;
};

/**
 *
 * @param vulenerability
 * @param customerInfo
 */
const sendSnmpTrap = (vulenerability, customerInfo) => {
    const session = snmp.createSession(config.snmp.host, config.snmp.community, options);


    const varbinds = [
        {
            oid: "1.3.6.1.4.1.24000.0.3",
            type: snmp.ObjectType.OctetString,
            value: getSNMPMessageFormatted(vulenerability,customerInfo)
        },

    ];

// version 2c should have been specified when creating the session
    session.trap("1.3.6.1.4.1.24000.3", varbinds, function (error) {
        if (error) console.error(error);
    });

}
module.exports = {
    sendSnmpTrap: sendSnmpTrap,
};

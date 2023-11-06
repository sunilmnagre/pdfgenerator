const config = require('config');
const request = require('axios');

const getConfigurations = async (service_id, sync='1', headers) => {
    try {
    
      const options = {
        url:config.adminModule.config+ '?service_id='+service_id + '&sync='+sync,
        method: 'GET',
        timeout: 90000,
        json: true,
        proxy: false
      };
      const response = await request(options);
      if (response && response.data && response.data.data && response.data.data.rows ) {
          const configs = response.data.data.rows;
        configs && configs.map(config => {
            process.env[config.title] = JSON.stringify(config.configuration)
          })
        return response.data.data.rows; 
      }
      return {};
    } catch (error) {
      return error ;
    }
  };



module.exports = {
    getConfigurations
};
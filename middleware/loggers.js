const winston = require('winston');
require('winston-daily-rotate-file');
const elasticsearch = require('winston-elasticsearch');
const config = require('config');
const chalk = require('chalk');

const accessLogger = (req, res, next = null) => {
    let errorMessage = null; 
    const oldSend = res.send;
    res.send = (data) => {      
        let resData =  data && req.originalUrl.indexOf('csv') === -1 && req.originalUrl.indexOf('reports/view/') === -1 ? JSON.parse(data) : null;                   
        if (resData && resData.status === 'fail' && resData.data) {
            errorMessage = JSON.stringify(resData.data);                   
        }
        res.send = oldSend;
        return res.send(data);   
    }

    res.on('finish', () => { 
        if (res.statusCode !== 304) {       
            const [reqUrl, logging] = [req.originalUrl, config.logging];
            let _index = _type = logging.access;
            let remoteAddress = 0;
            let responseTime = res && res._headers && res._headers['x-response-time'] ? res._headers['x-response-time'] : null;

            if (res.statusCode > 299) {
                _index = _type = logging.exception;
            }

            const client = req.EClient;  
            const esTransportOpts = { 
                index: _index,
                messageType: _type,
                level: 'info',
                client
            };

            let fileName = _type === logging.access ? logging.accessLogFile : logging.exceptionLogFile;
            const fileInfo = {
              filename: fileName + '-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              level: esTransportOpts.level
            };
      
            const logger = winston.createLogger({
              level: esTransportOpts.level,
              format: winston.format.json(),
              transports: [
                new winston.transports.DailyRotateFile(fileInfo),
                new elasticsearch(esTransportOpts)
              ]
            });      

            remoteAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            if (remoteAddress.substr(0, 7) === '::ffff:') {
                remoteAddress = remoteAddress.substr(7)
            }

            if (req && req.body && req.body.password) {
                req.body.password = 'SET';
            }          
                
            if (req && req.body && req.body.severity) {
                req.body.severity = `${req.body.severity }`;      
            }

            logger.info(getTitle(req),
                {
                    ip: remoteAddress,
                    module: 'VM',
                    userAgent: req.headers['user-agent'],
                    url: reqUrl,
                    method: req.method,
                    parameters: req.params || null,
                    meta: req.body,
                    actionById: req && req.decoded && req.decoded.id ? req.decoded.id : null,
                    actionByUserName: getUserName(req),
                    actionByFirstName: getDisplayName(req),
                    statusCode: res.statusCode,
                    output: errorMessage,
                    timeTaken: responseTime
                }
            );    
        }    
    });
    next();
}

const getUserName = (req) => req && req.decoded && req.decoded.username ? req.decoded.username : null;
const getDisplayName = (req) => req && req.decoded && req.decoded.first_name ? req.decoded.first_name : null; 

const getTitle = (req) => {
    let [title, module] = [null, 'Action']; 
    const path = req.route.path;
    const method = req && req.method ? req.method : null; 
    let actionBy = !getDisplayName(req) ? '' : ' by ' + getDisplayName(req) + '(' + getUserName(req) + ')';  
    const operation = {
        GET: 'Fetched',
        POST: 'Added / Modified',
        PUT: 'Added / Modified',
        PATCH: 'Added / Modified',
        DELETE: 'Deleted',
    }  
      
    if (path && path != '/*') {        
        let pathArray = path.split('/');        
        let pathArrayLen = pathArray.length;
        for (let i = pathArrayLen; i >= 0; i--) {
            if (pathArray[i] && pathArray[i].indexOf(':') !== -1) {
                continue;
            } else if (pathArray[i] && pathArray[i] != '') {               
                module = pathArray[i];
                break;
            }
        }
    }    
    module = module[0].toUpperCase() + module.slice(1);

    title = `${module} ${operation[method]}${actionBy}`;
    return title;    
}

const esPing = (client) => {    
    client.ping({}, (error) => {
        if (!error) {
            console.log(chalk.green('Elasticsearch connected'));
        } else if (error.meta && error.meta.statusCode && error.meta.statusCode === 401) {               
            console.log(chalk.red('Elasticsearch authentication fail'));
        } else if (error.meta && error.meta.statusCode == null) {
            console.log(chalk.red('Elasticsearch ' + error.name));               
        }
    });  
};

module.exports = {   
  accessLogger,
  esPing
};
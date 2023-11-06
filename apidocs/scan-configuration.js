/**
* @apiVersion 1.0.0
* @apiGroup Scan Schedule
* @apiName getPolicies
* @api {get} /api/v1/org-scan-configs/:id/policies Get scan policies
* 
* @apiExample Examples
*    /api/v1/org-scan-configs/935/policies
*    
* @apiParam {Number} id Organization ID
*
* @apiSuccessExample Successful response:
*   {
*       "status": "success",
*       "data": [
*           {
*               "id": "2",
*               "name": "mssp",
*               "description": "",
*               "status": "0"
*           },
*           {
*               "id": "1000002",
*               "name": "CIS Policy for RHEL POC",
*               "description": "",
*               "status": "0"
*           },
*           {
*               "id": "1000003",
*               "name": "VA Scanning Advanced scan Policy",
*               "description": "",
*               "status": "0"
*           }
*       ]
*   }
* 
* @apiErrorExample {json} Error-Response:
*   HTTP/1.1 404 Not Found
*   {
*       "status": "fail",
*       "data": [
*           "No organisation with this ID found"
*       ]
*   }
* @apiErrorExample {json} Error-Response:
*   HTTP/1.1 422 Unprocessible request
*   {
*       "status": "fail",
*       "data": "Communication error between MSS and Tenable"
*   }
*/
//////////////    End of /org-scan-configs/:id/policies   //////////////

/**
* @apiVersion 1.0.0
* @apiGroup Scan Schedule
* @apiName getRepositories
* @api {get} /api/v1/org-scan-configs/:id/repositories Get scan repositories
* 
* @apiExample Examples
*    /api/v1/org-scan-configs/935/repositories
*    
* @apiParam {Number} id Organization ID
*
* @apiSuccessExample Successful response:
*   {
*       "status": "success",
*       "data": [
*           {
*               "id": "2",
*               "name": "Inspyretek Repo",
*               "description": "",
*               "dataFormat": "IPv4"
*           }
*       ]
*   }
* 
* @apiErrorExample {json} Error-Response:
*   HTTP/1.1 404 Not Found
*   {
*       "status": "fail",
*       "data": [
*           "No organisation with this ID found"
*       ]
*   }
* @apiErrorExample {json} Error-Response:
*   HTTP/1.1 422 Unprocessible request
*   {
*       "status": "fail",
*       "data": "Communication error between MSS and Tenable"
*   }
*/
//////////////    End of /org-scan-configs/:id/repositories   //////////////

/**
* @apiVersion 1.0.0
* @apiGroup Scan Schedule
* @apiName getCredentials
* @api {get} /api/v1/org-scan-configs/:id/credentials Get scan credentials
* 
* @apiExample Examples
*    /api/v1/org-scan-configs/935/credentials
*    
* @apiParam {Number} id Organization ID
*
* @apiSuccessExample Successful response:
*   {
*       "status": "success",
*       "data": [
*        {
*            "ssh": [
*                {
*                    "id": "1000001",
*                    "name": "Inspyretek Server User",
*                    "description": "",
*                    "type": "ssh"
*                },
*                {
*                    "id": "1000002",
*                    "name": "IBM lab password",
*                    "description": "",
*                    "type": "ssh"
*                }
*            ]
*        }
*   }
* 
* @apiErrorExample {json} Error-Response:
*   HTTP/1.1 404 Not Found
*   {
*       "status": "fail",
*       "data": [
*           "No organisation with this ID found"
*       ]
*   }
* @apiErrorExample {json} Error-Response:
*   HTTP/1.1 422 Unprocessible request
*   {
*       "status": "fail",
*       "data": "Communication error between MSS and Tenable"
*   }
*/
//////////////    End of /org-scan-configs/:id/credentials   //////////////

/**
* @apiVersion 1.0.0
* @apiGroup Scan Schedule
* @apiName getCredentialTypes
* @api {get} /api/v1/org-scan-configs/credentials/types Get credentials types
* 
* @apiExample Examples
*    /api/v1/org-scan-configs/credentials/types
*    
* @apiSuccessExample Successful response:
*   {
*       "status": "success",
*      "data": [
*           {
*               "type": "Database",
*               "authType": [
*                   "Mysql",
*                   "Oracle"
*               ]
*           },
*           {
*               "type": "SNMP",
*               "authType": [
*                   "SNMP"
*               ]
*           },
*           {
*               "type": "SSH",
*               "authType": [
*                   "Password",
*                   "Publickey"
*               ]
*           },
*           {
*               "type": "Windows",
*               "authType": [
*                   "Password"
*               ]
*           }
*       ]
*   }
* 
* @apiErrorExample {json} Error-Response:
*   HTTP/1.1 404 Not Found
*   {
*       "status": "fail",
*       "data": Credential types not found"
*   }
*/
//////////////    End of /org-scan-configs/credentials/types  //////////////

/**
* @apiVersion 1.0.0
* @apiGroup Scan Schedule
* @apiName addCredentials
* @api {post} /api/v1/org-scan-configs/:id/credentials Create
* 
* @apiExample Examples
*    /api/v1/org-scan-configs/935/credentials
* 
* @apiParam {Number} id Organization ID
* 
* @apiParamExample {json} POST JSON
*   {
*       "name": "Inspiretek",
*       "description": "new crediancial",
*       "type": "snmp",
*       "subtype": "password",
*       "username": "John",
*       "password": "1234qwer",
*       "publickKeyFile": "testing",
*       "community":"crediantial community",
*       "privilege": "none"
*   }
* 
* @apiSuccessExample Successful response:
*   {
*       "status": "success",
*       "data": "Successfully created"
*   }
* 
* @apiErrorExample {json} Error-Response:
*   HTTP/1.1 422 Unprocessible request
*   {
*       "status": "fail",
*       "data": "Communication error between MSS and Tenable"
*   }
*/
//////////////    End of /api/v1/org-scan-configs/:id/credentials   //////////////

/**
* @apiVersion 1.0.0
* @apiGroup Scan Schedule
* @apiName updateCredentials
* @api {patch} /api/v1/org-scan-configs/:id/credentials/:credentialId Update
* 
* @apiExample Examples
*    /api/v1/org-scan-configs/935/credentials/1000012
* 
* @apiParam {Number} id Organization ID
* @apiParam {Number} credentialId Credential ID
* 
* @apiParamExample {json} POST JSON
*   {
*       "name": "Inspiretek",
*       "description": "new crediancial",
*       "type": "snmp",
*       "subtype": "password",
*       "username": "John",
*       "password": "1234qwer",
*       "publickKeyFile": "testing",
*       "community":"crediantial community",
*       "privilege": "none"
*   }
* 
* @apiSuccessExample Successful response:
*   {
*       "status": "success",
*       "data": "Successfully updated"
*   }
* 
* @apiErrorExample {json} Error-Response:
*   HTTP/1.1 422 Unprocessible request
*   {
*       "status": "fail",
*       "data": "Communication error between MSS and Tenable"
*   }
*/
//////////////    End of /api/v1/org-scan-configs/:id/credentials/:credentialId   //////////////

/**
 * @apiVersion 1.0.0
 * @apiGroup Scan Schedule
 * @apiName deleteCredentials
 * @api {delete} /api/v1/org-scan-configs/:id/credentials/:credentialId  Delete
 * 
 * @apiExample Example
 *    /api/v1/org-scan-configs/935/credentials/1000012
 * 
 * @apiParam {Number} id Organization ID 
 * @apiParam {Number} credentialId Credential ID
 *
 * @apiSuccessExample Successful response:
 *     {
 *      "status": "success",
 *      "data": "Successfully deleted"
 *     }
 * 
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 422 Unprocessible request
 *     {
 *       "status": "fail",
 *       "data": "Communication error between MSS and Tenable"
 *     }
 */
//////////////    End of /api/v1/org-scan-configs/:id/credentials/:credentialId   //////////////
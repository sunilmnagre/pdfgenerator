/**
 * @apiVersion 1.0.0
 * @apiGroup Scan Operations
 * @apiName deleteScan
 * @api {delete} /api/v1/org-scan-operations/:id/scans/:scanID Delete
 * 
 * @apiExample Example
 *    /api/v1/org-scan-operations/935/scans/5ebb8830f6646d0c3908154d
 * 
 * @apiParam {Number} id Organization ID 
 * @apiParam {Number} scanID Scan ID 
 *
 * @apiSuccessExample Successful response:
 *     {
 *      "status": "success",
 *      "data": "Scan successfully deleted"
 *     }
 * 
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 422 Unprocessible request
 *     {
 *       "status": "fail",
 *       "data": "Scan does not exist"
 *     }
 */
//////////////    End of /api/v1/org-scan-operations/:id/scans/:scanID   //////////////

/**
 * @apiVersion 1.0.0
 * @apiGroup Scan Operations
 * @apiName scanResults
 * @api {get} /api/v1/org-scan-operations/:id/scan-results/ scan results
 *
 * @apiExample Example
 *    /api/v1/org-scan-operations/935/scan-results/17
 *
 * @apiParam {Number} id Organization ID
 *
 * @apiSuccessExample Successful response:
 {
    "status": "success",
    "data": [
        {
            "status": "Partial",
            "name": "tcs_analysis_scan",
            "details": "mssp",
            "diagnosticAvailable": "false",
            "importStatus": "No Results",
            "createdTime": "1588235541",
            "startTime": "1588235544",
            "finishTime": "1588278759",
            "importStart": "-1",
            "importFinish": "-1",
            "running": "false",
            "totalIPs": "1",
            "scannedIPs": "0",
            "dataFormat": "IPv4",
            "downloadAvailable": "false",
            "downloadFormat": "v2",
            "resultType": "active",
            "resultSource": "internal",
            "scanDuration": "43215",
            "id": "1",
            "completedIPs": "0",
            "completedChecks": "0",
            "totalChecks": "-1",
            "canUse": "true",
            "canManage": "true",
            "owner": {
                "id": "2",
                "username": "tdc_org_sm",
                "firstname": "tdc_org_sm",
                "lastname": "tdc_org_sm"
            },
            "ownerGroup": {
                "id": "0",
                "name": "Full Access",
                "description": "Full Access group"
            },
            "repository": {
                "id": "2",
                "name": "Inspyretek Repo",
                "description": ""
            }
        },
        {
            "status": "Running",
            "name": "scan_chandu_monthly",
            "details": "mssp",
            "diagnosticAvailable": "false",
            "importStatus": "No Results",
            "createdTime": "1590064007",
            "startTime": "1590064010",
            "finishTime": "-1",
            "importStart": "-1",
            "importFinish": "-1",
            "running": "true",
            "totalIPs": "2",
            "scannedIPs": "0",
            "dataFormat": "IPv4",
            "downloadAvailable": "false",
            "downloadFormat": "v2",
            "resultType": "active",
            "resultSource": "internal",
            "scanDuration": "83",
            "id": "9",
            "completedIPs": "0",
            "completedChecks": "8458",
            "totalChecks": "203182",
            "canUse": "true",
            "canManage": "true",
            "owner": {
                "id": "1",
                "username": "tdc_Sm",
                "firstname": "tdc_Sm",
                "lastname": "tdc_Sm"
            },
            "ownerGroup": {
                "id": "0",
                "name": "Full Access",
                "description": "Full Access group"
            },
            "repository": {
                "id": "2",
                "name": "Inspyretek Repo",
                "description": ""
            }
        }
    ]
}
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 422 Unprocessible request
 *     {
 *       "status": "fail",
 *       "data": "Failed to fetch results from Tenable"
 *     }
 */
//////////////    End of /api/v1/org-scan-operations/:id/scan-results/   //////////////


/**
 * @apiVersion 1.0.0
 * @apiGroup Scan Operations
 * @apiName launchScan
 * @api {post} /api/v1/org-scan-operations/:id/scan-launch/:scanID launch
 *
 * @apiExample Example
 *    /api/v1/org-scan-operations/935/scan-launch/17
 *
 * @apiParam {Number} id Organization ID
 * @apiParam {Number} scanID Scan ID
 *
 * @apiSuccessExample Successful response:
 *     {
 *      "status": "success",
 *      "data": "Scan successfully launched"
 *     }
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 422 Unprocessible request
 *     {
 *       "status": "fail",
 *       "data": "Scan launch is failed"
 *     }
 */
//////////////    End of /api/v1/org-scan-operations/:id/scan-launch/:scanID   //////////////
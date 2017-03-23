/* node modules */
var https = require('https');
var qs = require('querystring');
var sys = require('sys');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var fs = require('fs');
var parse = require('url').parse;
var querystring = require('querystring');
var request = require('request');

var logger = require('./lib/proxy/loggerWrapper.js');
var log = logger.generalLogger;

var mysql = require("mysql");
var async = require('async');
var csv = require('ya-csv');
var ncp = require('ncp');
var common = require('./scripts/auditfunctions.js');
/*  declarations */
var child_gen;
var CODE_SUCCESS = 200;
var CODE_ERROR = 500;
var UNAUATH_CODE = 401;
var MAX_NUMBER_OF_REQ_PER_UDID;
var MAX_NUMBER_OF_REQ_PER_IP;
var MAX_MINUTES_INTERVAL;
var INTERVAL = 1000 * 60;

var UDID_FIELD = "udid";
var IP_FIELD = "ip";
var UDID_AUDIT_REQUESTS_CERTS_TABLE = "log_requests_certs_per_udid";
var IP_AUDIT_REQUESTS_CERTS_TABLE = "log_requests_certs_per_ip";
var NUMBER_REQ_FIELD = "number_of_requests";
var AUDIT_TOTAL_REQUESTS_CERTS_TABLE = "total_requests_certs";
var MAX_NUMBER_OF_REQ_PER_DAY;
var path = require('path');
var SERVER_CERTS_PORT;
var constant = require('./scripts/constants.js');
var options = constant.certs;
var nrOfRequests = new Array();
var timestamp = (new Date()).getSeconds();
var numberOfRequestsPerSecond = 0;

var serverCertsAddress = constant.serverCertsAddress;
var writeRecordToCsv;
var uploadInProgress = false;
var writeInProgress = false;
var cleanInProgress = false;

var connection;

initConstants();

// create a default csv if not exists
createDefaultCsvIfNotExists();

// create server on https://54.77.65.230:8000
createServer();
setCSVUpload();

function setCSVUpload() {
    uploadCSV();
    setInterval(uploadCSV, 24 * 60 * 60 * 1000);
}

function uploadCSV() {
    if (!writeInProgress && !cleanInProgress) {
        let baseUrl = 'http://@ec2-54-171-175-5.eu-west-1.compute.amazonaws.com';
        // let baseUrl = 'https://level1support.rainmachine.com';
        
        let url = `${baseUrl}/index.php/nagios/importcsv?key=6ZN6h1duUtxI5hnCcpTsb1w6Az0vKq61`;
        
        uploadInProgress = true;
        
        log.info('Uploading sprinklers.csv');
        let formData = {
            csv_file: fs.createReadStream(path.join(__dirname + '/../resources/sprinklers.csv')),
        };
        
        request.post({
            url: url,
            formData: formData
        }, (err, response, body) => {
            
            if (err) {
                log.error(`Unable to upload the csv - ${err}`);
                uploadInProgress = false;
            } else {
                log.info(`Upload complete - ${body}`);
                
                uploadInProgress = false;
            }
            
        });
    } else {
        console.log(`Write/Clean in progress. Waiting to upload`);
        setTimeout(uploadCSV, 100);
    }
    
}

function initConstants() {
    var config = {
        host: constant.DATABASE_HOST,
        user: constant.DATABASE_USER,
        password: constant.DATABASE_PASSWORD,
        database: constant.DATABASE_NAME,
        port: constant.DATABASE_PORT,
        acquireTimeout: constant.DATABASE_AQUIRE_TIMEOUT,
        connectionLimit: constant.DATABASE_CONN_LIMIT
    };
    
    SERVER_CERTS_PORT = constant.SERVER_PORT;
    MAX_NUMBER_OF_REQ_PER_UDID = constant.MAX_NUMBER_OF_REQ_PER_UDID;
    MAX_NUMBER_OF_REQ_PER_IP = constant.MAX_NUMBER_OF_REQ_PER_IP;
    MAX_MINUTES_INTERVAL = constant.MAX_MINUTES_INTERVAL;
    MAX_NUMBER_OF_REQ_PER_DAY = constant.MAX_REQUESTS_PER_DAY;
    connection = mysql.createPool(config);
}

function createDefaultCsvIfNotExists() {
    
    fs.readFile(__dirname + '/../resources/sprinklers.csv', 'utf8', function (err, data) {
        
        if (err && err.code == 'ENOENT') {
            
            // if csv doesn't exists create it with a default header
            writeRecordToCsv = csv.createCsvFileWriter(__dirname + '/../resources/sprinklers.csv', {'flags': 'a'});
            
            var csvData = new Array();
            csvData.push('sprinklerId');
            csvData.push('mac');
            csvData.push('UDID');
            
            writeRecordToCsv.writeRecord(csvData);
            log.info({msg: 'Created a new csv with default header', server: serverCertsAddress});
        }
    });
}

function getHeadersForCrossDomain() {
    // build the needed headers for the cross domain requests
    var headers = {};
    
    // IE8 does not allow domains to be specified, just the *
    //headers["Access-Control-Allow-Origin"] = req.headers.origin;
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Credentials"] = false;
    headers["Access-Control-Max-Age"] = '86400'; // 24 hours
    headers["Access-Control-Allow-Headers"] = "*";
    
    headers["Content-type"] = "application-type/json";
    headers["Transfer-Encoding"] = "chunked";
    headers["Connection"] = "keep-alive";
    
    return headers;
}

function addToWhiteList(sprinklerId, mac, udid, callback) {
    
    connection.getConnection(function (err, mysql_connection) {
        
        var code = CODE_SUCCESS;
        if (err) {
            log.error({msg: err, server: serverCertsAddress, sprinklerId: sprinklerId});
            code = CODE_ERROR;
            if (mysql_connection)
                mysql_connection.release();
            if (callback != null)
                callback(code);
        }
        else {
            insertIntoWhitelist(sprinklerId, mac, udid, mysql_connection, code, callback);
        }
    });
    
}

function insertIntoWhitelist(sprinklerId, mac, udid, mysql_connection, code, callback) {
    var insertQuery = "insert into auth_code_whitelist(SprinklerId, mac, UDID) values( '" +
        sprinklerId + "'," + mysql.escape(mac) + "," + mysql.escape(udid) + ");";
    
    mysql_connection.query(insertQuery, function (err, rows) {
        
        mysql_connection.release();
        if (err) {
            log.error({msg: err, server: serverCertsAddress, sprinklerId: sprinklerId, server: serverCertsAddress});
            code = CODE_ERROR;
        }
        
        log.info({msg: 'Added new record to whitelist', sprinklerId: sprinklerId, server: serverCertsAddress});
        if (callback != null)
            callback(code);
        
        log.info({
            msg: 'Added sprinkler to WhiteList: ' + insertQuery,
            server: serverCertsAddress,
            sprinklerId: sprinklerId
        });
        
    });
};

function selectNumberOfRequestsForThisSprinkler(connection, myUdid, mySprinklerId, myMac, response, callback) {
    connection.getConnection(function (err, mysql_connection) {
        if (!err) {
            // check the number of requests
            var checkQuery = "select number_of_requests from sprinkler_request_certs where hardware_id ='" +
                myUdid + "' ;";
            
            mysql_connection.query(checkQuery, function (err, rows) {
                if (err) {
                    mysql_connection.release();
                    log.error({msg: err, server: serverCertsAddress, sprinklerId: mySprinklerId});
                }
                else {
                    callback(mysql_connection, myUdid, mySprinklerId, myMac, response, rows);
                }
            });
        }
        else {
            log.error({msg: err, server: serverCertsAddress, sprinklerId: mySprinklerId});
            if (mysql_connection)
                mysql_connection.release();
        }
    });
}

function updateNumberOfRequestsForThisSprinkler(mysql_connection, myUdid,
                                                mySprinklerId, myMac, response, rows, callback) {
    var myQuery = "";
    if (rows.length != 0) {
        // need to update
        nrOfRequests[myUdid] = rows[0]["number_of_requests"] + 1;
        myQuery = "update sprinkler_request_certs set number_of_requests = " +
            nrOfRequests[myUdid] + " where hardware_id = '" + (myUdid) + "' ;";
    }
    else {
        // need to insert
        myQuery = "insert into sprinkler_request_certs(hardware_id, enabled, number_of_requests) VALUES('" +
            myUdid + "', 0, 1)" + ";";
        nrOfRequests[myUdid] = 1;
    }
    
    mysql_connection.query(myQuery, function (err, rows) {
        if (err) {
            log.error({msg: err, server: serverCertsAddress, sprinklerId: mySprinklerId});
            callback(mysql_connection, myUdid, mySprinklerId, myMac, response, CODE_ERROR);
        }
        else {
            log.debug({
                msg: "Inserted to request certs logs table: " + myQuery,
                server: serverCertsAddress,
                sprinklerId: mySprinklerId
            });
            callback(mysql_connection, myUdid, mySprinklerId, myMac, response, CODE_SUCCESS);
        }
    });
}

function writeDataToCsv(mySprinklerId, myMac, myUdid, finish) {
    if (!uploadInProgress && !cleanInProgress) {
        if (typeof(process.argv[2]) != "undefined" && process.argv[2] == "csv") {
            writeInProgress = true;
            writeRecordToCsv = csv.createCsvFileWriter(path.join(__dirname + '/../resources/sprinklers.csv'), {'flags': 'a'});
            writeRecordToCsv.writeStream.on('finish', () => {
                console.log('finished writing to csv');
                writeInProgress = false;
            });
            
            var csvData = new Array();
            csvData.push(mySprinklerId);
            csvData.push(myMac);
            csvData.push(myUdid);
            writeRecordToCsv.writeRecord(csvData);
            writeRecordToCsv.writeStream.end();
            
            log.info({
                msg: "Sprinkler with UDID: " + myUdid + " added to csv",
                server: serverCertsAddress,
                sprinklerId: mySprinklerId
            });
        }
        
        return finish();
    } else {
        console.log(`Upload/Clean in progress - ${mySprinklerId} waiting to write`);
        setTimeout(() => {
            writeDataToCsv(mySprinklerId, myMac, myUdid, finish);
        }, 100);
    }
    
}

function getProperty(field, body) {
    
    var myMac = "";
    var myUdid = "";
    var query = querystring.parse(body);
    
    if (query['mac'])
        myMac = query['mac'];
    if (query['udid'])
        myUdid = query['udid'];
    
    if (field == "mac")
        return myMac;
    else return myUdid;
    
}

function createServer() {
    // Configure our HTTP server
    
    var server = https.createServer(options, function (request, response) {
        
        var current_ts = (new Date()).getSeconds();
        if (current_ts == timestamp) {
            numberOfRequestsPerSecond++;
        } else {
            numberOfRequestsPerSecond = 1;
            timestamp = (new Date()).getSeconds();
        }
        
        if (numberOfRequestsPerSecond > constant.MAX_NUMBER_REQUESTS_PER_SECOND) {
            unauthorizedRequest(response, request, UNAUATH_CODE);
        }
        
        //mysql_connection = returnDatabaseInstance();
        var url = request.url || "";
        
        var headers = getHeadersForCrossDomain();
        
        // condition to work the cross domain requests
        if (request.method === "OPTIONS") {
            response.writeHead(200, headers);
            response.end();
        }
    
        var body = '';
        // collect post params
        request.on('data', function (data) {
            body += data;
        });
    
        request.on('end', function () {
            console.log(body);
    
            if (request.method === 'GET' && url === '/clean-csv') {
                log.info({msg: `Clean csv request`, sourceIPAddress: request.connection.remoteAddress});
        
                headers["Content-type"] = "text/plain";
        
                if (!writeInProgress && !uploadInProgress) {
                    cleanInProgress = true;
                    cleanCsv((err) => {
                        cleanInProgress = false;
                        if (err) {
                            response.writeHead(501, headers);
                            response.end(`Error while cleaning csv file - ${err}`);
                        } else {
                            response.writeHead(200, headers);
                            response.end('Cleanup successful');
                        }
                    });
                } else {
                    response.writeHead(401, headers);
                    if (writeInProgress) {
                        response.end('Write in progress');
                    } else if (uploadInProgress) {
                        response.end('Upload in progress');
                    }
                }
            }
    
            else if (request.method === 'GET' && url === '/limits') {
                log.info({msg: `GET limits request`, sourceIPAddress: request.connection.remoteAddress});
    
                return response.end({MAX_NUMBER_OF_REQ_PER_IP: constant.MAX_NUMBER_OF_REQ_PER_IP, MAX_NUMBER_OF_REQ_PER_UDID: constant.MAX_NUMBER_OF_REQ_PER_UDID});
            }
    
            else if (request.method === 'POST' && url === '/limits') {
                log.info({msg: `POST limits request`, sourceIPAddress: request.connection.remoteAddress});
    
                body = JSON.parse(body);
                console.log(body);
    
                headers["Content-type"] = "text/plain";
    
                fs.writeFile(path.join(__dirname, `../resources/server-limits.json`, JSON.stringify(body)), (err) => {
                    if (err) {
                        response.writeHead(500, headers);
                        response.end('Unable to save the server limits');
                    } else {
                        response.writeHead(200, headers);
                        response.end('Successfully saved the server limits');
                    }
                });
            }
    
            else if (request.method == 'POST' && url == "/getCerts") {
                log.debug({
                    msg: 'Request received from ' + request.connection.remoteAddress,
                    server: serverCertsAddress,
                    sourceIPAddress: request.connection.remoteAddress
                });
    
                var myMac = getProperty("mac", body);
                var myUdid = getProperty("udid", body);
                var ip = request.connection.remoteAddress;
                log.info({msg: 'Processing request from ' + ip, server: serverCertsAddress, sourceIPAddress: ip});
                // insert in the audit table if the udid/ip does not exists in the table
                common.setOrGetInfoInAuditTable(mysql, connection, UDID_FIELD, UDID_AUDIT_REQUESTS_CERTS_TABLE, myUdid,
                    myMac, response, CODE_ERROR, function (dateOfLastRequestForUdid) {
                        common.setOrGetInfoInAuditTable(mysql, connection, IP_FIELD, IP_AUDIT_REQUESTS_CERTS_TABLE, ip,
                            myMac, response, CODE_ERROR, function (dateOfLastRequestForIp) {
                    
                                // extract the total number of the requests + date of the last request for the  UDID
                                common.getNumberOfRequestsForInfo(connection, UDID_FIELD, UDID_AUDIT_REQUESTS_CERTS_TABLE, myUdid, response,
                                    CODE_ERROR, function (totalNumberOFRequestsPerUdid) {
                            
                                        common.getNumberOfRequestsForInfo(connection, IP_FIELD, IP_AUDIT_REQUESTS_CERTS_TABLE, ip,
                                            response, CODE_ERROR, function (totalNumberOFRequestsPerIp) {
                                    
                                                // test if the number of the requests per email or per ip are in the range
                                                log.info({
                                                    msg: 'Total Number of requests per UDID:' + totalNumberOFRequestsPerUdid + ' /IP:' + totalNumberOFRequestsPerIp,
                                                    server: serverCertsAddress,
                                                    sourceIPAddress: ip
                                                });
                                                if (totalNumberOFRequestsPerUdid < MAX_NUMBER_OF_REQ_PER_UDID
                                                    && totalNumberOFRequestsPerIp < MAX_NUMBER_OF_REQ_PER_IP) {
                                                    log.debug({
                                                        msg: ' Total # of requests ok for ' + ip,
                                                        server: serverCertsAddress,
                                                        sourceIPAddress: ip
                                                    });
                                        
                                                    // increment the number of requests per ip
                                                    totalNumberOFRequestsPerIp++;
                                                    var myUpdateQuery = common.constructUpdateQuery(mysql, IP_AUDIT_REQUESTS_CERTS_TABLE,
                                                        IP_FIELD, totalNumberOFRequestsPerIp, ip);
                                                    common.updateAuditTable(connection, myUpdateQuery, CODE_ERROR, response);
                                        
                                                    // increment the number of requests per udid
                                                    totalNumberOFRequestsPerUdid++;
                                                    var myUpdateQuery = common.constructUpdateQuery(mysql, UDID_AUDIT_REQUESTS_CERTS_TABLE,
                                                        UDID_FIELD, totalNumberOFRequestsPerUdid, myUdid);
                                                    common.updateAuditTable(connection, myUpdateQuery, CODE_ERROR, response);
                                        
                                                    // get total number of requests in the last 24 hours
                                                    common.setOrGetTotalNumberOfRequestsAndDateOfLastRequest(connection, NUMBER_REQ_FIELD, AUDIT_TOTAL_REQUESTS_CERTS_TABLE,
                                                        response, CODE_ERROR, function (numberOfRequests, dateOfLastRequest) {
                                                
                                                            var myUpdateQuery = "";
                                                            if (numberOfRequests < MAX_NUMBER_OF_REQ_PER_DAY) {
                                                                numberOfRequests++;
                                                    
                                                                myUpdateQuery = common.constructUpdateQuery(mysql, AUDIT_TOTAL_REQUESTS_CERTS_TABLE,
                                                                    null, numberOfRequests);
                                                                common.updateAuditTable(connection, myUpdateQuery, CODE_ERROR, response);
                                                    
                                                                // continue to the usual flow
                                                                buildSprinklerCerts(connection, myUdid, myMac, response, headers);
                                                            }
                                                
                                                            // if the number of requests is reached
                                                            else {
                                                    
                                                                var currentDate = new Date();
                                                    
                                                                // get time diff between current date and date from the last request in minutes
                                                                var timeDiff = Math.abs((currentDate.getTime() - dateOfLastRequest.getTime()) / INTERVAL);
                                                    
                                                                log.debug({
                                                                    msg: "timedif:: " + timeDiff,
                                                                    server: serverCertsAddress,
                                                                    sourceIPAddress: ip
                                                                });
                                                    
                                                                // need to test if the last 24 hours passed
                                                                if (timeDiff > MAX_MINUTES_INTERVAL) {
                                                        
                                                                    // reset to 0 the total number of requests
                                                                    myUpdateQuery = common.constructUpdateQuery(mysql, AUDIT_TOTAL_REQUESTS_CERTS_TABLE,
                                                                        null, 1);
                                                                    common.updateAuditTable(connection, myUpdateQuery, CODE_ERROR, response);
                                                        
                                                                    // continue to the usual flow
                                                                    buildSprinklerCerts(connection, myUdid, myMac, response, headers);
                                                                }
                                                                else {
                                                                    log.info({
                                                                        msg: 'Rejecting request from ' + ip,
                                                                        server: serverCertsAddress,
                                                                        sourceIPAddress: ip
                                                                    });
                                                                    unauthorizedRequest(response, request, UNAUATH_CODE);
                                                                }
                                                            }
                                                        });
                                                }
                                                // reject any request from that ip / udid
                                                else {
                                                    unauthorizedRequest(response, request, UNAUATH_CODE);
                                                }
                                            });
                                    });
                            });
                    });
            }
        });
        
    }).listen(SERVER_CERTS_PORT);
    log.info({msg: "Server is listening at port " + SERVER_CERTS_PORT, server: serverCertsAddress});
}

function cleanCsv(finish) {
    async.waterfall([
        // backup existing file
        (next) => {
            ncp.limit = 16;
            ncp(path.join(__dirname, `../resources/sprinklers.csv`), path.join(__dirname, `../resources/sprinklers${(new Date()).getTime()}.csv`), (err) => {
                console.log(err);
                return next(err);
            });
        },
        
        // clean the existing file
        (next) => {
            fs.writeFile(path.join(__dirname, `../resources/sprinklers.csv`), `"sprinklerId","mac","UDID"\n`, (err) => {
                return next(err);
            });
        }
    
    ], (end) => {
        return finish(end);
    });
}

function unauthorizedRequest(response, request, UNAUATH_CODE) {
    common.endRequest(response, UNAUATH_CODE);
    request.destroy();
}

function returnResponse(response, code, headers, myPostData) {
    if (code == CODE_ERROR) {
        response.writeHead(CODE_ERROR, headers);
    }
    else {
        response.writeHead(CODE_SUCCESS, headers);
        response.write(JSON.stringify(myPostData));
    }
    response.end();
}

function buildSprinklerCerts(connection, myUdid, myMac, response, headers) {
    
    var mySprinklerId;
    
    // make a random id for the sprinklerId
    makeid(function (valueOfSprinklerId) {
        mySprinklerId = valueOfSprinklerId;
        
        var myExecCommand = __dirname + '/../resources/genCloudClientCert.sh "' +
            myMac + '=:=' + myUdid + '=:=' + mySprinklerId + '"';
        
        var folderName = myMac + '=:=' + myUdid + '=:=' + mySprinklerId + '';
        
        executeScriptAndReturnPostData(myExecCommand, folderName, mySprinklerId,
            function (myPostData) {
                if (myPostData.key != null && myPostData.cert != null) {
                    if (myMac != "" && myUdid != "") {
                        selectNumberOfRequestsForThisSprinkler(connection, myUdid, mySprinklerId, myMac, response,
                            function (mysql_connection, myUdid, mySprinklerId, myMac, response, rows) {
                                
                                updateNumberOfRequestsForThisSprinkler(mysql_connection, myUdid, mySprinklerId, myMac, response, rows,
                                    function (mysql_connection, myUdid, mySprinklerId, myMac, response, code) {
                                        mysql_connection.release();
                                        if (code == CODE_ERROR) {
                                            returnResponse(response, CODE_ERROR, headers, myPostData);
                                        }
                                        else {
                                            // add the sprinkler to whiteList and return CODE_SUCCESS for a successful saving
                                            addToWhiteList(mySprinklerId, myMac, myUdid, function (code) {
                                                
                                                // for every sprinkler we need to write it in the csv
                                                writeDataToCsv(mySprinklerId, myMac, myUdid, () => {
                                                    // return response
                                                    returnResponse(response, code, headers, myPostData);
                                                });
                                            });
                                        }
                                    });
                            });
                    }
                    //invalid request parameters
                    else {
                        response.writeHead(CODE_ERROR, headers);
                        response.end();
                    }
                } else {
                    returnResponse(response, CODE_ERROR, headers, myPostData);
                }
            });
    });
}

/* generate a random id with 8 characters for every sprinkler */
function makeid(callback) {
    fs.readFile(__dirname + '/../resources/sprinklerIDPrefix.txt', function (err, data) {
        if (err) {
            log.error({msg: 'Unable to read sprinklerIDPrefix file', server: serverCertsAddress});
            //throw err;
            return;
        }
        
        var text = "";
        //var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var possible = "abcdefghijklmnopqrstuvwxyz0123456789";
        
        for (var i = 0; i < 7; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        
        text = data + text;
        
        
        testIdAvalilability(text, function (available) {
            if (available == false) {
                makeid(callback);
            }
            else {
                log.debug({msg: 'Created id: ' + text});
                if (callback != null)
                    callback(text);
            }
        });
    });
    
    
}

/* return true or false in the callback if the sprinkler's id already exists in our db */
function sprinklerExistenceInWhiteList(mac, udid, callback) {
    
    connection.getConnection(function (err, mysql_connection) {
        //select from mysql...
        if (!err) {
            
            var selectQuery = "select SprinklerId as id from auth_code_whitelist where mac = "
                + mysql_connection.escape(mac) + " and UDID = " + mysql_connection.escape(udid) + ";";
            var retValue = "";
            
            mysql_connection.query(selectQuery, function (err, rows) {
                
                mysql_connection.release();
                
                if (err) {
                    log.error({msg: err, server: serverCertsAddress, sprinklerId: sprinklerId});
                }
                
                if (rows.length != 0) {
                    retValue = true;
                    log.debug({msg: 'old name: ' + rows[0].id, server: serverCertsAddress, sprinklerId: sprinklerId});
                    callback(retValue, rows[0].id);
                }
                else {
                    retValue = false;
                    callback(retValue);
                }
                
            });
        }
        else {
            log.error({msg: err, server: serverCertsAddress, sprinklerId: sprinklerId});
            if (mysql_connection)
                mysql_connection.release();
        }
    });
}

/* updates sprinkler's info */
function sprinklerUpdate(oldSprinklerId, sprinklerId, mac, udid) {
    
    connection.getConnection(function (err, mysql_connection) {
        
        if (!err) {
            
            // update the sprinkler id
            var updateQuery = "update auth_code_whitelist set sprinklerId = " + mysql_connection.escape(sprinklerId) +
                " where mac = " + mysql_connection.escape(mac) + " and UDID = " + mysql_connection.escape(udid) + ";";
            
            mysql_connection.query(updateQuery, function (err, rows) {
                
                log.debug({msg: 'Sprinkler updated', server: serverCertsAddress, sprinklerId: sprinklerId});
                if (err) {
                    mysql_connection.release();
                    log.error({msg: err, server: serverCertsAddress, sprinklerId: sprinklerId});
                }
                
                else {
                    //TODO insert the events in a Log table
                    var insertQuery = "insert into sprinkler_reset_logs(old_sprinkler_id, new_sprinkler_id, mac, UDID) values( " +
                        mysql_connection.escape(oldSprinklerId) + "," + mysql_connection.escape(sprinklerId) + "," +
                        mysql_connection.escape(mac) + "," + mysql_connection.escape(udid) + ");";
                    
                    mysql_connection.query(insertQuery, function (err, rows) {
                        
                        mysql_connection.release();
                        
                        if (err) {
                            log.error({msg: err, server: serverCertsAddress, sprinklerId: sprinklerId});
                        }
                        log.debug({msg: 'Added sprinkler to Logs', server: serverCertsAddress});
                        
                    });
                }
                
            });
        }
        
        else {
            log.error({msg: err, server: serverCertsAddress, sprinklerId: sprinklerId});
            if (mysql_connection)
                mysql_connection.release();
        }
    });
}

/*  test if the sprinklerId already exists in the database */
function testIdAvalilability(mySprinklerId, callback) {
    
    connection.getConnection(function (err, mysql_connection) {
        
        if (!err) {
            //select from mysql...
            var selectQuery = "select * from auth_code_whitelist where sprinklerId = " + mysql_connection.escape(mySprinklerId) + ";";
            var retValue = "";
            
            mysql_connection.query(selectQuery, function (err, rows) {
                
                mysql_connection.release();
                
                if (err) {
                    log.debug({msg: 'err: ' + err, server: serverCertsAddress});
                    log.error({msg: err, server: serverCertsAddress, sprinklerId: mySprinklerId});
                }
                if (typeof(rows) != 'undefined' && rows.length != 0) {
                    retValue = false;
                }
                else
                    retValue = true;
                
                if (callback != null)
                    callback(retValue);
                
            });
        }
        else {
            log.error({msg: err, server: serverCertsAddress, sprinklerId: mySprinklerId});
            if (mysql_connection)
                mysql_connection.release();
        }
    });
}


function executeScriptAndReturnPostData(myExecCommand, folderName, mySprinklerId, callback) {
    // execute script
    //Try something synchrounous
    
    child_gen_sync = execSync(myExecCommand, {maxBuffer: 1024 * 16000});
    
    var emptyJson = {
        sprinklerId: 0,
        key: null,
        cert: null
    };
    
    if (child_gen_sync) {
        
        // read certificate after we execute the script
        fs.readFile(__dirname + '/../resources/cloud-client/' + folderName + '/cloud-client_cert.pem', 'ascii', function (err, data) {
            var certData;
            if (err) {
                log.error({msg: JSON.stringify(err), server: serverCertsAddress});
                certData = null;
                //return;
            } else {
                certData = data;
            }
            
            
            // read key
            fs.readFile(__dirname + '/../resources/cloud-client/' + folderName + '/rsa_2048.key', 'ascii', function (err, data) {
                var key;
                if (err) {
                    log.error({msg: JSON.stringify(err), server: serverCertsAddress});
                    key = null;
                    //return;
                } else {
                    key = data;
                }
                
                var myPostData = {
                    key: key,
                    cert: certData,
                    sprinklerId: mySprinklerId
                };
                if (key != null && certData != null && certData && certData != '') {
                    log.debug({msg: 'sending back actual data', server: serverCertsAddress});
                    callback(myPostData);
                }
                else {
                    log.debug({msg: 'sending back emptyJson', server: serverCertsAddress});
                    callback(emptyJson);
                }
                
            });
            
        });
    } else {
        return callback(emptyJson);
    }
    
    
    // child_gen = exec(myExecCommand + ' 2>&1 1>output && echo done! > done', {maxBuffer: 1024 * 16000}, function (error, stdout, stderr) {
    //
    //   while (!fs.existsSync('done')) {
    //     // Do nothing
    //   }
    //
    //   if(error) {
    //     log.error({msg: JSON.stringify(error), server: serverCertsAddress});
    //     //return;
    //   }
    //
    //   if(stderr){
    //     if(stderr.indexOf('ERROR:Serial') > -1){
    //       //Do something here to regenerate the certificate
    //       log.error({msg: stderr,server: serverCertsAddress});
    //     }
    //   }
    //
    //   // read certificate after we execute the script
    //   fs.readFile(__dirname+'/../resources/cloud-client/'+folderName+'/cloud-client_cert.pem', 'ascii', function (err,data) {
    //     var certData;
    //     if(err) {
    //       log.error({msg: JSON.stringify(err), server: serverCertsAddress});
    //       certData = null;
    //       //return;
    //     }else{
    //       certData = data;
    //     }
    //
    //
    //     // read key
    //     fs.readFile(__dirname+'/../resources/cloud-client/'+folderName+'/rsa_2048.key', 'ascii', function (err,data) {
    //       var key;
    //       if(err) {
    //         log.error({msg: JSON.stringify(err), server: serverCertsAddress});
    //         key = null;
    //         //return;
    //       }else{
    //         key = data;
    //       }
    //       var emptyJson = {sprinklerId: 0,
    //                         key: null,
    //                         cert: null
    //                     };
    //       var myPostData = {
    //         key: key,
    //         cert: certData,
    //         sprinklerId: mySprinklerId
    //       };
    //       if(key != null && certData != null && certData && certData != '' ) {
    //         log.debug({msg: 'sending back actual data', server: serverCertsAddress});
    //         callback(myPostData);
    //       }
    //       else{
    //         log.debug({msg: 'sending back emptyJson', server: serverCertsAddress});
    //         callback(emptyJson);
    //       }
    //
    //     });
    //   });
    //
    //   // Read the output
    //   if (fs.existsSync('output')) {
    //     // Do something
    //     var output = fs.readFileSync('output');
    //     fs.unlinkSync('output');
    //   }
    //
    //   if (fs.existsSync('done')) {
    //     fs.unlinkSync('done');
    //   }
    //
    // });
}

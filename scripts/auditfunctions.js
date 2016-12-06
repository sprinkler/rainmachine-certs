/**
 * Created by Danutza on 3/20/15.
 */

function define(name, value) {
  Object.defineProperty(exports, name, {
    value:      value,
    enumerable: true
  });
}

var fs = require('fs');
var logger = require('../lib/proxy/loggerWrapper.js');
var log = logger.generalLogger;

define ("setOrGetInfoInAuditTable",  setOrGetInfoInAuditTable);
define ("getCurrentTime",  getCurrentTime);
define ("endRequest",  endRequest);
define ("getNumberOfRequestsForInfo",  getNumberOfRequestsForInfo);
define ("updateAuditTable", updateAuditTable);
define ("setOrGetTotalNumberOfRequestsAndDateOfLastRequest", setOrGetTotalNumberOfRequestsAndDateOfLastRequest);
define ("constructUpdateQuery", constructUpdateQuery);

function constructUpdateQuery(mysql, tableName, fieldName,
                              totalNumberOFRequests, fieldValue) {

  var where = "";
  if(fieldName != null) {
    where = "where "+fieldName+" = "+mysql.escape(fieldValue);
  }
  else {
    where = "";
  }

  var myUpdateQuery = "update sprinkler."+tableName+" set  number_of_requests = '"+totalNumberOFRequests+
    "', date_of_last_request = null "+ where;

  return myUpdateQuery;
}

function setOrGetTotalNumberOfRequestsAndDateOfLastRequest(databaseConnection, fieldName, tableName, res,
                                  ERROR_CODE, callback) {
  databaseConnection.getConnection(function(err, mysql_connection) {
    if(err) {
      log.error({msg: "Unsuccesfull connection", method: 'setOrGetTotalNumberOfRequestsAndDateOfLastRequest'});
      updateLogFile(err);
    }
    else {
      var mySelectQuery = "select number_of_requests, date_of_last_request from sprinkler."+tableName+"; ";
      mysql_connection.query(mySelectQuery, function(err,rows) {
        if(err) {
          mysql_connection.release();
          log.error({msg: "Unsuccesfull query: "+mySelectQuery, method: 'setOrGetTotalNumberOfRequestsAndDateOfLastRequest'});
          updateLogFile(err);
          endRequest(res, ERROR_CODE);
        }

        else {
          // log.debug("Successfull query: "+mySelectQuery);
          // if the email already exists in the audit table
          if(rows.length != 0) {
            // release connection
            mysql_connection.release();
            callback(rows[0]["number_of_requests"], rows[0]["date_of_last_request"]);
          }

          else {
            var currentDate = getCurrentTime();

            // add a new log
            var myInsertQuery = "insert into sprinkler."+tableName+"("+fieldName+", date_of_last_request " +
              ") VALUES(0,"+currentDate+");";

            mysql_connection.query(myInsertQuery, function(err,rows) {
              mysql_connection.release();

              if(err) {
                log.error({msg: "Unsuccesfull query: "+myInsertQuery, method: 'setOrGetTotalNumberOfRequestsAndDateOfLastRequest'});
                endRequest(res, ERROR_CODE);
              }
              else {
                // log.debug("Successfull insert query: "+myInsertQuery);
                callback(0, currentDate);
              }
            });
          }
        }
      });
    }
  });
}

function setOrGetInfoInAuditTable(mysql, databaseConnection, fieldName, tableName,
                                  fieldValue, mac, res, ERROR_CODE, callback) {
  databaseConnection.getConnection(function(err, mysql_connection) {
    if(err) {
      log.error({msg: "Unsuccesfull connection", method: 'setOrGetInfoInAuditTable'});
      
      updateLogFile(err);
    }
    else {
      var mySelectQuery = "select date_of_last_request from sprinkler."+tableName+" where " +
        fieldName+" = "+mysql.escape(fieldValue);
      mysql_connection.query(mySelectQuery, function(err,rows) {
        if(err) {
          mysql_connection.release();
          log.error({msg: "Unsuccesfull query: "+mySelectQuery, method: 'setOrGetInfoInAuditTable'});
          
          updateLogFile(err);
          endRequest(res, ERROR_CODE);
        }

        else {
          // log.debug("Successfull query: "+mySelectQuery);
          // if the email already exists in the audit table
          if(rows.length != 0) {
            // release connection
            mysql_connection.release();
            callback(rows[0]["date_of_last_request"]);
          }

          else {
            var currentDate = getCurrentTime();

            // add new log
            var myInsertQuery = "insert into sprinkler."+tableName+"("+fieldName+", date_of_last_request " +
              ", mac) VALUES("+mysql.escape(fieldValue)+","+currentDate+","+mysql.escape(mac)+");";

            mysql_connection.query(myInsertQuery, function(err,rows) {
              mysql_connection.release();

              if(err) {
                log.error({msg: "Unsuccesfull query: "+myInsertQuery, method: 'setOrGetInfoInAuditTable'});
                
                endRequest(res, ERROR_CODE);
              }
              else {
                // log.debug("Successfull insert query: "+myInsertQuery);
                callback(currentDate);
              }
            });
          }
        }
      });
    }
  });
}

function getNumberOfRequestsForInfo(databaseConnection, fieldName, tableName, fieldValue,
                                    res, ERROR_CODE, callback) {

  databaseConnection.getConnection(function(err, mysql_connection) {
    if(err) {
      log.error({msg: "Unsuccesfull connection", method: 'getNumberOfRequestsForInfo'});
      
      updateLogFile(err);
    }
    else {

      var mySelectQueryForAuditRequests = "select (number_of_requests) as reqNumber from sprinkler."+tableName+" where " +
        fieldName +" = '" + fieldValue + "'";

      mysql_connection.query(mySelectQueryForAuditRequests, function(err,rows) {
        mysql_connection.release();
        if(err) {
          log.error({msg: "Unsuccesfull query: "+mySelectQueryForAuditRequests, method: 'getNumberOfRequestsForInfo'});
          
          updateLogFile(err);
          endRequest(res, ERROR_CODE);
        }
        else {
          //log.debug("Succ query: "+mySelectQueryForAuditRequests);
          callback(rows[0]["reqNumber"]);
        }
      });
    }
  });
}

function updateAuditTable(databaseConnection, myUpdateQuery, ERROR_CODE, res) {

  databaseConnection.getConnection(function(err, mysql_connection) {
    if(err) {
      log.error("Unsuccesfull connection");
      
      updateLogFile(err);
      endRequest(res, ERROR_CODE);
    }
    else {
      mysql_connection.query(myUpdateQuery, function(err, rows) {
        mysql_connection.release();

        if(err) {
          log.error({msg: "Unsuccesfull query: "+myUpdateQuery, method: 'updateAuditTable'});
          
          updateLogFile(err);
          endRequest(res, ERROR_CODE);
        }

        else {
          //log.debug("Succesfull update query "+myUpdateQuery);
        }
      });
    }
  });
}

function getCurrentTime() {

  //zero-pad a single zero if needed
  var zp = function (val){
    return (val <= 9 ? '0' + val : '' + val);
  }

  var date = new Date();
  var time = date.getDate();
  var minute = date.getMonth() + 1;
  var year = date.getFullYear();
  var hour = date.getHours();
  var min = date.getMinutes();
  var second = date.getSeconds();

  return "'"+'' + year + '-' + zp(minute) + '-' + zp(time) + ' ' + zp(hour) + ':' + zp(min)
    + ':' + zp(second) + "'";
}

function endRequest(res, code) {
  res.writeHead(code);
  res.end();
}

function updateLogFile(err) {
  fs.writeFile("error.txt", err.stack, function() {
    log.error({msg: err.stack, method: 'updateLogFile'});
  });
}

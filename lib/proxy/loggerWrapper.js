var bunyanLogger = require('../../lib/proxy/logger');
var debugLogger = bunyanLogger.debugLogger;

var loggerWrapper = function(){
    this.submitLogs = true;

    this.toggleLogging = (how) => {
        if(how == 1){
            this.submitLogs = true;
        }else{
            this.submitLogs = false;
        }

    }
};

loggerWrapper.prototype.debug = function(debugData){
    var data = {
       data: debugData
    };
    try{
        if(this.submitLogs) {
            debugLogger.debug(data);
        }
    }catch(e){
       console.log('Unable to log data: '+e+' - '+JSON.stringify(data));
    }

};

loggerWrapper.prototype.info = function(infoData){
    var data = {
        data: infoData
    };

    try{
        if(this.submitLogs) {
            debugLogger.info(data);
        }
    }catch(e){
        console.log('Unable to log data: '+e+' - '+JSON.stringify(data));
    }
};

loggerWrapper.prototype.error = function(errorData){
    var data = {
        data: errorData
    };

    try{
        if(this.submitLogs) {
            debugLogger.error(data);
        }
    }catch(e){
        console.log('Unable to log data: '+e+' - '+JSON.stringify(data));
    }
};

var loggerWrapperInstance = new loggerWrapper();

module.exports.generalLogger = loggerWrapperInstance;

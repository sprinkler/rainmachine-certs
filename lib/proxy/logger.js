var bunyan = require('bunyan');
var debugLogger;

debugLogger = bunyan.createLogger({
    name: 'debug',
    streams: [
        {
            level: 'debug',
            type: 'rotating-file',
            path: '/var/log/node/debug.log',
            period: '1d',
            count: 2
        },
        {
            level: 'info',
            type: 'rotating-file',
            path: '/var/log/node/info.log',
            period: '1d',
            count: 2
        },
        {
            level: 'error',
            type: 'rotating-file',
            path: '/var/log/node/error.log',
            period: '1d',
            count: 2
        }
    ]
});
debugLogger.on('error', function(error, stream){
    console.log('Error writing to file: '+error);
});

module.exports.debugLogger = debugLogger;
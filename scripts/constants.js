'use strict';

let fs = require('fs'),
    path = require('path');

let config;
if(process.env.NODE_ENV == 'development'){
  config = require('./constants-dev');
}else if(process.env.NODE_ENV == 'production'){
  config = require('./constants-live');
}else if(process.env.NODE_ENV == 'factory'){
    config = require('./constants-factory');
}
else{
  console.log('Could not read NODE_ENV');
  process.exit(1);
}



let options = {
    key: fs.readFileSync(path.join(__dirname, '../../resources/intermCA/factory.rainmachine.com/interm_rsa_2048.key'), 'utf8'),
    cert: fs.readFileSync(path.join(__dirname, '../../resources/intermCA/factory.rainmachine.com/interm_sign_cert.pem'), 'utf8')
};
config.certs = options;

readLimits();

// watcher for changes to the server-limits.json file that updates the constants MAX... values
fs.watchFile(path.join(__dirname, '../../resources/server-limits.json'), (curr, prev) => {
    console.log('limits file changed. updating constants');
    readLimits();
});

function readLimits() {
    let limits;
    
    try {
        limits = fs.readFileSync(path.join(__dirname, '../../resources/server-limits.json'), 'utf8');
        limits = JSON.parse(limits);
        
        config.MAX_NUMBER_OF_REQ_PER_UDID = limits.MAX_NUMBER_OF_REQ_PER_UDID;
        config.MAX_NUMBER_OF_REQ_PER_IP = limits.MAX_NUMBER_OF_REQ_PER_IP;
        config.MAX_REQUESTS_PER_DAY = limits.MAX_REQUESTS_PER_DAY;
    } catch(e) {
        limits = {
            MAX_NUMBER_OF_REQ_PER_IP: config.MAX_NUMBER_OF_REQ_PER_IP,
            MAX_NUMBER_OF_REQ_PER_UDID: config.MAX_NUMBER_OF_REQ_PER_UDID,
            MAX_REQUESTS_PER_DAY: config.MAX_REQUESTS_PER_DAY
        };
        try {
            fs.writeFileSync(path.join(__dirname, '../../resources/server-limits.json'), JSON.stringify(limits));
        } catch (er) {
            console.log('Unable to create server-limits.json file', er);
        }
    }
}

module.exports = config;

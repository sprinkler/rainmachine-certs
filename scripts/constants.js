'use strict';

let fs = require('fs'),
    path = require('path');

let config;
if(process.env.NODE_ENV == 'development'){
  config = require('./constants-dev');
}else if(process.env.NODE_ENV == 'production'){
  config = require('./constants-live');
}else{
  console.log('Could not read NODE_ENV');
  process.exit(1);
}



let options = {
    key: fs.readFileSync(path.join(__dirname, '../resources/intermCA/factory.rainmachine.com/interm_rsa_2048.key'), 'utf8'),
    cert: fs.readFileSync(path.join(__dirname, '../resources/intermCA/factory.rainmachine.com/interm_sign_cert.pem'), 'utf8')
};
config.certs = options;

module.exports = config;

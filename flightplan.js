var plan = require('flightplan');


var appName = 'rainmachine-certs';
var username = 'ec2-user';

var tmpDir = appName+'-' + new Date().getTime();

// configuration
plan.target('development', [
    {
        host: '52.51.103.141',
        username: username,
        privateKey: '/home/radu/.ssh/prod_rsa',
        agent: process.env.SSH_AUTH_SOCK
    }
]);

plan.target('production', [
    {
        host: '52.25.21.163',
        username: username,
        privateKey: '/home/radu/.ssh/prod_rsa',
        agent: process.env.SSH_AUTH_SOCK
    }
]);

// run commands on localhost
plan.local(function(local) {
    // uncomment these if you need to run a build on your machine first
    // local.log('Run build');
    // local.exec('gulp build');

    local.log('Copy files to remote hosts');
    var filesToCopy = local.exec('git ls-files', {silent: true});
    // rsync files to all the destination's hosts
    local.transfer(filesToCopy, '/tmp/' + tmpDir);
});

// run commands on remote hosts (destinations)
plan.remote(function(remote) {
    remote.log('Move folder to root');
    remote.sudo('cp -R /tmp/' + tmpDir + ' ~', {user: username});
    remote.sudo('rm -rf /tmp/' + tmpDir, {user: username});

    remote.log('Install dependencies');
    remote.sudo('npm --production --prefix ~/' + tmpDir + ' install ~/' + tmpDir, {user: username});

    remote.log('Reload application');
    remote.sudo('ln -snf ~/' + tmpDir + ' ~/'+appName, {user: username});
    remote.sudo('/etc/init.d/node restart', {failsafe: true});
});

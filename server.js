var https       = require("https");
var http        = require('http');
var tls         = require("tls");
var fs          = require("fs");
var httpProxy   = require('http-proxy');
var exec 				= require('child_process').exec;
var execSync		= require('child_process').execSync;
var spawn 			= require('child_process').spawn;
var express     = require('express');
var bodyParser	= require('body-parser');
var config      = require('./config.js');
var _           = require('underscore');
var moment 			= require('moment');
var ansible 		= require('./ansible.js');
var used_ports  = [];

/* ---------------- Logging ------------- */
// create folder for log files if not existing
if (config.folders.logs) {
	if (!fs.existsSync(config.folders.logs)) {
		fs.mkdir(config.folders.logs, function(err, resp) {
			if (err) logEvent(2, "Error making log folder", err);
		});
	}

	// if proxy.log exists, and is not empty append to today's date
	if (fs.existsSync(config.folders.logs+"proxy.log")) {
		try {
			var command = 'cat '+config.folders.logs+'proxy.log >> '+config.folders.logs + moment().format('YYYYMMDD') + '_proxy.log';
			var resp = execSync(command, {encoding:"utf8"});
		} catch(err) {
			logEvent(2, "Proxy.log error", err);
		}
		fs.writeFileSync(config.folders.logs+'proxy.log', "");
	}
}

// TODO: check for default log file, would contain crash info


var logEvent = function() {
	var line = moment().format('YYYYMMDD HH:mm:ss Z');
	_.each(arguments, function(obj, index) {
		if (_.isObject(obj)) line += "\t"+JSON.stringify(obj);
		else line += "\t"+obj;
	});

	// save to the log file
	if (process.env.NODE_ENV != undefined) {
    if (process.env.NODE_ENV.indexOf('_dev') >= 0) {
      if (arguments[0] == 0 || arguments[0] == '0') line = '\x1b[32m'+line+'\x1b[0m'; // Green
      if (arguments[0] == 2 || arguments[0] == '2') line = '\x1b[31m'+line+'\x1b[0m'; // Red
  		console.log(line);
    } else {
			console.log(line);
		}
  } else {
		console.log(line);
	}
}

logEvent(1, "Proxy Start", process.env.NODE_ENV);

/**************************** PROXY *******************************************/

var proxy       = httpProxy.createServer();

/**************************** SERVICES ****************************************/

// load state.json
var state = {};

// stop future startup if any breaks detected
var failure_detected = false;

_.each(config.services, function(service, key) {
	state[key] = {
		npm_restart: false,
		git_stable: '',
		running: false
	};

	// check for node_modules folder, rebuild if not available
	if (service.address == 'localhost' && !fs.existsSync(service.dir+'/node_modules')) {
    logEvent(2, "Node_modules is missing in", service.dir);

		// TODO: make sure network is connected first?
		try {
			var command = 'cd '+service.dir+' && sudo -u pi npm install';
			execSync(command, {encoding:"utf8"});

			logEvent(1, "NPM Install finished, restart");
			failure_detected = true;
			restart_node();
		} catch (err) {
			logEvent(2, "NPM Error", service.dir, err);
		}
	}
});

if (failure_detected) return;

if (fs.existsSync(config.base_dir+'/'+config.folders.proxy+'/state.json')) {
	//logEvent(1, "Load saved state:", config.base_dir+'/state.json');
	var saved_state = fs.readFileSync(config.base_dir+'/'+config.folders.proxy+'/state.json', 'utf8');
	try {
		state = JSON.parse(saved_state);
	} catch (err) {
		logEvent(3, "!!Blank save state", err, state);
	}
} else {
	logEvent(1, "No State object found");
}

// check for the version/branch
_.each(config.service_versions, function (version, service) {
	try {
    var service_config  = require(config.base_dir + '/' + config.folders[service] + '/config.js');
    config.service_versions[service] = service_config.version;
		logEvent(1,"Service-at:",service,"Version",service_config.version);
		var command = 'cd '+config.base_dir+'/'+config.folders[service]+' && git rev-parse --abbrev-ref HEAD';
		var resp = execSync(command, {encoding:"utf8"});
		config.service_branches[service] = resp.trim();
	} catch (err) {
		// Bad or no config, revert
		logEvent(2, "Version/Branch Revert on err", service, err);
		failure_detected = true;
		revert(service);
	}
});

if (failure_detected) return;

logEvent(1, "Services", config.service_branches, config.service_versions);

_.each(config.services, function (service, key) {
  if (service.address !== 'localhost') return this;

	// fix for sisbot 1.2.0
	try {
		if (key == 'sisbot' && config.service_versions[key] == '1.2.0') {
			logEvent(1, "1.2.0 fix");
			var resp = execSync('./sisbot_1_2_0_fix.sh', {encoding:"utf8"});

			// Restart self
			restart_node();
		}
	} catch(err) {
		logEvent(2, "1.2.0 fix error", err);
	}

	create_service(service, function(err, resp) {
		if (err) {
			if (!state[key].npm_restart) {
				reinstall_npm(service, key);
			} else {
				// Revert to known good state
				logEvent(2, "Revert to known good state");

				// Revert
				revert_reset();
			}
		} else if (resp) {
			logEvent(1, "Service created on port ", resp);

			state[key].npm_revert = false;
			state[key].npm_restart = false;
			state[key].running = true;
			save_services_state();

			// check git state
			git_state();

			used_ports.push(resp);
		}
	});
});

function create_service(service,cb) {
	logEvent(1, "Create", service);
	try {
	  var service_obj = require(service.dir + '/server.js');
		var send_config = JSON.parse(JSON.stringify(config));
		service_obj(send_config, ansible());

		if (cb) cb(null, service.port);
	} catch(err) {
		logEvent(2, "Service error:", service.port, err);
		if (cb) cb(err, null);
	}
}

function reinstall_npm(service, key) {
	return;
	if (process.env.NODE_ENV.indexOf('dev') != -1) return; // skip
	logEvent(2, "NPM Restart");

	// attempt to fix via npm install
	var command = 'cd '+service.dir+' && sudo -u pi npm install && echo "Finished"';
	logEvent(2, command);
	try {
		execSync(command, {encoding:"utf8"});
	} catch(err) {
		logEvent(2, "NPM Restart err", err);
	}

	// Save state
	state[key].npm_restart = true;
	save_services_state();

	// Restart self
	restart_node();
}

function save_services_state() {
	if (process.env.NODE_ENV.indexOf('sisbot') < 0) return; // skip
	if (process.env.NODE_ENV.indexOf('dev') != -1) return; // skip

	var sanitized_state = JSON.parse(JSON.stringify(state));
	_.each(sanitized_state, function(obj, key) {
		delete sanitized_state[key].running;
	});

	// write to file
	try {
		logEvent(1, "Save Proxy state", sanitized_state);
		fs.writeFileSync(config.base_dir+'/sisproxy/state.json', JSON.stringify(sanitized_state));
	} catch(err) {
		logEvent(2, "State write error", err);
	}
}

function git_state() {
	if (process.env.NODE_ENV.indexOf('sisbot') < 0) return; // skip
	if (process.env.NODE_ENV.indexOf('dev') != -1) return; // skip

	logEvent(1, "Git State", state.sisbot.running, state.app.running);
	if (state.sisbot.running && state.app.running) {
		logEvent(1, "Stable Git State", state.sisbot.running, state.app.running);

		exec('cd '+config.base_dir+'/sisbot && git log -1 --stat', (error, stdout, stderr) => {
			if (error) return logEvent(2, 'exec error:',error);

			var regex = /commit\s([0-9a-f]+)/;
			var resp = stdout.match(regex);

			if (state.sisbot.git_stable != resp[1]) {
				logEvent(1, "Sisbot New Git: ", resp[1]);
				state.sisbot.git_stable = resp[1];
				save_services_state();
			}
		});
		exec('cd '+config.base_dir+'/siscloud && git log -1 --stat', (error, stdout, stderr) => {
			if (error) return logEvent(2, 'exec error:',error);

			var regex = /commit\s([0-9a-f]+)/;
			var resp = stdout.match(regex);

			if (state.app.git_stable != resp[1]) {
				logEvent(1, "Siscloud New Git: ", resp[1]);
				state.app.git_stable = resp[1];
				save_services_state();
			}
		});

		// run recovery_archiveUpdate.sh if needed
		var update_archive = false;
		logEvent(0, "Backup Check");
		// check if we need to update the archive
		if (fs.existsSync(config.recovery_dir+'/protected_backup/backup_v')) {
			try {
				var archived_v = fs.readFileSync(config.recovery_dir+'/protected_backup/backup_v', 'utf8');
				if (archived_v && config.recovery_v > +archived_v) update_archive = true;
			} catch(err) {
				logEvent(2, "backup_v error", err);
			}
		} else update_archive = true;

		if (update_archive) {
			logEvent(0, "Run recovery_archiveUpdate");
			var ls = spawn('./recovery_archiveUpdate.sh',[],{cwd:config.base_dir+'/'+config.folders.proxy,detached:true,stdio:'ignore'});
			ls.on('error', (err) => {
			  logEvent(2, 'Failed to start recovery_archiveUpdate.');
			});
			ls.on('close', (code) => {
			  logEvent(1, "recovery_archiveUpdate exited with code", code);
				// save backup_v
				if (code == 0) fs.writeFileSync(config.recovery_dir+'/protected_backup/backup_v', config.recovery_v);
			});
		}
	}
}

function restart_node() {
	if (process.env.NODE_ENV.indexOf('dev') > -1) {
		logEvent(1, "In dev mode, manually restart");
		return; // skip dev
	}

	logEvent(1, "Restart Node");
	var ls = spawn('./restart.sh',[],{cwd:config.base_dir+'/'+config.folders.proxy,detached:true,stdio:'ignore'});
	ls.on('error', (err) => {
	  logEvent(2, 'Failed to start child process.');
	});
	ls.on('close', (code) => {
	  logEvent(1, "child process exited with code",code);
	});

	// exit this process after spawning restart
	// process.exit();
}

function revert(service) {
	return;
	if (process.env.NODE_ENV.indexOf('sisbot') < 0) return; // skip
	if (process.env.NODE_ENV.indexOf('dev') > -1) return; // skip dev

	logEvent(1, "Revert", service);
	var ls = exec('cd ' + config.base_dir + '/' + config.folders[service] + ' && git reset --hard', (error, stdout, stderr) => {
		if (error) return logEvent(2, 'Revert error:',error);

		// delete NODE_MODULES Folder if we already reverted
		if (state[service] && state[service].npm_revert == true) {
			var ls = exec('cd ' + config.base_dir + '/' + config.folders[service] + ' && rm -rf node_modules', (error, stdout, stderr) => {
				logEvent(2, 'Already reverted, delete node_modules in '+service);

				restart_node();
			});
			return;
		}

		// Save state
		state[service].npm_revert = true;
		save_services_state();

		restart_node();
	});
}

function revert_reset() {
	return;
	if (process.env.NODE_ENV.indexOf('sisbot') < 0) return; // skip
	if (process.env.NODE_ENV.indexOf('dev') > -1) return; // skip dev

	validate_internet(function(err, resp) {
		if (err) return logEvent(2, "Validate Internet Err", err);

		if (resp == "true") {
			logEvent(1, "Revert Reset", "Sisbot", state.sisbot.git_stable, "Siscloud", state.app.git_stable);
			var ls = spawn('./revert_reset.sh',[state.sisbot.git_stable, state.app.git_stable],{cwd:config.base_dir+'/'+config.folders.proxy,detached:true});
			ls.on('error', (err) => {
			  logEvent(2, 'Failed to start child process.');
			});
			ls.on('close', (code) => {
			  logEvent(1, "child process exited with code",code);
			});
		} else {
			logEvent(2, "No internet detected, cannot revert_reset");
		}
	});

}

/**************************** INTERNET CONFIRM ********************************/

function validate_internet(cb) {
	logEvent(1, "Proxy validate internet");

	exec('ping -c 1 -W 2 google.com', {timeout: 5000}, (error, stdout, stderr) => {
		if (error) logEvent(2, 'ping exec error:', error);

		var returnValue = "false";
		if (stdout.indexOf("1 packets transmitted") > -1) returnValue = "true";
		// logEvent(1, 'stdout:', stdout);
		// logEvent(1, 'stderr:', stderr);

		logEvent(1, "Internet Connected Check", returnValue);

		if (cb) cb(null, returnValue);
	});
}

/**************************** SERVERS *****************************************/

function get_certificates(domain) {
    var certificates = {
        key : fs.readFileSync(config.base_certs + domain + '/privkey.pem'),
        cert: fs.readFileSync(config.base_certs + domain + '/fullchain.pem'),
        ca  : fs.readFileSync(config.base_certs + domain + '/chain.pem')
    };

    return certificates;
}

if (config.include_https) {
	https.createServer({
	    key     : fs.readFileSync(config.base_certs + config.default_domain + '/privkey.pem'),
	    cert    : fs.readFileSync(config.base_certs + config.default_domain + '/fullchain.pem'),
	    SNICallback: function(servername, cb) {
	        var ctx = tls.createSecureContext(get_certificates(servername));
	        cb(null, ctx);
	    }
		}, function(request, response) {
	    var domain_origin  = request.headers.host.replace(/\:[0-9]{4}/gi, '');
			domain = domain_origin;

			// logEvent(1, "Https Domain", domain);

			if (!config.services[domain]) domain = domain_origin.substring(0,domain_origin.indexOf('.'));
			var suffix_domain = request.url.split("/")[1];
			if (!config.services[domain] && config.services[suffix_domain]) domain = suffix_domain;
			if (!config.services[domain]) domain = config.default_server;

			try {
				// logEvent(1, "SisProxy HTTPS Request:", domain_origin, domain, config.services[domain]);
				proxy.web(request, response, { target: 'http://127.0.0.1:' + config.services[domain].port, secure: false, ws: true });
			}
			catch (err)
			{
				logEvent(2, "SisProxy HTTPS Redirect Err", err);
			}
		}).listen(config.port_ssl, function() {
	    logEvent(1, "SSL Proxy listening on port " + config.port_ssl);
		}
	);
}

/****** REDIRECT SERVER ******/
http.createServer(function (request, response) {
    var domain_origin  = "";
    if (request.headers.host) {
    	domain_origin  =	request.headers.host.replace(/\:[0-9]{4}/gi, '');
    }
		domain = domain_origin;

		// logEvent(1, "Domain", domain);

		if (!config.services[domain]) domain = domain_origin.substring(0,domain_origin.indexOf('.'));
		var suffix_domain = request.url.split("/")[1];
		if (!config.services[domain] && config.services[suffix_domain]) domain = suffix_domain;
		if (!config.services[domain]) domain = config.default_server;

		try {
			var ignore_urls = ['/sisbot/state','/sisbot/connect','/sisbot/exists'];

	    var m = request.url.match("/api/");
	    // logEvent(1,"proxy process.env.NODE_ENV ", process.env.NODE_ENV);

	    if (process.env.NODE_ENV.indexOf('sisbot') > -1 && m != null) {
		  	logEvent(1,"Sisproxy got an api request, ignoring ",request.url);
		  } else {
  			if (ignore_urls.indexOf(request.url) < 0) logEvent(1, "SisProxy HTTP 80 Request:", domain, request.url);
	  		proxy.web(request, response, { target: 'http://127.0.0.1:' + config.services[domain].port, secure: false });
		  }
		}catch (err) {
			logEvent(2, "SisProxy Redirect Err", err);
		}
}).listen(config.port_redirect);

var https       = require("https");
var http        = require('http');
var tls         = require("tls");
var fs          = require("fs");
var httpProxy   = require('http-proxy');
var exec 		= require('child_process').exec;
var execSync	= require('child_process').execSync;
var spawn 		= require('child_process').spawn;
var express     = require('express');
var bodyParser	= require('body-parser');
var config      = require('./config.js');
var _           = require('underscore');
var moment 		= require('moment');
var ansible 	= require('./ansible.js');
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
		var file = fs.readFileSync(config.folders.logs+'proxy.log', 'utf8');
		if (file) {
			fs.appendFileSync(config.folders.logs + moment().format('YYYYMMDD') + "_proxy.log", fs.readFileSync(config.folders.logs+"proxy.log"));
			// fs.unlinkSync(config.folders.logs+"/proxy.log");
			fs.writeFileSync(config.folders.logs+'proxy.log', "");
		}
	}
}

// TODO: check for default log file, would contain crash info


var logEvent = function() {
	var line = moment().format('YYYYMMDD HH:mm:ss Z');
	_.each(arguments, function(obj, index) {
		if (_.isObject(obj)) line += "\t"+JSON.stringify(obj);
		else line += "\t"+obj;
	});

	// save to the log file for sisbot
	console.log(line);
}

logEvent(1, "Proxy Start");

/**************************** PROXY *******************************************/

var proxy       = httpProxy.createServer();

/**************************** SERVICES ****************************************/

// load state.json
var state = {};
_.each(config.services, function(service, key) {
	state[key] = {
		npm_restart: false,
		git_stable: '',
		running: false
	};
});

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

_.each(config.service_versions, function (version, service) {
	try {
	    var service_config  = require(config.base_dir + '/' + config.folders[service] + '/config.js');
	    config.service_versions[service] = service_config.version;
		var command = 'cd '+config.base_dir+'/'+config.folders[service]+' && git rev-parse --abbrev-ref HEAD';
		var resp = execSync(command, {encoding:"utf8"});
		config.service_branches[service] = resp.trim();
	} catch (err) {
		// Bad or no config, revert
		revert_reset();
	}
});

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
				logEvent(2, "NPM Restart");

				// attempt to fix via npm install
				var command = 'cd '+service.dir+' && npm install && echo "Finished"';
				logEvent(2, command);
				execSync(command, {encoding:"utf8"});

				// Save state
				state[key].npm_restart = true;
				save_services_state();

				// Restart self
				restart_node();
			} else {
				// Revert to known good state
				logEvent(2, "Revert to known good state");

				// Revert
				revert_reset();
			}
		} else if (resp) {
			logEvent(1, "Service created on port ", resp);

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

function save_services_state() {
	if (process.env.NODE_ENV.indexOf('sisbot') < 0) return; // skip

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

	if (state.sisbot.running && state.app.running) {
		// logEvent(1, "Git State", state.sisbot.running, state.app.running);
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
	}
}

function restart_node() {
	logEvent(1, "Restart Node");
	var ls = spawn('./restart.sh',[],{cwd:config.base_dir+'/'+config.folders.proxy,detached:true,stdio:'ignore'});
	ls.on('error', (err) => {
	  logEvent(2, 'Failed to start child process.');
	});
	ls.on('close', (code) => {
	  logEvent(1, "child process exited with code",code);
	});
}

function revert_reset() {
	if (process.env.NODE_ENV.indexOf('sisbot') < 0) return; // skip

	logEvent(1, "Revert Reset", "Sisbot", state.sisbot.git_stable, "Siscloud", state.app.git_stable);
	var ls = spawn('./revert_reset.sh',[state.sisbot.git_stable, state.app.git_stable],{cwd:config.base_dir+'/'+config.folders.proxy,detached:true,stdio:'ignore'});
	ls.on('error', (err) => {
	  logEvent(2, 'Failed to start child process.');
	});
	ls.on('close', (code) => {
	  logEvent(1, "child process exited with code",code);
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

		logEvent(1, "Https Domain", domain);

		if (!config.services[domain]) domain = domain_origin.substring(0,domain_origin.indexOf('.'));
	    if (!config.services[domain]) domain = config.default_server;

		try {
			logEvent(1, "Request:", domain, config.services[domain]);
		    var active_port = config.services[domain].port;

			proxy.web(request, response, { target: 'http://127.0.0.1:' + config.services[domain].port, secure: false, ws: true });
		} catch (err) {
			logEvent(2, "Redirect Err", err);
		}
	}).listen(config.port_ssl, function() {
	    logEvent(1, "SSL Proxy listening on port " + config.port_ssl);
	});
}

/****** REDIRECT SERVER ******/
http.createServer(function (request, response) {
    var domain_origin  = request.headers.host.replace(/\:[0-9]{4}/gi, '');
	domain = domain_origin;

	// logEvent(1, "Domain", domain);

	if (!config.services[domain]) domain = domain_origin.substring(0,domain_origin.indexOf('.'));
    if (!config.services[domain]) domain = config.default_server;
	if (domain == undefined) domain = request.url.split("/")[1];

	try {
		var ignore_urls = ['/sisbot/state','/sisbot/connect','/sisbot/exists'];
		if (ignore_urls.indexOf(request.url) < 0) logEvent(1, "Request:", request.url);

        var active_port = config.services[domain].port;

    	proxy.web(request, response, { target: 'http://127.0.0.1:' + config.services[domain].port, secure: false });
	} catch (err) {
		logEvent(2, "Redirect Err", err);
	}
}).listen(config.port_redirect);

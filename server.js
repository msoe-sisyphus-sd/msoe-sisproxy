var https       = require("https");
var http        = require('http');
var tls         = require("tls");
var fs          = require("fs");
var httpProxy   = require('http-proxy');
var exec 		= require('child_process').execSync;
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
	var line = Date.now();
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

_.each(config.service_versions, function (version, service) {
    var service_config  = require(config.base_dir + '/' + config.folders[service] + '/config.js');
    config.service_versions[service] = service_config.version;
	var command = 'cd '+config.base_dir+'/'+config.folders[service]+' && git rev-parse --abbrev-ref HEAD';
	var resp = exec(command, {encoding:"utf8"});
	config.service_branches[service] = resp.trim();
});

logEvent(1, config.service_branches);

_.each(config.services, function (service) {
    if (service.address !== 'localhost') return this;

    var service_obj = require(service.dir + '/server.js');
	service_obj(config,ansible());

	if (service.port != undefined) used_ports.push(service.port);
});

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

		if (!config.servers[domain]) domain = domain_origin.substring(0,domain_origin.indexOf('.'));
	    if (!config.servers[domain]) domain = config.default_server;

		try {
			logEvent(1, "Request:", domain, config.servers[domain]);
		    var active_port = config.servers[domain].port;

	    	proxy.web(request, response, { target: 'http://127.0.0.1:' + config.servers[domain].port, secure: false, ws: true });
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

	logEvent(1, "Domain", domain);

	if (!config.servers[domain]) domain = domain_origin.substring(0,domain_origin.indexOf('.'));
    if (!config.servers[domain]) domain = config.default_server;
	if (domain == undefined) domain = request.url.split("/")[1];

	try {
		logEvent(1, "Request:", request.url);
        var active_port = config.servers[domain].port;
        proxy.web(request, response, { target: 'http://127.0.0.1:' + config.servers[domain].port, secure: false });
	} catch (err) {
		logEvent(2, "Redirect Err", err);
	}
}).listen(config.port_redirect);

/******* SERVERS *************/
_.each(config.servers, function (domain) {
	logEvent(1, "Setup server", domain.port, used_ports);
    if (domain.has_server) {
		fs.stat(domain.dir + '/server.js',function(err,stats) {
			if (err) {
				logEvent(2, "Service not found:", domain);
			} else if (used_ports.indexOf(domain.port) < 0) {
	      var server = require(domain.dir + '/server.js');
				server(domain);
				used_ports.push(domain.port);
			}
		});
  } else if (used_ports.indexOf(domain.port) < 0) {
    setup_static_server(domain);
		used_ports.push(domain.port);
  }
});

function setup_static_server(domain) {
	logEvent(1, "Static Server", domain);
    var static             = new express();

    static.use(bodyParser.json());
    static.use(bodyParser.urlencoded({limit: '50mb'}));

    static
        .use(express.static(domain.dir))
        .use(function(res, req, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            res.header("Connection", "keep-alive");
            next();
        });

    http.createServer(static).listen(domain.port);
}

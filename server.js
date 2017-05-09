var https       = require("https");
var http        = require('http');
var tls         = require("tls");
var fs          = require("fs");
var httpProxy   = require('http-proxy');
var express     = require('express');
var bodyParser	= require('body-parser');
var config      = require('./config.js');
var _           = require('underscore');
var ansible 		= require('./ansible.js');
var used_ports  = [];

/**************************** PROXY *******************************************/

var proxy       = httpProxy.createServer();

/**************************** SERVICES ****************************************/

_.each(config.services, function (service) {
    if (service.address !== 'localhost')
        return this;

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

		if (!config.servers[domain]) domain = domain_origin.substring(0,domain_origin.indexOf('.'));
	    if (!config.servers[domain]) domain = config.default_server;
		// console.log("Request:", domain, config.servers[domain]);

	    var active_port = config.servers[domain].port;

	    proxy.web(request, response, { target: 'http://127.0.0.1:' + config.servers[domain].port, secure: false, ws: true });
	}).listen(config.port_ssl, function() {
	    console.log("SSL Proxy listening on port " + config.port_ssl);
	});
}

/****** REDIRECT SERVER ******/
http.createServer(function (request, response) {
    var domain_origin  = request.headers.host.replace(/\:[0-9]{4}/gi, '');
		domain = domain_origin;

	if (!config.servers[domain]) domain = domain_origin.substring(0,domain_origin.indexOf('.'));
    if (!config.servers[domain]) domain = config.default_server;
	// console.log("Request:", domain, config.servers[domain]);

    var active_port = config.servers[domain].port;

    proxy.web(request, response, { target: 'http://127.0.0.1:' + config.servers[domain].port, secure: false });
}).listen(config.port_redirect);

/******* SERVERS *************/
_.each(config.servers, function (domain) {
	console.log("Setup server", domain.port, used_ports);
  if (domain.has_server) {
		fs.stat(domain.dir + '/server.js',function(err,stats) {
			if (err) {
				console.log("Service not found:", domain);
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
  console.log("Static Server", domain);
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

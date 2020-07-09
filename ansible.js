var _						= require("underscore");
var fs					= require('fs');
var tls					= require("tls");
var JsonSocket	= require('json-socket');
var uuid				= require('uuid');
var moment			= require('moment');

var Ansible = function() {
	return {
		debug			: false,
		sockets			: {},
		service			: null,
		_handler		: {},
		_cb_hash		: {},
		_listeners		: {},
		_address		: 'localhost',
		_port			: 443,
		_is_receiver	: false,
		_cert			: {
			key: '/etc/ssl/private/private-key.pem',
			cert: '/etc/ssl/private/public-cert.pem'
		},
		logEvent: function() {
			// var filename = '/var/log/sisyphus/ansible.log';

			var line = moment().format('YYYYMMDD HH:mm:ss Z');
			_.each(arguments, function(obj, index) {
				if (_.isObject(obj)) line += "\t"+JSON.stringify(obj);
				else line += "\t"+obj;
			});

			console.log(line);
			// fs.appendFile(filename, line + '\n', function(err, resp) {
			//   if (err) console.log("Log err", err);
			// });
		},
		init: function(address,port,is_receiver) {
			this._address = address;
			this._port = port;

			this._is_receiver = is_receiver;
			if (this._is_receiver) {
				this.serve();
			}
		},
		setAddress: function(address) {
			if (this.server_sockets.length > 0) {
				// take down servers, rebuild
			}
			this._address = address;
		},
		setCert: function(cert) {
			if (cert.key != undefined) this._cert.key = cert.key;
			if (cert.cert != undefined) this._cert.cert = cert.cert;
		},
		setHandler: function(service_obj) {
			this._handler = service_obj;

			_.each(this.sockets, function(obj) {
				if (obj.type == "connected") {
					obj.message_handler = service_obj;
				}
			});
		},
		connect: function(service, address, port, cb) {
			var self = this;

			self.logEvent(1, "Ansible Connect()", service, address);

			// connect to another ansible service
			var options = {
				rejectUnauthorized:false
			};

			var socket = tls.connect(port, address, options, function () {
				self.get(service).is_connected = true;
				self.logEvent(1, "Ansible Socket Connected:", service);
				cb(null,true);
			});

			// save as JSONSocket
			var json_socket = new JsonSocket(socket);
			json_socket.on('error',function(err){
				if (self.get(service).is_connected) {
					self.logEvent(2, "Ansible Error Socket: ", err);
					self.get(service).is_connected = false;

					// check for _connectionError function in handler
					if (self._handler != null && _.isFunction(self._handler._connectionError)) {
						self._handler._connectionError(service);
					}

					// if (self.get(service).maintain_conn == true) {
					//	setTimeout(function(){
					//		self.get(service).reconnect++;
					//		delete self.get_socket(service);
					//		self.connect(service, address, port, cb);
					//	},5000);
					// }
				}
				cb(err,null);
			});
			json_socket.on('close',function(){
				var service_obj = self.get(service);
				if (service_obj.is_connected) {
					self.logEvent(1, "Ansible Socket Closed:", service);
					service_obj.is_connected = false;

					// check for _connectionClosed function in handler
					if (self._handler != null && _.isFunction(self._handler._connectionClosed)) {
						self._handler._connectionClosed(service);
					}
				}

				// retry to connect in 5 seconds
				if (service_obj.maintain_conn == true) {
					setTimeout(function(){
						service_obj.reconnect++;
						delete service_obj.socket;
						self.logEvent(1, "Ansible reconnect", service, Object.keys(self.sockets).length);
						self.connect(service, service_obj.address, service_obj.port, cb); // allows for address to be changed by handler
					},5000);
				} else {
					self.logEvent(1, "Ansible disconnect", service, Object.keys(self.sockets).length);
					if (self.disconnect(service)) delete self.sockets[service];
				}
			});
			json_socket.on('message',function(message) {
				if (message.method == "response" && message._id != undefined) {
					// self.logEvent(1, "CBs available", _.keys(self._cb_hash));
					try {
						self._cb_hash[message._id].cb(message.err, message.data);
						delete self._cb_hash[message._id];
					} catch(err) {
						return self.logEvent(2, "Outgoing Response error", message, err);
					}
				} else if (self.get(service).message_handler != null) {
					try {
						if (self.debug) self.logEvent(1, service+" Message", message);
						self.get(service).message_handler[message.method](message.data, function(err, resp) {
							if (message._id != undefined) {
								var response = { service: service, data: resp, err: err, _id: message._id };
								self.respond(response);
							}
						});
					} catch(err) {
						var response = { service: service, data: null, err: 'Method error', _id: message._id };
						self.respond(response);
						return self.logEvent(2, "Handler error", err);
					}
				}
				// call any listener method saved
				if (self._listeners[message.method] != undefined) {
					try {
						self._listeners[message.method](message, json_socket);
					} catch(err) {
						return self.logEvent(2, "Outgoing Message error",err);
					}
				}
			});

			// save to list
			if (this.sockets[service] == undefined) {
				// this.logEvent(0, 'Ansible: new socket', service);
				var socket_obj = {
					socket					:	json_socket,
					service					: service,
					address					: address,
					port						: port,
					is_connected		: false,
					type						: "client",
					messages				: [],
					message_handler	: (self._handler) ? self._handler : null, // object to call functions when messages come in
					maintain_conn		: true,
					reconnect				: 0
				};
				this.sockets[service] = socket_obj;
			} else {
				// self.logEvent(0, 'Ansible: reconnect socket', service);
				self.get(service).reconnect = 0;
				self.get(service).socket = json_socket;
				self.get(service).maintain_conn = true;

				if (self.get(service).messages.length > 0) {
					// send those messages!
				}
			}

			return json_socket;
		},
		serve: function() {
			var self = this;
			if (self.debug) self.logEvent(1, "Start Ansible Server", this._port, options);
			var options = {
				key: fs.readFileSync(this._cert.key),
				cert: fs.readFileSync(this._cert.cert)
			};
			this.server = tls.createServer(options,function(socket) {
				socket.on('error', function(err) {
					self.logEvent(2, "Ansible Server error", err);
				});

				var json_socket = new JsonSocket(socket);

				// add connected to clients list
				var socket_obj = {
					socket:					json_socket,
					service:					uuid(), // make unique
					port:						self.port,
					is_connected:		true,
					type:						"connected",
					messages:				[],
					message_handler:	(self._handler) ? self._handler : null // object to call functions when messages come in
				};
				self.sockets[socket_obj.service] = socket_obj;
				self.logEvent(1, "Client connected", socket_obj.service);

				json_socket.on('close', function() {
					self.logEvent(1, "Client disconnected from server", socket_obj.service);
					if (socket_obj.messages.length > 0) self.logEvent(1, socket_obj.messages.length+" unsent messages for "+service);

					if (self.get(socket_obj.service).message_handler != null) {
						if (_.isFunction(self.get(socket_obj.service).message_handler._connectionClosed)) {
							self.get(socket_obj.service).message_handler._connectionClosed(socket_obj.service);
						}
					}

					if (self.disconnect(socket_obj.service)) delete self.sockets[socket_obj.service];
				});
				json_socket.on('message', function(message) {
					message.service = socket_obj.service;

					if (message.method == "response" && message._id != undefined) {
						try {
							self._cb_hash[message._id].cb(message.err, message.data);
							delete self._cb_hash[message._id];
						} catch(err) {
							return self.logEvent(2, "Response error", err);
						}
					} else if (self.get(socket_obj.service).message_handler != null) {
						try {
							if (self.debug) self.logEvent(1, socket_obj.service+" Message", message);
							self.get(socket_obj.service).message_handler[message.method](message.data, function(err, resp) {
								if (message._id != undefined) {
									var response = { service: socket_obj.service, data: resp, err: err, _id: message._id };
									self.respond(response);
								}
							});
						} catch(err) {
							var response = { service: socket_obj.service, data: null, err: 'Method error', _id: message._id };
							self.respond(response);
							return self.logEvent(2, "Handler error", err);
						}
					}

					if (self._listeners[message.method] != undefined) {
						try {
							self._listeners[message.method](message, json_socket);
						} catch(err) {
							return self.logEvent(2, "Message error",err);
						}
					}
				});
			}).listen(this._port);
		},
		stop_server: function(service) {
			var self = this;
			this.logEvent(1, "Ansible stop server", service);
			// remove all connected sockets?
			var clientList = this.sockets;
			_.each(clientList, function(client) {
				if (client.type == "connected")
				self.disconnect(client);
			});

			delete this.server;

			return true;
		},
		disconnect: function(service) {
			if (this.sockets[service] && this.sockets[service].is_connected) {
				this.logEvent(1, "Ansible disconnect", Object.keys(this.get(service)));

				this.get(service).maintain_conn = false; // don't try to reconnect
				this.get_socket(service).end();

				//		delete this.get_socket(service);

				this.logEvent(1, "Ansible disconnect finished", service);
				return true;
			}

			return false;
		},
		get: function(service) {
			return this.sockets[service];
		},
		get_socket: function(service) {
			return this.sockets[service].socket;
		},
		get_by_socket: function(socket) {
			var returnValue = null;
			_.each(this.sockets, function(obj) {
				if (obj.socket == socket) {
					returnValue = obj;
				}
			});
			return returnValue;
		},
		listen_to: function(method, cb) {
			try {
				this._listeners[method] = cb;
				return this;
			} catch (err) {
				return this.logEvent(2, "Listen to error", err);
			}
		},
		// ----- unused function, will be handled by setting this._handler before any connections come in ----- //
		set_client_handler: function(service, handler) {
			var socket_obj = this.get(service);
			if (socket_obj != undefined) {
				socket_obj.message_handler = handler;
			}
		},
		request: function(obj) {
			// obj { service: "label", data: {}, method: "name", cb: func() }
			if (this.get(obj.service) == undefined) return this.logEvent(2, "Service "+obj.service+" not available", obj);

			var socket = this.get(obj.service).socket;
			if (socket == undefined) return this.logEvent(2, "No "+obj.service+" socket available", null);

			// save cb for response whenever it comes back
			if (obj.cb != undefined && _.isFunction(obj.cb)) {
				if (this.debug) this.logEvent(1, "CB: ", obj.cb);
				var _id = uuid();
				this._cb_hash[_id] = { cb: obj.cb, timestamp: Date.now() };
				obj._id = _id;
			}

			// this.logEvent(1, "Request", obj, this.get(obj.service));
			if (this.get(obj.service).is_connected == true) {
				// this.logEvent(1, "Request", obj);
				socket.sendMessage(obj);
			} else {
				this.logEvent(1, "Message Saved", obj);
				this.get(obj.service).messages.push(obj);
			}
		},
		respond: function(obj) {
			obj.method = "response";
			this.request(obj);
		}
	}
};

module.exports = Ansible;

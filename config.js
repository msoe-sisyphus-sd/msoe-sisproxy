var _ = require('underscore');

var config = {
    base: {
        base_dir: '/domains',
        base_certs: '/etc/letsencrypt/live/',
        default_domain: 'withease.io',
        default_server: 'app',
        port_ssl: 443,
        port_redirect: 80,
        cert: function() {
            return {
                key     : this.default_domain + "/privkey.pem",
                cert    : this.default_domain + "/fullchain.pem"
            }
        },
        folders: {
            app: 'app',
            api: 'api',
            db: 'db',
            hq: 'headquarters',
            uploads: 'uploads',
            www: 'www',
            infosphere: 'infosphere'
        },
        services: function() {
            return {}
        }
    },
    sisyphus: {
        port_ssl: 443,
        port_redirect: 80,
        default_domain: 'sisyphus.withease.io',
        folders: {},
        base_dir    : '/services',
        base_certs: '/etc/letsencrypt/live/',
        servers: function() {
            return {
                app: {
                    dir: this.base_dir + '/siscloud',
                    port: 3001,
                    has_server: true
                },
                api: {
                    dir: this.base_dir + '/sisapi',
                    port: 3005,
                    has_server: true
                }
            }
        },
        services: function () {
            return {
                api: {
                    dir: this.base_dir + '/sisapi',
                    address: 'localhost',
                    port: 3005,
                    ansible_port: 8092,
                    connect: []
                }
            }
        }
    },
    travis: {
        port_ssl: 3101,
        port_redirect: 3000,
        default_domain: 'dev.withease.io',
        folders: {},
        base_dir    : '/Users/kiefertravis/Documents/ease',
        base_certs  : '/Users/kiefertravis/Documents/ease/sisproxy/certs/',
    },
};

var config_obj = config.base;
if (process.env.NODE_ENV != undefined) {
    var envs = process.env.NODE_ENV.split('_');
    _.each(envs, function(env) {
        if (config[env] != undefined) _.extend(config_obj, config[env]);
    });
}

// run functions to eliminate them
var keys = Object.keys(config_obj);
_.each(keys, function(key) {
    if (_.isFunction(config_obj[key])) {
        config_obj[key] = config_obj[key]();
    }
});

module.exports = config_obj;

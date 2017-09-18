var _ = require('underscore');

var config = {
  base: {
    version: '1.1.0b',
    include_https: true,
    port_ssl: 443,
    port_redirect: 80,
    default_domain: 'sisyphus.withease.io',
    folders: {
      cloud: 'siscloud',
      api: 'sisapi',
      sisbot: 'sisbot',
      proxy: 'sisproxy',
      app: 'siscloud'
    },
    base_dir: '/services',
    base_certs: '/etc/letsencrypt/live/',
    service_versions: {
      proxy: '0.0.1',
      app: '0.0.1',
      api: '0.0.1',
      sisbot: '0.0.1',
    },
    service_branches: { // assume master, is fetched on node start
      proxy: 'master',
      app: 'master',
      api: 'master',
      sisbot: 'master',
    },
    servers: function() {
      return {
        app: {
          dir: this.base_dir + '/' + this.folders.cloud,
          port: 3001,
          has_server: true
        },
        siscloud: {
          dir: this.base_dir + '/' + this.folders.cloud,
          port: 3001,
          has_server: true
        },
        api: {
          dir: this.base_dir + '/' + this.folders.api,
          port: 3005,
          has_server: true
        }
      }
    },
    services: function() {
      return {
        api: {
          dir: this.base_dir + '/' + this.folders.api,
          address: 'localhost',
          port: 3005,
          ansible_port: 8092,
          connect: []
        }
      }
    }
  },
  sisbot: {
    include_https: false,
    default_domain: 'sisbot.local',
    folders: {
      cloud: 'siscloud',
      sisbot: 'sisbot',
      proxy: 'sisproxy',
      app: 'siscloud',
    },
    service_versions: {
      proxy: '0.0.1',
      app: '0.0.1',
      sisbot: '0.0.1',
    },
    base_dir: '/home/pi/sisbot-server',
    base_certs: '/home/pi/sisbot-server/sisproxy/certs',
    servers: function() {
      return {
        app: {
          dir: this.base_dir + '/' + this.folders.cloud,
          port: 3001,
          has_server: true
        },
        sisbot: {
          dir: this.base_dir + '/' + this.folders.sisbot,
          port: 3002,
          has_server: true
        }
      }
    },
    services: function() {
      return {
        sisbot: {
          dir: this.base_dir + '/' + this.folders.sisbot,
          address: 'localhost',
          port: 3002,
          ansible_port: 8091,
          connect: []
        }
      }
    }
  },
  travis: {
    port_ssl: 3101,
    port_redirect: 3000,
    default_domain: 'sisyphus.dev.withease.io',
    base_dir: '/Users/kiefertravis/Documents/sisyphus',
    base_certs: '/Users/kiefertravis/Documents/sisyphus/proxy/certs/',
    folders: {
      cloud: 'app',
      api: 'api',
      sisbot: 'sisbot',
      proxy: 'proxy',
      app: 'app'
    },
  },
  matt: {
    port_ssl: 3101,
    port_redirect: 3000,
    default_domain: 'dev.withease.io',
    folders: {
      cloud: 'cloud',
      api: 'api'
    },
    base_dir: '/Users/mattfox12/Documents/Sodo/Ease/Sisyphus',
    base_certs: '/Users/mattfox12/Documents/Sodo/Ease/Sisyphus/proxy/certs/',
  },
  debug: {
    debug: true
  }
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

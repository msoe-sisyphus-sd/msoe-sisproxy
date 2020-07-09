var _ = require('underscore');

var config = {
  base: {
    version: '1.3.19', // check network files on startup
    is_pi: false,
    include_https: true,
    port_ssl: 443,
    port_redirect: 80,
    default_domain: 'sisyphus.withease.io',
    folders: {
      cloud: 'sisyphus_cloud',
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
      sisbot: '0.0.1'
    },
    service_branches: { // assume master, is fetched on node start
      proxy: 'master',
      app: 'master',
      api: 'master',
      sisbot: 'master'
    },
    servers: function() {
      return {
        app: {
          dir: this.base_dir + '/' + this.folders.app,
          port: 3001,
          has_server: true
        },
        siscloud: {
          dir: this.base_dir + '/' + this.folders.cloud,
          port: 3002,
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
        app: {
          dir: this.base_dir + '/' + this.folders.app,
          address: 'localhost',
          port: 3001,
          connect: []
        },
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
    is_pi: true,
    include_https: false,
    default_server: 'app',
    default_domain: 'sisyphus.local',
    folders: {
      sisbot: 'sisbot',
      proxy: 'sisproxy',
      app: 'siscloud',
      logs: '/var/log/sisyphus/'
    },
    service_versions: {
      proxy: '0.0.1',
      app: '0.0.1',
      sisbot: '0.0.1',
    },
    base_dir: '/home/pi/sisbot-server',
    base_certs: '/home/pi/sisbot-server/sisproxy/certs',
    recovery_dir: '/home/pi/sis_recovery',
    recovery_v: 1004018, // change this to higher number if we change recovery_archiveUpdate.sh
    servers: function() {
      return {
        app: {
          dir: this.base_dir + '/' + this.folders.app,
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
        app: {
          dir: this.base_dir + '/' + this.folders.app,
          address: 'localhost',
          port: 3001,
          has_server: true
        },
        sisbot: {
          dir: this.base_dir + '/' + this.folders.sisbot,
          address: 'localhost',
          port: 3002,
          ansible_port: 8091,
          connect: ['api']
        },
        api: {
          address: 'webcenter.sisyphus-industries.com',
          port: 3005,
          ansible_port: 8092,
          is_register: true,
          connect: []
        }
      }
    }
  },
  training: {
    is_pi: false,
    folders: {
      sisbot: 'sisbot',
      proxy: 'sisproxy',
      app: 'siscloud',
      training_grounds: 'training_grounds',
      logs: '/var/log/sisyphus/'
    },
    service_versions: {
      proxy: '0.0.1',
      app: '0.0.1'
    },
    servers: function() {
      return {
        app: {
          dir: this.base_dir + '/' + this.folders.app,
          port: 3001,
          has_server: true
        },
        training_grounds: {
          dir: this.base_dir + '/' + this.folders.training_grounds,
          port: 3003,
          has_server: true
        }
      }
    },
    services: function() {
      return {
        app: {
          dir: this.base_dir + '/' + this.folders.app,
          address: 'localhost',
          port: 3001,
          has_server: true
        },
        training_grounds: {
          dir: this.base_dir + '/' + this.folders.training_grounds,
          address: 'localhost',
          port: 3003,
          ansible_port: 8093
        },
        api: {
          address: 'webcenter.sisyphus-industries.com',
          port: 3005,
          ansible_port: 8092,
          is_register: true,
          connect: []
        }
      }
    }
  },
  // joel: {
  //   port_ssl: 3101,
  //   port_redirect: 3000,
  //   default_domain: 'sisyphus.dev.withease.io',
  //   base_dir: '/Users/JoelS/code/sisyphus',
  //   base_certs: '/Users/JoelS/code/sisyphus/sisproxy/certs',
  //   folders: {
  //     cloud: 'app',
  //     api: 'api',
  //     sisbot: 'sisbot',
  //     proxy: 'proxy',
  //     app: 'siscloud'
  //   },
  //   servers: function() {
  //     return {
  //       app: {
  //         dir: this.base_dir + '/' + this.folders.app,
  //         port: 3001,
  //         has_server: true
  //       }
  //     }
  //   },
  //   services: function() {
  //     return {
  //       app: {
  //         dir: this.base_dir + '/' + this.folders.app,
  //         address: 'localhost',
  //         port: 3001,
  //         has_server: true
  //       }
  //     }
  //   }
  // },
  curtis: {
    is_pi: false,
    port_ssl: 3101,
    port_redirect: 3100,
    default_domain: 'sisyphus.dev.withease.io',
    base_dir: '/Users/curtismorice/Sites/sisyphus_master/',
    base_certs: '/Users/curtismorice/Sites/sisyphus_master/sisproxy/certs/',
    folders: {
      cloud: 'app',
      api: 'api',
      sisbot: 'sisbot',
      proxy: 'sisproxy',
      app: 'siscloud',
      training: 'training_grounds'
    },
    servers: function() {
      return {
        app: {
          dir: this.base_dir + '/' + this.folders.app,
          port: 3001,
          has_server: true
        },

      }
    },
    services: function() {
      return {
        app: {
          dir: this.base_dir + '/' + this.folders.app,
          address: 'localhost',
          port: 3001,
          has_server: true
        },

      }
    }
  },
  matt: {
    pi_serial: "0000000000000000",
    is_pi: false,
    port_ssl: 3101,
    port_redirect: 3000,
    default_domain: 'dev.withease.io',
    folders: {
      cloud: 'sisyphus_cloud',
      api: 'api',
      sisbot: 'sisbot',
      proxy: 'proxy',
      app: 'cloud',
      training_grounds: 'training_grounds',
      logs: '/Users/mattfox12/Documents/Sodo/Ease/Sisyphus/logs'
    },
    base_dir: '/Users/mattfox12/Documents/Sodo/Ease/Sisyphus',
    base_certs: '/Users/mattfox12/Documents/Sodo/Ease/Sisyphus/proxy/certs/'
  },
  // wc: {
  //   services: function() {
  //     return {
  //       app: {
  //         dir: this.base_dir + '/' + this.folders.app,
  //         address: 'localhost',
  //         port: 3001,
  //         has_server: true
  //       },
  //       sisbot: {
  //         dir: this.base_dir + '/' + this.folders.sisbot,
  //         address: 'localhost',
  //         port: 3002,
  //         ansible_port: 8091,
  //         connect: ['api']
  //       },
  //       api: {
  //         address: '192.168.86.20',
  //         // address: '54.237.23.209',
  //         port: 3005,
  //         ansible_port: 8092,
  //         is_register: true,
  //         connect: []
  //       }
  //     }
  //   }
  // },
  debug: {
    debug: true
  },
  console: {
    console: true
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

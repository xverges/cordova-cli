/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/
var events = require('../events'),
    fs     = require('fs'),
    path   = require('path'),
    Q      = require('q'),
    shell  = require('shelljs'),
    util   = require('../util');

function rereadJsonFile(f) {
    var mod = require.resolve(f);
    if (require.cache[mod]) {
        delete require.cache[mod];
    }
    return require(f);
}

module.exports = function nodewebkit_parser(project) {
    this.path = path.resolve(project);
    this.packagejson = path.join(this.path, 'app', 'package.json');
    if (!fs.existsSync(this.packagejson)) {
        throw new Error('The provided path "' + project + '" is not a cordova-nodewebkit project.');
    }
};

// Returns a promise.
module.exports.check_requirements = function(/*project_root*/) {
    // Requiremnts always met
    return Q(); // jshint ignore:line
};


module.exports.prototype = {
    // Returns the platform-specific www directory.
    www_dir:function() {
        return path.join(this.path, 'app', 'www');
    },
    config_xml:function() {
        return path.join(this.path, 'config.xml');
    },
    cordovajs_path:function(libDir) {
        var jsPath = path.join(libDir, 'cordova-lib', 'cordova.js');
        return path.resolve(jsPath);
    },
    update_from_config:function(config_parser) {
        var cfg = rereadJsonFile(this.packagejson),
            name = config_parser.name();
        if (cfg.name !== name) {
            cfg.name = name;
            if (cfg.window === undefined) {
                cfg.window = {};
            }
            cfg.window.title = name;
            fs.writeFileSync(this.packagejson, JSON.stringify(cfg, null, 4));
            events.emit('verbose',
                        'Wrote out node-webkit application name to "' + name + '"');
        }
        return Q(); //jshint ignore:line
    },
    staging_dir: function() {
        return path.join(this.path, '.staging', 'www');
    },

    // Replace the www dir with contents of platform_www and app www.
    update_www:function() {
        var projectRoot = util.isCordova(this.path);
        var app_www = util.projectWww(projectRoot);
        var platform_www = path.join(this.path, 'platform_www');

        // Clear the www dir
        shell.rm('-rf', this.www_dir());
        shell.mkdir(this.www_dir());
        // Copy over all app www assets
        shell.cp('-rf', path.join(app_www, '*'), this.www_dir());
        // Copy over stock platform www assets (cordova.js)
        shell.cp('-rf', path.join(platform_www, '*'), this.www_dir());
    },

    // update the overrides folder into the www folder
    update_overrides:function() {
        var projectRoot = util.isCordova(this.path);
        var merges_path = path.join(util.appDir(projectRoot), 'merges', 'nodewebkit');
        if (fs.existsSync(merges_path)) {
            var overrides = path.join(merges_path, '*');
            shell.cp('-rf', overrides, this.www_dir());
        }
    },

    // update the staging-plugins folder into the www folder
    update_staging:function() {
        if (fs.existsSync(this.staging_dir())) {
            var staging = path.join(this.staging_dir(), '*');
            shell.cp('-rf', staging, this.www_dir());
        }
    },
    
    // Returns a promise.
    update_project:function(cfg) {
        var self = this;
        return this.update_from_config(cfg)
        .then(function() {
            self.update_overrides();
            self.update_staging();
            util.deleteSvnFolders(self.www_dir());
        });
    }
};



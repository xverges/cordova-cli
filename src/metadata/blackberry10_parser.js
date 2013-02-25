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
var fs            = require('fs'),
    path          = require('path'),
    et            = require('elementtree'),
    shell         = require('shelljs'),
    util          = require('util'),
    cordova_util  = require('../util'),
    config_parser = require('../config_parser'),
    exec          = require('child_process').exec;

module.exports = function blackberry10_parser(project) {
    if (!fs.existsSync(path.join(project, 'project.json'))) {
        throw new Error('The provided path "' + project + '" is not a Cordova BlackBerry 10 project.');
    }
    this.path = project;
    this.config_path = path.join(this.path, 'www', 'config.xml');
    this.xml = new config_parser(this.config_path);
};

module.exports.check_requirements = function(callback) {
    var childProcess = exec(path.join(cordova_util.libDirectory, "cordova-blackberry/blackberry10/bin/check_reqs"));
    childProcess.on("exit", function (code) {
        if (code === 0) {
            callback(false);
        } else {
            callback("BB10 NDK not found. Please install and run bbndk-env to setup environment variables.");
        }
    });
};

module.exports.prototype = {
    update_from_config:function(config) {
        if (config instanceof config_parser) {
        } else throw 'update_from_config requires a config_parser object';

        this.xml.name(config.name());
        this.xml.packageName(config.packageName());
        this.xml.access.remove();
        var self = this;
        this.xml.doc.findall('access').forEach(function(a) {
            self.xml.doc.getroot().remove(0, a);
        });
        config.access.get().forEach(function(uri) {
            var el = new et.Element('access');
            el.attrib.uri = uri;
            el.attrib.subdomains = 'true';
            self.xml.doc.getroot().append(el);
        });
        this.xml.update();
    },
    update_project:function(cfg, callback) {
        this.update_from_config(cfg);
        this.update_www();
        if (callback) { callback(); }
    },

    // Returns the platform-specific www directory.
    www_dir:function() {
        return path.join(this.path, 'www');
    },

    // update the overrides folder into the www folder
    update_overrides:function() {
        var projectRoot = cordova_util.isCordova(this.path);
        var merges_path = path.join(projectRoot, 'merges', 'blackberry10');
        if (fs.existsSync(merges_path)) {
            var overrides = path.join(merges_path, '*');
            shell.cp('-rf', overrides, this.www_dir());
        }
    },

    update_www:function() {
        var projectRoot = cordova_util.isCordova(this.path);
        var www = path.join(projectRoot, 'www');
        var platformWww = this.www_dir();

        var finalWww = path.join(this.path, 'finalwww');
        shell.mkdir('-p', finalWww);

        // replace stock bb app contents with app contents.
        // to keep:
        //        - config.xml
        //        - cordova.js
        //        - res
        shell.cp('-f', path.join(platformWww, 'config.xml'), finalWww);
        shell.cp('-f', path.join(platformWww, 'cordova-*.js'), finalWww);
        shell.cp('-rf', path.join(platformWww, 'res'), finalWww);

        // Copy everything over from platform-agnostic www, except config.xml
        var cfg_www = path.join(www, 'config.xml');
        var temp_cfg = path.join(projectRoot, 'config.xml');
        shell.mv(cfg_www, temp_cfg);
        shell.cp('-rf', path.join(www, '*'), finalWww);
        shell.mv(temp_cfg, cfg_www);

        // Delete the old platform www, and move the final project over
        shell.rm('-rf', platformWww);
        shell.mv(finalWww, platformWww);

        cordova_util.deleteSvnFolders(platformWww);
    }
};

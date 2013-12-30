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
var events = require('../../src/events'),
    platforms = require('../../platforms'),
    util = require('../../src/util'),
    path = require('path'),
    shell = require('shelljs'),
    fs = require('fs'),
    Q = require('q'),
    os = require('os'),
    config = require('../../src/config');

var cliproj = path.join(os.tmpdir(), 'cordova-nodewebkit-tests', 'cli-tst');


function createFakeProject() {
    var project = path.join(cliproj, 'platforms', 'nodewebkit'),
        cfg = {
            main: 'www/index.html',
            name: 'cli-tst',
            window: {title: 'cli-tst'}
        };

    if (!shell.test('-d', cliproj)) {
        shell.mkdir('-p', cliproj);
    } else {
        shell.rm('-rf', path.join(cliproj, '*'));
    }
    shell.mkdir('-p', path.join(cliproj, 'www'));
    shell.mkdir('-p', path.join(cliproj, 'merges', 'nodewebkit'));
    shell.mkdir('-p', path.join(project, 'app', 'www'));
    shell.mkdir('-p', path.join(project, '.staging', 'www'));

    fs.writeFileSync(path.join(project, 'app', 'package.json'),
                     JSON.stringify(cfg, null, 4));
    return project;
}

function rereadJsonFile(f) {
    var mod = require.resolve(f);
    if (require.cache[mod]) {
        delete require.cache[mod];
    }
    return require(f);
}


describe('nodewebkit project parser', function() {
    beforeEach(function() {
        spyOn(config, 'has_custom_path').andReturn(false);
    });

    function wrapper(p, done, post) {
        p.then(post, function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }

    function errorWrapper(p, done, post) {
        p.then(function() {
            expect('this call').toBe('fail');
        }, post).fin(done);
    }

    describe('constructions', function() {
        it('should throw if provided directory does not contain app/package.json', function() {
            var proj = path.join('some', 'path');
            expect(function() {
                // jshint -W031
                new platforms.nodewebkit.parser(proj);
                // jshint +W031
            }).toThrow('The provided path "' + proj + '" is not a cordova-nodewebkit project.');
        });
        it('should create an instance with path and packagejson properties', function() {
            var proj = createFakeProject();
            expect(function() {
                var p = new platforms.nodewebkit.parser(proj);
                expect(p.path).toEqual(path.resolve(proj));
                expect(p.packagejson).toEqual(path.join(p.path, 'app', 'package.json'));
            }).not.toThrow();
        });
    });

    describe('instance', function() {
        var p, cp, rm, mkdir, is_cordova, write, read;
        var nodewebkit_proj,
            packagejson_path; // = path.join(proj, 'platforms', 'nodewebkit');
        beforeEach(function() {
            nodewebkit_proj = createFakeProject();
            packagejson_path = path.join(nodewebkit_proj, 'app', 'package.json');
            p = new platforms.nodewebkit.parser(nodewebkit_proj);
            cp = spyOn(shell, 'cp').andCallThrough();
            rm = spyOn(shell, 'rm').andCallThrough();
            is_cordova = spyOn(util, 'isCordova').andReturn(cliproj);
            write = spyOn(fs, 'writeFileSync').andCallThrough();
            read = spyOn(fs, 'readFileSync').andCallThrough();
            mkdir = spyOn(shell, 'mkdir').andCallThrough();
        });

        describe('update_from_config method', function() {
            var cfg_parser;
            beforeEach(function() {
                cfg_parser = {};
                cfg_parser.access = {};
                cfg_parser.preference = {};
                cfg_parser.name = function() { return 'testname'; };
            });

            it('should return a promise', function() {
                var promise = p.update_from_config(cfg_parser);
                expect(promise.then).toBeDefined();
                expect(typeof promise.then).toBe('function');
            });

            it('should write the app name to app/package.json', function() {
                var packagejson;
                p.update_from_config(cfg_parser);
                packagejson = rereadJsonFile(packagejson_path);
                expect(packagejson.name).toBe('testname');
                expect(packagejson.window.title).toBe('testname');
            });

            it('should log (events.emit()) progress', function() {
                var log = spyOn(events, 'emit');
                p.update_from_config(cfg_parser);
                expect(log).toHaveBeenCalledWith('verbose',
                                                 'Wrote out node-webkit application name to "testname"');
            });

            it('should not update window.title if app name not changed', function() {
                var packagejson = rereadJsonFile(packagejson_path);
                packagejson.name = 'testname';
                fs.writeFileSync(packagejson_path,
                                 JSON.stringify(packagejson, null, 4));

                p.update_from_config(cfg_parser);
                packagejson = rereadJsonFile(packagejson_path);
                expect(packagejson.name).toBe('testname');
                expect(packagejson.window.title).toBe('cli-tst');
            });
        });
        describe('www_dir method', function() {
            it('should return <nwPrj>/app/www', function() {
                expect(p.www_dir()).toEqual(path.join(nodewebkit_proj,
                                                      'app',
                                                      'www'));
            });
        });
        describe('staging_dir method', function() {
            it('should return <nwPrj>/.staging/www', function() {
                expect(p.staging_dir()).toEqual(path.join(nodewebkit_proj, '.staging', 'www'));
            });
        });
        describe('config_xml method', function() {
            it('should return <nwPrj>/config.xml', function() {
                expect(p.config_xml()).toEqual(path.join(nodewebkit_proj,
                                                         'config.xml'));
            });
        });
        describe('update_www method', function() {
            it('should replace www with <cliPrj>/wwww + <nwPrj>/platform_www', function() {
                var cliPrjWww = path.join(cliproj, 'www'),
                    nwPrjPlatWww = path.join(nodewebkit_proj, 'platform_www'),
                    toBeRemoved = path.join(p.www_dir(), 'obsolete'),
                    onlyInCliPrj = path.join(cliPrjWww, 'inCliPrj'),
                    tgtOnlyInCliPrj = path.join(p.www_dir(), 'inCliPrj'),
                    inBothLoser = path.join(cliPrjWww, 'inBoth.json'),
                    inBothWinner = path.join(nwPrjPlatWww, 'inBoth.json'),
                    tgtInBoth = path.join(p.www_dir(), 'inBoth.json');

                (function fakePrepareThatCreatesNwPrjPlatWww() {
                    shell.mkdir(nwPrjPlatWww);
                })();

                fs.writeFileSync(toBeRemoved, 'old file');
                fs.writeFileSync(onlyInCliPrj, 'only in <cliPrj>/www');
                fs.writeFileSync(inBothLoser,
                                 JSON.stringify({winner: false}, null, 4));
                fs.writeFileSync(inBothWinner,
                                 JSON.stringify({winner: true}, null, 4));

                p.update_www();

                expect(shell.test('-f', toBeRemoved)).toBeFalsy();
                expect(shell.test('-f', tgtOnlyInCliPrj)).toBeTruthy();
                expect(rereadJsonFile(tgtInBoth).winner).toBeTruthy();
            });
        });
        describe('update_overrides method', function() {
            it('should copy <cliPrj>/merges/nodewebkit into <nwPrj>/www', function() {
                var inWww = path.join(p.www_dir(), 'toBeReplaced.json'),
                    inMerges = path.join(cliproj, 'merges', 'nodewebkit', 'toBeReplaced.json');

                fs.writeFileSync(inWww,
                                 JSON.stringify({winner: false}, null, 4));
                fs.writeFileSync(inMerges,
                                 JSON.stringify({winner: true}, null, 4));
                expect(rereadJsonFile(inWww).winner).toBeFalsy();

                p.update_overrides();
                expect(rereadJsonFile(inWww).winner).toBeTruthy();
            });
        });
        describe('update_staging method', function() {
            it('should copy <nwPrj>/.staging/www into <nwPrj>/www', function() {
                var inWww = path.join(p.www_dir(), 'toBeReplaced.json'),
                    inStaging = path.join(p.staging_dir(), 'toBeReplaced.json');

                fs.writeFileSync(inWww,
                                 JSON.stringify({winner: false}, null, 4));
                fs.writeFileSync(inStaging,
                                 JSON.stringify({winner: true}, null, 4));
                expect(rereadJsonFile(inWww).winner).toBeFalsy();

                p.update_staging();
                expect(rereadJsonFile(inWww).winner).toBeTruthy();
            });
        });
        describe('update_project method', function() {
            var config, www, overrides, staging, svn;
            beforeEach(function() {
                config = spyOn(p, 'update_from_config').andReturn(Q()); // jshint ignore:line 
                www = spyOn(p, 'update_www');
                overrides = spyOn(p, 'update_overrides');
                staging = spyOn(p, 'update_staging');
                svn = spyOn(util, 'deleteSvnFolders');
            });
            it('should call update_from_config', function(done) {
                wrapper(p.update_project(), done, function() {
                    expect(config).toHaveBeenCalled();
                });
            });
            it('should throw if update_from_config errors', function(done) {
                var e = new Error('uh oh!');
                config.andReturn(Q.reject(e));
                errorWrapper(p.update_project({}), done, function(err) {
                    expect(err).toEqual(e);
                });
            });
            it('should not call update_www', function(done) {
                wrapper(p.update_project({}), done, function() {
                    expect(www).not().toHaveBeenCalled();
                });
            });
            it('should call update_overrides', function(done) {
                wrapper(p.update_project(), done, function() {
                    expect(overrides).toHaveBeenCalled();
                });
            });
            it('should call update_staging', function(done) {
                wrapper(p.update_project(), done, function() {
                    expect(staging).toHaveBeenCalled();
                });
            });
            it('should call deleteSvnFolders', function(done) {
                wrapper(p.update_project(), done, function() {
                    expect(svn).toHaveBeenCalled();
                });
            });
        });
    });
});

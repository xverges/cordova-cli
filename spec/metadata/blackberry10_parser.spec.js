
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
var blackberry10_parser = require('../../src/metadata/blackberry10_parser'),
    config_parser = require('../../src/config_parser'),
    path = require('path'),
    util = require('../../src/util'),
    et = require('elementtree'),
    shell = require('shelljs'),
    cordova = require('../../cordova'),
    fs = require('fs'),
    projects_path = path.join(__dirname, '..', 'fixtures', 'projects'),
    blackberry10_path = path.join(projects_path, 'native', 'blackberry10_fixture'),
    project_path = path.join(projects_path, 'cordova'),
    blackberry10_project_path = path.join(project_path, 'platforms', 'blackberry10');

var www_config = path.join(project_path, 'www', 'config.xml');
var original_www_config = fs.readFileSync(www_config, 'utf-8');

describe('blackberry10 project parser', function() {
    it('should throw an exception with a path that is not a native blackberry10 project', function() {
        expect(function() {
            var project = new blackberry10_parser(process.cwd());
        }).toThrow();
    });
    it('should accept a proper native blackberry10 project path as construction parameter', function() {
        var project;
        expect(function() {
            project = new blackberry10_parser(blackberry10_path);
        }).not.toThrow();
        expect(project).toBeDefined();
    });

    describe('check_requirements method', function () {
        var original_qnx_host = process.env.QNX_HOST;
        var original_qnx_target = process.env.QNX_TARGET;
        var original_path = process.env.PATH;

        var mock_env_defined = function() {
            process.env.QNX_HOST = '/foo/bar';
            process.env.QNX_TARGET = '/foo/target';
            process.env.PATH = original_path + ':/a/b/c:/foo/bar';
        };
        var mock_env_undefined = function() {
            process.env.QNX_HOST = undefined;
            process.env.QNX_TARGET = undefined;
            process.env.PATH = original_path + ':/a/b/c';
        };

        afterEach(function() {
            process.env.QNX_HOST = original_qnx_host;
            process.env.QNX_TARGET = original_qnx_target;
            process.env.PATH = original_path;
        });

        it('should invoke callback with false if BB10 NDK is installed', function() {
            var callback = jasmine.createSpy();
            mock_env_defined();
            blackberry10_parser.check_requirements(callback);

            waitsFor(function () {
                return callback.callCount;
            }, "BB10 checkReqs script to run", 2000);

            runs(function () {
                expect(callback).toHaveBeenCalledWith(false);
            });
        });

        it('should invoke callback with message if BB10 NDK is not installed', function() {
            var callback = jasmine.createSpy();
            mock_env_undefined();
            blackberry10_parser.check_requirements(callback);

            waitsFor(function () {
                return callback.callCount;
            }, "BB10 checkReqs script to run", 2000);

            runs(function () {
                expect(callback).toHaveBeenCalledWith(jasmine.any(String));
            });
        });
    });

    describe('update_from_config method', function() {
        var project, config;

        var blackberry10_config = path.join(blackberry10_path, 'www', 'config.xml');
        var original_blackberry10_config = fs.readFileSync(blackberry10_config, 'utf-8');

        beforeEach(function() {
            project = new blackberry10_parser(blackberry10_path);
            config = new config_parser(www_config);
        });
        afterEach(function() {
            fs.writeFileSync(blackberry10_config, original_blackberry10_config, 'utf-8');
            fs.writeFileSync(www_config, original_www_config, 'utf-8');
        });
        it('should throw an exception if a non config_parser object is passed into it', function() {
            expect(function() {
                project.update_from_config({});
            }).toThrow();
        });
        it('should update the application name properly', function() {
            config.name('bond. james bond.');
            project.update_from_config(config);

            var bb_cfg = new config_parser(blackberry10_config);

            expect(bb_cfg.name()).toBe('bond. james bond.');
        });
        it('should update the application package name properly', function() {
            config.packageName('sofa.king.awesome');
            project.update_from_config(config);

            var bb_cfg = new config_parser(blackberry10_config);
            expect(bb_cfg.packageName()).toBe('sofa.king.awesome');
        });
        describe('whitelist', function() {
            it('should update the whitelist when using access elements with origin attribute', function() {
                config.access.remove('*');
                config.access.add('http://blackberry.com');
                config.access.add('http://rim.com');
                project.update_from_config(config);

                var bb_cfg = new et.ElementTree(et.XML(fs.readFileSync(blackberry10_config, 'utf-8')));
                var as = bb_cfg.getroot().findall('access');
                expect(as.length).toEqual(2);
                expect(as[0].attrib.uri).toEqual('http://blackberry.com');
                expect(as[1].attrib.uri).toEqual('http://rim.com');
            });
            it('should update the whitelist when using access elements with uri attributes', function() {
                fs.writeFileSync(www_config, fs.readFileSync(www_config, 'utf-8').replace(/origin="\*/,'uri="http://rim.com'), 'utf-8');
                config = new config_parser(www_config);
                project.update_from_config(config);

                var bb_cfg = new et.ElementTree(et.XML(fs.readFileSync(blackberry10_config, 'utf-8')));
                var as = bb_cfg.getroot().findall('access');
                expect(as.length).toEqual(1);
                expect(as[0].attrib.uri).toEqual('http://rim.com');
            });
        });
    });

    describe('cross-platform project level methods', function() {
        var parser, config;

        var blackberry10_config = path.join(blackberry10_project_path, 'www', 'config.xml');
        var original_blackberry_config = fs.readFileSync(blackberry10_config, 'utf-8');

        beforeEach(function() {
            parser = new blackberry10_parser(blackberry10_project_path);
            config = new config_parser(www_config);
        });
        afterEach(function() {
            fs.writeFileSync(blackberry10_config, original_blackberry_config, 'utf-8');
            fs.writeFileSync(www_config, original_www_config, 'utf-8');
        });

        describe('update_www method', function() {
            it('should update all www assets', function() {
                var newFile = path.join(project_path, 'www', 'somescript.js');
                this.after(function() {
                    shell.rm('-f', newFile);
                });
                fs.writeFileSync(newFile, 'alert("sup");', 'utf-8');
                parser.update_www();
                expect(fs.existsSync(path.join(blackberry10_project_path, 'www', 'somescript.js'))).toBe(true);
            });
            it('should not overwrite the blackberry10-specific config.xml', function() {
                var www_cfg = fs.readFileSync(path.join(project_path, 'www', 'config.xml'), 'utf-8');
                parser.update_www();
                var bb_cfg = fs.readFileSync(blackberry10_config, 'utf-8');
                expect(bb_cfg).not.toBe(www_cfg);
            });
        });

        describe('update_overrides method',function() {
            var mergesPath = path.join(project_path, 'merges', 'blackberry10');
            var newFile = path.join(mergesPath, 'merge.js');
            beforeEach(function() {
                shell.mkdir('-p', mergesPath);
                fs.writeFileSync(newFile, 'alert("sup");', 'utf-8');
            });
            afterEach(function() {
                shell.rm('-rf', mergesPath);
            });

            it('should copy a new file from merges into www', function() {
                parser.update_overrides();
                expect(fs.existsSync(path.join(blackberry10_project_path, 'www', 'merge.js'))).toBe(true);
            });

            it('should copy a file from merges over a file in www', function() {
                var newFileWWW = path.join(project_path, 'www','merge.js');
                fs.writeFileSync(newFileWWW, 'var foo=1;', 'utf-8');
                this.after(function() {
                    shell.rm('-rf', newFileWWW);
                });
                parser.update_overrides();
                expect(fs.existsSync(path.join(blackberry10_project_path, 'www', 'merge.js'))).toBe(true);
                expect(fs.readFileSync(path.join(blackberry10_project_path, 'www', 'merge.js'),'utf-8')).toEqual('alert("sup");');
            });
        });

        describe('update_project method', function() {
            it('should invoke update_www', function() {
                spyOn(parser, 'update_www');
                parser.update_project(config);
                expect(parser.update_www).toHaveBeenCalled();
            });
            it('should invoke update_from_config', function() {
                spyOn(parser, 'update_from_config');
                parser.update_project(config);
                expect(parser.update_from_config).toHaveBeenCalled();
            });
        });
    });
});

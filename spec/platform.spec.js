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
var cordova = require('../cordova'),
    path = require('path'),
    shell = require('shelljs'),
    request = require('request'),
    fs = require('fs'),
    et = require('elementtree'),
    config_parser = require('../src/config_parser'),
    helper = require('./helper'),
    util = require('../src/util'),
    hooker = require('../src/hooker'),
    platforms = require('../platforms'),
    tempDir = path.join(__dirname, '..', 'temp'),
    android_parser = require('../src/metadata/android_parser'),
    ios_parser = require('../src/metadata/ios_parser'),
    cordova_project = path.join(__dirname, 'fixtures', 'projects', 'cordova'),
    blackberry10_parser = require('../src/metadata/blackberry10_parser');

var cwd = process.cwd();

describe('platform command', function() {
    beforeEach(function() {
        // Make a temp directory
        shell.rm('-rf', tempDir);
        shell.mkdir('-p', tempDir);
    });
    it('should run inside a Cordova-based project', function() {
        this.after(function() {
            process.chdir(cwd);
        });

        cordova.create(tempDir);

        process.chdir(tempDir);

        expect(function() {
            cordova.platform();
        }).not.toThrow();
    });
    it('should not run outside of a Cordova-based project', function() {
        this.after(function() {
            process.chdir(cwd);
        });

        process.chdir(tempDir);

        expect(function() {
            cordova.platform();
        }).toThrow();
    });

    describe('`ls`', function() {
        beforeEach(function() {
            process.chdir(cordova_project);
        });

        afterEach(function() {
            process.chdir(cwd);
        });

        it('should list out no platforms for a fresh project', function() {
            shell.mv('-f', path.join(cordova_project, 'platforms', '*'), tempDir);
            this.after(function() {
                shell.mv('-f', path.join(tempDir, '*'), path.join(cordova_project, 'platforms'));
            });
            expect(cordova.platform('list').length).toEqual(0);
        });

        it('should list out added platforms in a project', function() {
            expect(cordova.platform('list').length).toEqual(3);
        });
    });

    describe('`add`', function() {
        beforeEach(function() {
            cordova.create(tempDir);
            process.chdir(tempDir);
        });

        afterEach(function() {
            process.chdir(cwd);
        });

        describe('android', function() {
            var sh, cr;
            var fake_reqs_check = function() {
                cr.mostRecentCall.args[0](false);
            };
            var fake_create = function(a_path) {
                shell.mkdir('-p', a_path);
                fs.writeFileSync(path.join(a_path, 'AndroidManifest.xml'), 'hi', 'utf-8');
                sh.mostRecentCall.args[2](0, '');
            };
            beforeEach(function() {
                sh = spyOn(shell, 'exec');
                cr = spyOn(android_parser, 'check_requirements');
            });

            it('should shell out to android ./bin/create', function() {
                cordova.platform('add', 'android');
                fake_reqs_check();
                var shell_cmd = sh.mostRecentCall.args[0];
                expect(shell_cmd).toMatch(/android\/bin\/create/);
            });
            it('should call android_parser\'s update_project', function() {
                var s = spyOn(android_parser.prototype, 'update_project');
                cordova.platform('add', 'android');
                fake_reqs_check();
                fake_create(path.join(tempDir, 'platforms', 'android'));
                expect(s).toHaveBeenCalled();
            });
        });
        describe('ios', function() {
            var sh, cr;
            var fake_reqs_check = function() {
                cr.mostRecentCall.args[0](false);
            };
            var fake_create = function(a_path) {
                shell.mkdir('-p', a_path);
                fs.writeFileSync(path.join(a_path, 'poo.xcodeproj'), 'hi', 'utf-8');
                shell.mkdir('-p', path.join(a_path, 'poo'));
                shell.cp(path.join(cordova_project, 'www', 'config.xml'), path.join(a_path, 'poo', 'config.xml'));
                sh.mostRecentCall.args[2](0, '');
            };
            beforeEach(function() {
                sh = spyOn(shell, 'exec');
                cr = spyOn(ios_parser, 'check_requirements');
            });
            it('should shell out to ios ./bin/create', function() {
                cordova.platform('add', 'ios');
                fake_reqs_check();
                var shell_cmd = sh.mostRecentCall.args[0];
                expect(shell_cmd).toMatch(/ios\/bin\/create/);
            });
            it('should call ios_parser\'s update_project', function() {
                var s = spyOn(ios_parser.prototype, 'update_project');
                cordova.platform('add', 'ios');
                fake_reqs_check();
                fake_create(path.join(tempDir, 'platforms', 'ios'));
                expect(s).toHaveBeenCalled();
            });
        });
        describe('blackberry10', function() {
            var sh, cr;
            var fake_reqs_check = function() {
                cr.mostRecentCall.args[0](false);
            };
            var fake_create = function(a_path) {
                shell.mkdir('-p', path.join(a_path, 'www'));
                fs.writeFileSync(path.join(a_path, 'project.json'), {
                    "appname":"blah",
                    "targets":{}
                }.toString(), 'utf-8');
                shell.cp(path.join(cordova_project, 'www', 'config.xml'), path.join(a_path, 'www', 'config.xml'));
                sh.mostRecentCall.args[2](0, '');
            };
            beforeEach(function () {
                sh = spyOn(shell, 'exec');
                cr = spyOn(blackberry10_parser, 'check_requirements');
            });
            it('should shell out to blackberry10 bin/create', function() {
                cordova.platform('add', 'blackberry10');
                fake_reqs_check();
                var shell_cmd = sh.mostRecentCall.args[0];
                expect(shell_cmd).toMatch(/blackberry10\/bin\/create/);
            });
            it('should call blackberry10_parser\'s update_project', function() {
                var s = spyOn(blackberry10_parser.prototype, 'update_project');
                cordova.platform('add', 'blackberry10');
                fake_reqs_check();
                fake_create(path.join(tempDir, 'platforms', 'blackberry10'));
                expect(s).toHaveBeenCalled();
            });
        });
        it('should handle multiple platforms', function() {
            var arc = spyOn(android_parser, 'check_requirements');
            var irc = spyOn(ios_parser, 'check_requirements');
            var sh = spyOn(shell, 'exec');
            cordova.platform('add', ['android', 'ios']);
            arc.mostRecentCall.args[0](false);
            irc.mostRecentCall.args[0](false);
            expect(sh.argsForCall[0][0]).toMatch(/android\/bin\/create/);
            expect(sh.argsForCall[1][0]).toMatch(/ios\/bin\/create/);
        });
    });

    describe('`remove`',function() {
        it('should remove a supported and added platform', function() {
            process.chdir(cordova_project);

            var initial = cordova.platform('ls').length,
                done = jasmine.createSpy();

            expect(initial).toEqual(3);

            cordova.platform('remove', 'blackberry10');
            expect(cordova.platform('ls').length).toEqual(initial - 1);

            cordova.platform('add', 'blackberry10', done);

            waitsFor(function () {
                return done.callCount;
            }, "platform add blackberry10 to complete", 7500);

            runs(function () {
                expect(cordova.platform('ls').length).toEqual(initial);
            });
        });

        it('should be able to remove multiple platforms', function() {
            process.chdir(cordova_project);
            shell.cp('-rf', path.join(cordova_project, 'platforms' ,'android'), tempDir);
            shell.cp('-rf', path.join(cordova_project, 'platforms' ,'ios'), tempDir);

            var initial = cordova.platform('ls').length;
            expect(initial).toEqual(3);

            cordova.platform('remove', ['android','ios']);
            expect(cordova.platform('ls').length).toEqual(initial - 2);

            process.chdir(cwd);
            shell.cp('-rf', path.join(tempDir, 'android'), path.join(cordova_project, 'platforms'));
            shell.cp('-rf', path.join(tempDir, 'ios'), path.join(cordova_project, 'platforms'));

            process.chdir(cordova_project);
            expect(cordova.platform('ls').length).toEqual(initial);
            process.chdir(cwd);
        });
    });

    describe('hooks', function() {
        var s;
        beforeEach(function() {
            cordova.create(tempDir);
            process.chdir(tempDir);
            s = spyOn(hooker.prototype, 'fire').andReturn(true);
        });
        afterEach(function() {
            process.chdir(cwd);
            shell.rm('-rf', tempDir);
        });

        describe('list (ls) hooks', function() {
            it('should fire before hooks through the hooker module', function() {
                cordova.platform();
                expect(s).toHaveBeenCalledWith('before_platform_ls');
            });
            it('should fire after hooks through the hooker module', function() {
                cordova.platform();
                expect(s).toHaveBeenCalledWith('after_platform_ls');
            });
        });
        describe('remove (rm) hooks', function() {
            it('should fire before hooks through the hooker module', function() {
                cordova.platform('rm', 'android');
                expect(s).toHaveBeenCalledWith('before_platform_rm');
            });
            it('should fire after hooks through the hooker module', function() {
                cordova.platform('rm', 'android');
                expect(s).toHaveBeenCalledWith('after_platform_rm');
            });
        });
        describe('add hooks', function() {
            var sh, cr;
            var fake_reqs_check = function() {
                cr.mostRecentCall.args[0](false);
            };
            var fake_create = function(a_path) {
                shell.mkdir('-p', a_path);
                fs.writeFileSync(path.join(a_path, 'AndroidManifest.xml'), 'hi', 'utf-8');
                sh.mostRecentCall.args[2](0, '');
            };
            beforeEach(function() {
                sh = spyOn(shell, 'exec');
                cr = spyOn(android_parser, 'check_requirements');
            });
            it('should fire before and after hooks through the hooker module', function() {
                var ap = spyOn(android_parser.prototype, 'update_project');
                cordova.platform('add', 'android');
                fake_reqs_check();
                fake_create(path.join(tempDir, 'platforms', 'android'));
                ap.mostRecentCall.args[1](); // fake out update_project
                expect(s).toHaveBeenCalledWith('before_platform_add');
                expect(s).toHaveBeenCalledWith('after_platform_add');
            });
        });
    });
});

#!/usr/bin/env node
'use strict';

var fs       = require('fs-extra'),
	os       = require('os'),
	path     = require('path'),
	execSync = require('child_process').execSync;

require('shelljs/global');

var cmakeString = ['cmake_minimum_required(VERSION 2.4)',
	'find_package(VTK)',
	'if(VTK_FOUND)',
	'    include(${VTK_USE_FILE})',
	'endif(VTK_FOUND)'].join('\n');


var rootDir = path.join(os.homedir(), 'desk') + '/';
var addonsDir = path.join(rootDir, 'extensions/addons');
var cmakeDir = path.join(addonsDir, 'cmakeCheckVersionTool');
rm('-rf', cmakeDir);
fs.mkdirsSync(cmakeDir);
fs.writeFileSync(path.join(cmakeDir, 'CMakeLists.txt'), cmakeString);
var vtkVersion;

execSync("cmake .", {cwd : cmakeDir})
	.toString('utf8')
	.split("\n")
	.forEach(function (line) {
		if (line.indexOf('VTKVERSION') > 0) {
			vtkVersion = parseInt(line.split(" ")[2]);
		}
	});

fs.mkdirsSync(addonsDir);
console.log(addonsDir);
["ACVD", "OpenCTM"].forEach(function (lib) {
	try {
		var directory = path.join(addonsDir, lib);

		rm('-rf', directory);

		var gitCLI = 'git clone https://github.com/valette/' + lib;

		if ((lib === 'ACVD') && (vtkVersion === 5)) {
			gitCLI += " -b vtk5";
		}

		execSync(gitCLI, {cwd : addonsDir, stdio: 'inherit'});

		execSync('cmake . -DCMAKE_BUILD_TYPE=Release', 
			{cwd : directory, stdio: 'inherit'});

		execSync('make -j ' + os.cpus().length,
			{cwd : directory, stdio: 'inherit'});
	} catch (e) {
		console.log("Error : ");
		console.log(e);
	}
});

var actions = {
	"include" : [
		"ACVD/ACVD.json",
		"OpenCTM/OpenCTM.json"
    ]
}

fs.writeFileSync(path.join(addonsDir, 'includes.json'), JSON.stringify(actions));

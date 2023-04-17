#!/usr/bin/env node
'use strict';

const fs       = require('fs-extra'),
	  os       = require('os'),
	  path     = require('path'),
	  execSync = require('child_process').execSync;

require('shelljs/global');

const rootDir = path.join(os.homedir(), 'desk') + '/';
const addonsDir = path.join(rootDir, 'extensions/addons');
fs.mkdirsSync( addonsDir );
console.log( addonsDir );

for ( let lib of ["ACVD", "OpenCTM"] ) {

	try {

		const directory = path.join(addonsDir, lib);

		rm('-rf', directory);

		const gitCLI = 'git clone https://github.com/valette/' + lib;

		execSync(gitCLI, {cwd : addonsDir, stdio: 'inherit'});

		execSync('cmake . -DCMAKE_BUILD_TYPE=Release', 
			{cwd : directory, stdio: 'inherit'});

		execSync('make -j ' + os.cpus().length,
			{cwd : directory, stdio: 'inherit'});

	} catch (e) {

		console.log("Error : ");
		console.log(e);

	}

}

const actions = {
	"include" : [
		"ACVD/ACVD.json",
		"OpenCTM/OpenCTM.json"
    ]
}

fs.writeFileSync(path.join(addonsDir, 'includes.json'), JSON.stringify(actions));

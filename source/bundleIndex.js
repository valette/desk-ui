
//self.bluebird = self.Promise = require('bluebird');

if (typeof importScripts !== 'function') {

	// we are not in a worker
	require( './bundleMain.js');

}


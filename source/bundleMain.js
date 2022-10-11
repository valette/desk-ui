import work from 'webworkify-webpack'

require ('xterm/css/xterm.css');

self.bowser           = require( 'bowser' );

require( __dirname + '/ext/workerSlicer.worker.js' );
	require ('billboard.js/dist/billboard.css');


if ( !self.require ) {
	console.warn( "adding 'require' global function" );
	self.require = function (module) {
		if (module === 'desk-client' ) return self.desk;
		if ( self[ module ] ) return self[ module ];
		throw new Error( 'module ' + module + ' not found!' ).stack;
	};
}



import work from 'webworkify-webpack'

require ('xterm/css/xterm.css');

self.bowser           = require( 'bowser' );

require( __dirname + '/ext/workerSlicer.worker.js' );

function getCookie (name) {
  var match = document.cookie.match(new RegExp(name + '=([^;]+)'));
  if (match) return unescape(match[1]);
}



	require ('billboard.js/dist/billboard.css');


self.createCTMWorker = function () {
	return work(require.resolve(__dirname + '/ext/CTMWorker.js'), { all : true } );
}


if ( !self.require ) {
	console.warn( "adding 'require' global function" );
	self.require = function (module) {
		if (module === 'desk-client' ) return self.desk;
		if ( self[ module ] ) return self[ module ];
		throw new Error( 'module ' + module + ' not found!' ).stack;
	};
}



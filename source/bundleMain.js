import work from 'webworkify-webpack'

require( __dirname + '/ext/WebGL.js');
require ('xterm/css/xterm.css');
self.chroma = require( 'chroma-js' );
self.bowser = require( 'bowser' );
require( __dirname + '/ext/workerSlicer.worker.js' );

function getCookie (name) {
  var match = document.cookie.match(new RegExp(name + '=([^;]+)'));
  if (match) return unescape(match[1]);
}

require('operative');
operative.setBaseURL(self.location.protocol + '//' 
	+ self.location.host 
	+ (getCookie("homeURL") || self.location.pathname)
	+ '/');

self.d3	= require ('d3');

self.c3 = self.bb = require ('billboard.js/dist/billboard.js').bb;
	require ('billboard.js/dist/billboard.css');


self.createCTMWorker = function () {
	return work(require.resolve(__dirname + '/ext/CTMWorker.js'), { all : true } );
}


if ( !self.require ) self.require = function (module) {
	if (module === 'desk-client' ) return self.desk;
	if ( self[ module ] ) return self[ module ];
	throw new Error( 'module ' + module + ' not found!' ).stack;
}



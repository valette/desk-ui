/**
 * Client dependencies injected via browserify
 */
EventEmitter = require('events');
async     = require('async');
Promise   = require('bluebird');
numeric   = require('numeric');
kdTree    = require('kdt');
_         = require('lodash');
            require('./ext/mhdParse.js');
Heap      = require('heap');
randomJS  = require('random-js');
prettyData= require('pretty-data').pd;

THREE     =	require('three');
			require('three/examples/js/controls/TransformControls.js');
			require('./ext/VTKLoader.js');
			require('./ext/TrackballControls2.js');
			require('./ext/CTMLoader.js');
			require('./ext/STLLoader.js');

jsSHA     = require("jssha");

if (typeof importScripts == 'function') {
	// we are in a worker
	return;
}

Terminal = require('xterm');
require ('../node_modules/xterm/src/xterm.css');

function getCookie (name) {
  match = document.cookie.match(new RegExp(name + '=([^;]+)'));
  if (match) return unescape(match[1]);
}

require('operative');
operative.setBaseURL(window.location.protocol + '//' 
	+ window.location.host 
	+ (getCookie("homeURL") || window.location.pathname)
	+ '/');

io        = require('socket.io-client');
d3		  = require ('d3');
c3        = require ('c3');
			require ('../node_modules/c3/c3.css');

var ace   = require('brace');
			require('brace/mode/c_cpp');
			require('brace/mode/html');
			require('brace/mode/javascript');
			require('brace/mode/json');
			require('brace/theme/eclipse');
			require('brace/ext/searchbox');
			require("brace/ext/language_tools");

Detector  = require('three/examples/js/Detector.js');

var work  = require('webworkify');

THREE.CTMLoader.prototype.createWorker = function () {
	return work(require('./ext/CTMWorker.js'));
}

THREE.VTKLoader.prototype.createWorker = function () {
	return work(require('./ext/VTKWorker.js'));
}

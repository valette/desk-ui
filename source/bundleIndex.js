/**
 * Client dependencies injected via browserify
 */

import work from 'webworkify-webpack'
import jsWorkerUrl from "url-loader!ace-builds/src-noconflict/worker-javascript.js";
import jsonWorkerUrl from "url-loader!ace-builds/src-noconflict/worker-json.js";
import htmlWorkerUrl from "url-loader!ace-builds/src-noconflict/worker-html.js";

self.async            = require('async');
self._ = self.lodash  = require('lodash');
self.EventEmitter     = require('events');
self.heap = self.Heap = require('heap');
self.jsSHA            = require("jssha");
self.kdTree           = require('kdt');
self.numeric          = require('numeric');
self.prettyData       = require('pretty-data').pd;
self.randomJS         = require('random-js');
self.THREE            =	require('three');
	require('three/examples/js/controls/TransformControls.js');
	require('./ext/VTKLoader.js');
	require('./ext/TrackballControls2.js');
	require('./ext/CTMLoader.js');

self.bluebird = self.Promise = require('bluebird');
self.chalk            = require('chalk');
self.jstat            = require('jstat');
self.ttest            = require('ttest');
require('./ext/mhdParse.js');

if (typeof importScripts !== 'function') {
	// we are not in a worker
	require('./ext/WebGL.js');
	self.Terminal = require( 'xterm' ).Terminal;

	require ('xterm/src/xterm.css');
 
	function getCookie (name) {
	  var match = document.cookie.match(new RegExp(name + '=([^;]+)'));
	  if (match) return unescape(match[1]);
	}

	require('operative');
	operative.setBaseURL(self.location.protocol + '//' 
		+ self.location.host 
		+ (getCookie("homeURL") || self.location.pathname)
		+ '/');

	self.io = require('socket.io-client');
	self.d3	= require ('d3');
	self.c3 = require ('c3');
		require ('c3/c3.css');

	self.ace = require('ace-builds/src-noconflict/ace');
	self.ace.config.setModuleUrl( "ace/mode/javascript_worker", jsWorkerUrl );
	self.ace.config.setModuleUrl( "ace/mode/json_worker", jsonWorkerUrl );
	self.ace.config.setModuleUrl( "ace/mode/html_worker", htmlWorkerUrl );

		require('ace-builds/src-noconflict/mode-c_cpp');
		require('ace-builds/src-noconflict/mode-html');
		require('ace-builds/src-noconflict/mode-javascript');
		require('ace-builds/src-noconflict/mode-json');
		require('ace-builds/src-noconflict/theme-eclipse');
		require('ace-builds/src-noconflict/ext-searchbox');
		require("ace-builds/src-noconflict/ext-language_tools");

	THREE.CTMLoader.prototype.createWorker = function () {
		return work(require.resolve('./ext/CTMWorker.js'), { all : true } );
	}

	THREE.VTKLoader.prototype.createWorker = function () {
		return work(require.resolve('./ext/VTKWorker.js'), { all : true } );
	}

	self.require = function (module) {
		if (module === 'desk-client' ) return self.desk;
		if ( self[ module ] ) return self[ module ];
		throw new Error( 'module ' + module + ' not found!' ).stack;
	}
}


import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

self.async            = require('async');
self._ = self.lodash  = require('lodash');
self.EventEmitter     = require('events');
self.heap = self.Heap = require('heap');
self.jsSHA            = require("jssha").default;
self.kdTree           = require('kdt');
self.numeric          = require('numeric');
self.randomJS         = require('random-js');
self.THREE            =	require('three');
	require('./ext/CTMLoader.js');
	require('./ext/VTKLoader.js');
	require('./ext/TrackballControls2.js');

self.THREE.STLLoader = STLLoader;
self.THREE.TransformControls = TransformControls;

self.bluebird = self.Promise = require('bluebird');
self.chalk            = require('chalk');
self.jstat            = require('jstat');
require('./ext/mhdParse.js');

if (typeof importScripts !== 'function') {

	// we are not in a worker
	require( './bundleMain.js');

}


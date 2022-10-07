import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';
import chalk from 'chalk';

self.THREE  = THREE;
self.THREE.STLLoader = STLLoader;
self.THREE.TransformControls = TransformControls;
self.THREE.DragControls = DragControls;
self.chalk = chalk;

self.async            = require('async');
self._ = self.lodash  = require('lodash');
self.EventEmitter     = require('events');
self.heap = self.Heap = require('heap');
self.jsSHA            = require("jssha");
self.kdTree           = require('kdt');
self.numeric          = require('numeric');
self.randomJS         = require('random-js');
	require('./ext/CTMLoader.js');
	require('./ext/VTKLoader.js');
	require('./ext/TrackballControls2.js');

self.bluebird = self.Promise = require('bluebird');
self.jstat            = require('jstat');
require('./ext/mhdParse.js');

if (typeof importScripts !== 'function') {

	// we are not in a worker
	require( './bundleMain.js');

}


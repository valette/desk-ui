//import * as THREE from 'three';
import chalk from 'chalk';

self.chalk = chalk;

self.async            = require('async');
self._ = self.lodash  = require('lodash');
self.EventEmitter     = require('events');
self.heap = self.Heap = require('heap');
self.jsSHA            = require("jssha");
self.kdTree           = require('kdt');
self.numeric          = require('numeric');
self.randomJS         = require('random-js');

self.bluebird = self.Promise = require('bluebird');
self.jstat            = require('jstat');
require('./ext/mhdParse.js');

if (typeof importScripts !== 'function') {

	// we are not in a worker
	require( './bundleMain.js');

}


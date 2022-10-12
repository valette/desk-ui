
/**
 * Singleton class which adds external libraries
 * @ignore (require)
 */
qx.Class.define( "desk.AddLibs", 
{
	extend : qx.core.Object,

	type : "singleton",

	/**
	* Constructor
	*/
	construct : function() {

		this.base(arguments);
		const manager = qx.util.ResourceManager.getInstance();
		qx.bom.Stylesheet.includeFile( manager.toUri( "desk/css/xterm.css") );
		qx.bom.Stylesheet.includeFile( manager.toUri( "desk/css/billboard.css") );
		window.async = require('async');
		window.THREE = require( "three" );
		require( "three/examples/js/loaders/STLLoader.js" );
		require( "three/examples/js/controls/TransformControls.js" );
		require( "three/examples/js/controls/DragControls.js" );
		require( "three/../../source/ext/CTMLoader.js" );
		require( "three/../../source/ext/VTKLoader.js" );
		require( "three/../../source/ext/TrackballControls2.js" );
		require( "three/../../source/ext/mhdParse.js" );
		require( "three/../../source/ext/WebGL.js" );

		require('operative');
		operative.setBaseURL(self.location.protocol + '//' 
			+ window.location.host 
			//+ (getCookie("homeURL") || self.location.pathname)
			+ '/');

		window.async            = require('async');
		window._ = self.lodash  = require('lodash');
		window.EventEmitter     = require('events');
		window.heap = self.Heap = require('heap');
		window.jsSHA            = require("jssha");
		window.kdTree           = require('kdt');
		window.numeric          = require('numeric');
		window.randomJS         = require('random-js');
		window.jstat            = require('jstat');
		window.chroma           = require( 'chroma-js' );
		window.d3	            = require ('d3');
		window.c3 = window.bb = require ('billboard.js/dist/billboard.js').bb;
		window.chalk	        = require ('chalk');

	}
});

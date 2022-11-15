/**
 * Singleton class which adds external libraries
 * @asset(desk/css/xterm.css)
 * @asset(desk/css/billboard.css)
 */

qx.Class.define( "desk.core.AddLibs",
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
		window.THREE = require( "three" );
		require( "three/examples/js/loaders/STLLoader.js" );
		require( "three/examples/js/controls/TransformControls.js" );
		require( "three/examples/js/controls/DragControls.js" );
		require( "three/examples/js/utils/BufferGeometryUtils.js" );

		if ( qx.core.Environment.get( "qx.application") == "desk.Application" ) {

			require( "three/../../source/ext/CTMLoader.js" );
			require( "three/../../source/ext/VTKLoader.js" );
			require( "three/../../source/ext/TrackballControls2.js" );
			require( "three/../../source/ext/mhdParse.js" );
			require( "three/../../source/ext/WebGL.js" );
			window.MHD = require( "three/../../source/ext/mhdParse.js" );


		} else {

			require( "desk-ui/source/ext/CTMLoader.js" );
			require( "desk-ui/source/ext/VTKLoader.js" );
			require( "desk-ui/source/ext/TrackballControls2.js" );
			require( "desk-ui/source/ext/mhdParse.js" );
			require( "desk-ui/source/ext/WebGL.js" );
			window.MHD = require( "desk-ui/source/ext/mhdParse.js" );

		}

		window._ = require ('lodash');
		window.async = require( "async" );

		function operativeShim( operative ) {

			operative.setBaseURL(self.location.protocol + '//'
				+ self.location.host
				+ ( desk.FileSystem.getBaseURL() || self.location.pathname )
				+ '/');

		}

		const libs = [

			"chalk", { events : "EventEmitter" },
			"heap", { heap : "Heap" }, { kdt : "kdTree" },
			"numeric", { "random-js" : "randomJS" }, "jstat", { "chroma-js" : "chroma" },
			"d3", { "billboard.js" : "c3", subField : "bb" },
			{ "billboard.js" : "bb", subField : "bb" },
			{ "operative" : "operative", shim : operativeShim }

		];

		const fieldsToIgnore = [ "subField", "shim" ];

		libs.forEach( lib => {

			let target;

			if ( typeof lib == 'string') {
				const temp = lib;
				lib = {};
				lib[ temp ] = temp;
			}

			const obj = lib;

			for ( let field of Object.keys( lib ) ) {

				if ( !fieldsToIgnore.includes( field ) ) {
					lib = field;
					target = obj[ field ];
				}

			}

			let library;

			Object.defineProperty( window, target, {

				get() {
					if ( library ) return library;
					const required = require( lib );
					if ( !library ) library = required;
					if ( obj.subField ) library =  library[ obj.subField ];
					if ( obj.shim ) obj.shim( library );
					return library;

				},

				set( value ) {
					library = value;
					if ( qx.core.Environment.get("qx.debug") )
						console.warn( "setting global value for lib "  + lib );
				}

			} );

		} );

	},

	members : {
		__requireAll : function () {

			require( "operative" );
			require( "chalk" );
			require( "events" );
			require( "heap" );
			require( "kdt" );
			require( "numeric" );
			require( "random-js" );
			require( "jstat" );
			require( "chroma-js" );
			require( "d3" );
			require( "billboard.js" )

		}
	}
});

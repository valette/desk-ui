/**
 * Singleton class which adds promisified versions of different asynchronous desk functions, and adds back deprecated classes
 * @ignore (require)
 * @ignore (async.*)
 */
qx.Class.define( "desk.core.AddPromises", 
{
	extend : qx.core.Object,

	type : "singleton",

	/**
	* Constructor
	*/
	construct : function() {

		this.base(arguments);

		var toPromisify = [
			"desk.Actions.execute",
			"desk.Actions.killAction",
			"desk.FileSystem.executeScript",
			"desk.FileSystem.exists",
			"desk.FileSystem.includeScripts",
			"desk.FileSystem.mkdirp",
			"desk.FileSystem.readDir",
			"desk.FileSystem.readFile",
			"desk.FileSystem.readURL",
			"desk.FileSystem.traverse",
			"desk.FileSystem.writeFile",
			"desk.FileSystem.writeCachedFile",
			"desk.FileSystem.writeJSON"
		];

		var membersToPromisify = [
			"desk.Action.execute",
			"desk.MPR.Container.addVolume",
			"desk.MPR.SliceView.addSlice",
			"desk.THREE.Container.addFile",
			"desk.THREE.Container.addVolume",
			"desk.THREE.Container.loadURL",
			"desk.THREE.Scene.render"
		];

		this.promisify( toPromisify );
		this.promisify( membersToPromisify, { members : true } );

		desk.THREE.Container.prototype.snapshotAsync = require('util').promisify ( function ( opts, callback ) {
			this.snapshot( Object.assign( {}, opts, { callback : callback } ) );
		} );

		async.mapLimitAsync = function ( arr, limit, iterator ) {
			console.warn( "async.mapLimitAsync is deprecated, use async.mapLimit" );
			console.warn( new Error().stack );

			return new Promise ( function ( resolve, reject ) {
				async.mapLimit( arr, limit, async.asyncify( iterator ), function ( err, res ) {
					if ( err ) {
						reject ( err );
					} else {
						resolve( res );
					}
				});
			});
		};

		async.eachLimitAsync = function ( arr, limit, iterator ) {
			console.warn( "async.eachLimitAsync is deprecated, use async.eachLimit" );
			console.warn( new Error().stack );

			return new Promise ( function ( resolve, reject ) {
				async.eachLimit( arr, limit, async.asyncify( iterator ), function ( err ) {
					if ( err ) {
						reject ( err );
					} else {
						resolve();
					}
				});
			});
		};

		const classesToDeprecate = {

			"desk.Slicer" : "desk.MPR.Slicer",
			"desk.VolumeSlice" : "desk.MPR.Slice",
			"desk.VolumeViewer" : "desk.MPR.Viewer",
			"desk.MPRContainer" : "desk.MPR.Container",
			"desk.ThreeContainer" : "desk.THREE.Scene",
			"desk.SceneContainer" : "desk.THREE.Container",
			"desk.MeshViewer" : "desk.THREE.Viewer",
			"desk.AceContainer" : "desk.Ace.Container",
			"desk.TextEditor" : "desk.Ace.Editor",
			"desk.TabTextEditor" : "desk.Ace.TabbedEditor",
			"desk.FileTail" : "desk.Xterm.FileTail",
			"desk.LogContainer" : "desk.Xterm.Logger",
			"desk.Terminal" : "desk.Xterm.Terminal",
			"desk.FileTail" : "desk.Xterm.FileTail"

		};

		if ( window.testfff ) {
			new desk.Ace.Container();
			new desk.Ace.Editor();
			new desk.Ace.TabbedEditor();
			new desk.Xterm.Logger();
			new desk.Xterm.Terminal();
			new desk.Xterm.FileTail();

		}

		Object.entries( classesToDeprecate ).forEach( entry => {

			const [ deprecated, replacement ] = entry;
			source = deprecated.split( "." )[ 1 ];

			Object.defineProperty( window.desk, source, { get() {

				target = window;
				for ( let field of replacement.split( "." ) )
					target = target[ field ];

				console.warn( deprecated + " is deprecated, use "
					+  replacement + " instead" );
				return target;
			} } );

		} );

		const MPRmembersToDeprecate = {

			"desk.MPR.Container.setVolumeOpacity" : "desk.MPR.Volume.setVolumeOpacity",
			"desk.MPR.Container.getVolumeOpacity" : "desk.MPR.Volume.getVolumeOpacity",
			"desk.MPR.Container.setVolumeLUT" : "desk.MPR.Volume.setLUT",
			"desk.MPR.Container.getVolumeLUT" : "desk.MPR.Volume.getLUT",
			"desk.MPR.Container.setContrast" : "desk.MPR.Volume.setContrast",
			"desk.MPR.Container.getContrast" : "desk.MPR.Volume.getContrast",
			"desk.MPR.Container.setBrightness" : "desk.MPR.Volume.setBrightness",
			"desk.MPR.Container.getBrightness" : "desk.MPR.Volume.getBrightness",
			"desk.MPR.Container.getVolumeMeshes" : "desk.MPR.Volume.getMeshes",
			"desk.MPR.Container.getVolumeSlices" : "desk.MPR.Volume.getSlices",
			"desk.MPR.Container.getVolumeFile" : "desk.MPR.Volume.getFile",
			"desk.MPR.Container.updateVolume" : "desk.MPR.Volume.update"

		};

		for ( let [ deprecated, replacement ] of Object.entries( MPRmembersToDeprecate ) ) {

			const arr = deprecated.split( "." );
			const member = arr.pop();
			const source = arr.join( "." );
			const arr2 = replacement.split( "." );
			const target = arr2.pop();

			eval( `${source}.prototype.${member} = function( item, ...args ) {
				console.warn( "${deprecated}( item, ...args ) is deprecated. Use item.${target}( ...args ) instead" );
				return item.${target}( ...args );
			};`);

		}

		[ "VertexColors", "NoColors", "FaceColors" ].forEach( field => {
			Object.defineProperty( THREE, field, { get() {
				console.warn( "THREE." + field + " is deprecated, use 'true' instead" );
				return true;
			} }) } );

	},
	members : {

		/**************************************************************
		 * adds promise-based API
		 * @param functions {Array} array of functions to promisify
		 * @param opts {Object} options
		 **************************************************************/
		promisify : function ( functions, opts ) {
			opts = opts || {};
			functions.forEach( function ( func ) {
				var prefixes = func.split('.');
				var name = prefixes.pop();
				var root = prefixes.reduce( function ( previous, current ) {
					return previous[ current ]
				}, window);

				if (!root) {
					console.log("error with " + func);
				}

				if ( opts.members ) {
					root = root.prototype;
				}

				var origin = root[ name ];
				if ( !origin ) {
					console.log( "root : " + root, "name : " + name);
					throw( 'bad function name : ' + func);
				}

				root[ name + "Async" ] = require('util').promisify( origin );
			} );

		}
	}
});

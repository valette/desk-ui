/**
 * Singleton class which adds promisified versions of different asynchronous desk functions
 * @ignore (require)
 * @ignore (async.*)
 * @ignore (bluebird.promisify)
 */
qx.Class.define( "desk.AddPromises", 
{
	extend : qx.core.Object,

	type : "singleton",

	/**
	* Constructor
	*/
	construct : function() {

		this.base(arguments);
		Promise.promisify = bluebird.promisify;

		var toPromisify = [
			"desk.Actions.execute",
			"desk.Actions.init",
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
			"desk.MPRContainer.addVolume",
			"desk.SceneContainer.addFile",
			"desk.SceneContainer.addVolume",
			"desk.SceneContainer.loadURL",
			"desk.SliceView.addVolume",
			"desk.MPRContainer.addVolume",
			"desk.ThreeContainer.render"
		];

		this.promisify( toPromisify );
		this.promisify( membersToPromisify, { members : true } );

		desk.SceneContainer.prototype.snapshotAsync = Promise.promisify ( function ( opts, callback ) {
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

				root[ name + "Async" ] = Promise.promisify( origin );
			} );

		}
	}
});

/* ************************************************************************

   Copyright: CNRS, INSERM, INSA-Lyon

   License: CeCILL B

   Authors: Sebastien Valette

************************************************************************ */

/**
 * @asset(desk/*)
 * @ignore (async)
 * @ignore (async*)
 * @ignore (desk_startup_script)
 * @ignore (desk.auto)
 * @ignore (Promise)
 * @ignore (require)
 * @ignore (Promise.*)
 */

qx.Class.define("desk.ui.Application",
{
	extend : qx.application.Standalone,

	members :
	{
		/**************************************************************
		 * hack to include qx.ui.list.List in the build
		 **************************************************************/

		hackToIncludeClasses : function () {
			new qx.ui.list.List();
			new desk.IfeContainer();
		},

		main : function() {
			console.log("init?");

			// Call super class
			this.base(arguments);


			// Enable logging in debug variant
			if (qx.core.Environment.get("qx.debug")) {
				// support native logging capabilities, e.g. Firebug for Firefox
				qx.log.appender.Native;
				// support additional cross-browser console. Press F7 to toggle visibility
				qx.log.appender.Console;
			}

			function getParameter( parameterName ) {
				parameterName = parameterName.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
				var regex = new RegExp( "[\\?&]" + parameterName + "=([^&#]*)" );
				var results = regex.exec( window.location.href );
				if (results == null) {
					return null;
				} else {
					return results[1];
				}
			}

			this.__promisifyAll();

			var actions = desk.Actions.getInstance()
//			desk.Actions.init(afterActionsInitialized);
			var savedDesk = window.desk;
afterActionsInitialized();
			function afterActionsInitialized () {
				if ( !window.desk.FileSystem ) window.desk = savedDesk; // #BUG this happens whith webpack
				actions.debug("actions initialized!");
				desk.auto = false;
				// first try to automatically launch startup script if it exists
				if (getParameter("noauto")) {
					next();
					return;
				}

				if (typeof desk_startup_script === "string") {
					desk.auto = true;
					desk.FileSystem.executeScript(desk_startup_script);
					return;
				}

				var initScript = 'code/init.js';
				desk.FileSystem.exists(initScript, function (err, exists) {
					if (exists) {
						desk.auto = true;
						desk.FileSystem.executeScript(initScript);
					} else {
						next();
					}
				});
			}

			function next() {
				var startupScript = getParameter("script");
				if (startupScript) {
					desk.auto = true;
					desk.FileSystem.executeScript(startupScript);
					return;
				}
				//actions.buildUI();
				//new desk.FileBrowser(getParameter("rootDir"), {standalone : true});
			}
		},

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
		},

		/**************************************************************
		 * adds promise-based API : for each function taking a callback as
		 * argument, create a function returning a promise
		 **************************************************************/
		__promisifyAll : function () {

			Promise.promisify = require('bluebird').promisify;

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
		}
	}
});

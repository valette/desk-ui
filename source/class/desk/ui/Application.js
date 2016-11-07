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
 * @ignore (Promise.*)
 */

qx.Class.define("desk.ui.Application",
{
	extend : qx.application.Standalone,

	members :
	{
		hackToIncludeClasses : function () {
			new qx.ui.list.List();
		},

		main : function() {
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
			desk.Actions.init(afterActionsInitialized);

			function afterActionsInitialized () {
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
				actions.buildUI();
				new desk.FileBrowser(getParameter("rootDir"), {standalone : true});
			}
		},

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

				if ( opts.tweakCallback ) {
					origin = function ( file, opts, callback ) {
						if ( typeof opts === 'function' ) {
							callback = opts;
							opts ={};
						}
						this[name]( file, opts, function ( res ) {
							callback ( null, res );
						} );
					};
				}

				root[ name + "Async" ] = Promise.promisify( origin );
			} );
		},

		__promisifyAll : function () {

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
				"desk.SceneContainer.addVolume",
				"desk.SceneContainer.loadURL",
				"desk.SliceView.addVolume",
				"desk.MPRContainer.addVolume"
			];

			var membersToPromisify2 = [
				"desk.SceneContainer.addFile",
			];

			this.promisify( toPromisify );
			this.promisify( membersToPromisify, { members : true } );
			this.promisify( membersToPromisify2, { members : true, tweakCallback : true } );


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

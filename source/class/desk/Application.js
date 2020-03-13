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

qx.Class.define("desk.Application",
{
	extend : qx.application.Standalone,

	members :
	{
		/**************************************************************
		 * hack to include qx.ui.list.List in the build
		 **************************************************************/

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

			var actions = desk.Actions.getInstance()
			desk.Actions.init(afterActionsInitialized);
			var savedDesk = window.desk;

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
				actions.buildUI();
				new desk.FileBrowser(getParameter("rootDir"), {standalone : true});
			}
		}

	}
});

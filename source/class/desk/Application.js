/* ************************************************************************

   Copyright: CNRS, INSERM, INSA-Lyon

   License: CeCILL B

   Authors: Sebastien Valette

************************************************************************ */

/**
 * @asset(desk/*)
 * @ignore (desk_startup_script)
 * @ignore (desk.auto)
 */

qx.Class.define("desk.Application",
{
	extend : qx.application.Standalone,

	members :
	{

		main : async function() {

			// Call super class
			this.base( arguments );

			// Enable logging in debug variant
			if (qx.core.Environment.get("qx.debug")) {
				// support native logging capabilities, e.g. Firebug for Firefox
				qx.log.appender.Native;
				// support additional cross-browser console. Press F7 to toggle visibility
				qx.log.appender.Console;
			}

			const actions = desk.Actions.getInstance()
			await desk.Actions.initAsync();
			actions.debug("actions initialized!");
			desk.auto = false;
			document.getElementById("loading").className = "loading-invisible";

			// first try to automatically launch startup script if it exists
			if ( !desk.URLParameters.getParameter( "noauto" ) ) {

				if ( typeof desk_startup_script === "string" ) {

					desk.auto = true;
					desk.FileSystem.executeScript( desk_startup_script );
					return;

				}

				const initScript = 'code/init.js';

				if ( await desk.FileSystem.existsAsync( initScript ) ) {

					desk.auto = true;
					desk.FileSystem.executeScript(initScript);
					return;

				}

			}

			const startupScript = desk.URLParameters.getParameter( "script" );

			if ( startupScript ) {

				desk.auto = true;
				desk.FileSystem.executeScript(startupScript);
				return;

			}

			new desk.FileBrowser( desk.URLParameters.getParameter( "rootDir" ), { standalone : true } );

		}

	}

});

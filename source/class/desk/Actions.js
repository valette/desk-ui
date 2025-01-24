/**
 * Singleton class which stores all available actions, handles launching
 * and display actions in progress
 * @asset(desk/desk.png)
 * @asset(qx/icon/${qx.icontheme}/16/categories/system.png) 
 * @asset(qx/icon/${qx.icontheme}/16/actions/dialog-close.png)
 * @ignore (require)
 * @ignore (_.*)
 * @ignore (confirm)
 * @ignore (prompt)
 * @ignore (desk_startup_script)
 * @lint ignoreDeprecated (alert)
 * @require(desk.Random)
 */
qx.Class.define("desk.Actions", 
{
	extend : qx.core.Object,

	type : "singleton",

	/**
	* Constructor, never to be used. Use desk.Actions.getInstance() instead
	*/
	construct : function() {

		this.base(arguments);
		desk.core.AddLibs.getInstance();
		desk.core.AddPromises.getInstance();
		desk.FileSystem.getInstance();
		desk.URLParameters.getInstance();

		if ( typeof desk_startup_script !== "string" ) {
			if ( qx.bom.Cookie.get("homeURL" ) ) {
				// support for node.js
				this.__initNode();
			} else try {
				// support for electron.js / nw.js
				this.__initElectronNW();
			} catch (e) {
				console.log(e);
			}
		}

		if (!this.__engine) {

			desk.FileSystem.readFile( this.__savedActionFile,

				( err, result ) => {

					if (err) {

						console.warn("Error while reading actions cache");
						console.warn( err );

					}

					try {

						result = JSON.parse(result);
						this.__recordedActions = result.actions;
						this.__loadSettings();

					} catch ( e ) {

						console.log("Error while reading actions cache");
						this.fireEvent('changeReady');

					}

			} );

		} else {

			this.__socket.on("actions updated", this.__setSettings.bind(this));

		}

		this.__createOngoingActionsWindow();
		this.__createHistoryWindow();
		this.__createErrorContainer();

	},

	statics : {
		__serverRandomValue : null,

		/**
		* Calls callback when the actions list is constructed
		* @internal
		* @param callback {Function} : callback to be called when ready
		* @param context {Object} : optional context for the callback
		*/
		init : function (callback, context) {
			const actions = desk.Actions.getInstance();
			if (actions.__settings && !actions.__settings.not_initialised ) {
				callback.apply(context);
			} else {
				actions.addListenerOnce("changeReady", () => callback.call( context ) );
			}
		},

		/**
		* Returns when the actions list is constructed
		* @internal
		*/
		initAsync : async function() {

			await new Promise( res => this.init( res ) );

		},

		/**
		* executes an action
		* @param params {Object} object containing action parameters
		* @param options {Object} options for the action (force_update, logHandler)
		* @param callback {Function} callback for when the action has been performed
		* @param context {Object} optional context for the callback
		* @return {String} action handle for managemenent (kill etc...)
		*/
		execute : function (params, options, callback, context) {
			if (typeof options === "function") {
				context = callback;
				callback = options;
				options = {};
			}
			options = options || {};
			params = JSON.parse(JSON.stringify(params));
			params.handle = Math.random().toString();
			var actions = desk.Actions.getInstance();
			if (actions.isForceUpdate()) params.force_update = true;

			var parameters = {
				callback : callback || function () {},
				context : context,
				options : options,
				POST : params
			};

			if (options.listener) {
				params.stream = true;
				parameters.listener = function (message) {
					if (params.handle === message.handle) {
						try {
							options.listener(message);
						} catch ( e ) { console.warn( e ); }
					}
				};
				if ( actions.__socket )
					actions.__socket.on("actionEvent", parameters.listener);
			}

			actions.__runingActions[params.handle] = parameters;

			if (actions.__recordedActions && !actions.__engine) {
				var response = actions.__recordedActions[actions.__getActionSHA(params)];
				if (response) {
					const res = { ...response, handle : params.handle };
					setTimeout(function () {
						actions.__onActionEnd(res);
					}, 1);
				} else {
					console.warn("Error : action not found");
					console.log(params);
				}
			} else {
				actions.__execute(params);
			}

			return params.handle;
		},

		/**
		* returns the setting button located on the upper right corner
		* @return {qx.ui.form.MenuButton} settings button
		*/
		getSettingsButton : function () {
			return desk.Actions.getInstance().__settingsButton;
		},

		/**
		* kills an action
		* @param handle {String} action handle to kill
		* @param callback {Function} callback when the action has been killed
		* @param context {Object} optional context for the callback
		*/
		killAction : function ( handle, callback, context ) {
			desk.Actions.getInstance().killAction( handle, callback, context );
		},

		/**
		* Returns the JSON object defining a specific action
		* @param name {String} the action name
		* @return {Object} action parameters as a JSON object
		*/
		getAction : function (name) {
			return desk.Actions.getInstance().getAction(name);
		},

		/**
		* Returns the engine on top of which desk-ui is running.
		* Possible values are : node, electron, nw
		* @return {String} engine
		*/
		getEngine : function () {
			return desk.Actions.getInstance().__engine;
		},

		statifyCode : "ui/compiled/dist"

	},

	properties : {
		/**
		* Defines whether RPC cache is avoided (default : false);
		*/	
		forceUpdate : { init : false, check: "Boolean", event : "changeForceUpdate"}
	},

	events : {
		/**
		* Fired when the actions list is ready
		*/	
		"changeReady" : "qx.event.type.Event",

		/**
		* Fired when the actions list is updated
		*/
		"update" : "qx.event.type.Event"
	},

	members : {
		__socket : null,
		__runingActions : {},
		__settings : { not_initialised : true, actions : [] },
		__ongoingActions : null,
		__actionsGarbageContainer : null,
		__ongoingActionsWindow : null,
		__history : null,
		__historyWindow : null,
		__finishedActions : [],
		__errorContainer : null,
		__disconnectContainer : null,
		__recordedActions : null,
		__toStatify : null,
		__savedActionFile : 'cache/responses.json',
		__firstReadFile : null,
		__settingsButton : null,
		__engine : false,

		/**
		* sets emit log on/off
		* @param value {Boolean} value
		*/
		__setEmitLog : function (value) {
			this.__socket.emit('setEmitLog', value);
		},

		/**
		* executes an action
		* @param params {Object} action to execute
		*/
		__execute : function ( params ) {
			this.__socket.emit('action', params);
		},

		/**
		* returns the web socket
		* @return {Object} the socket
		*/
		getSocket : function () {
			return this.__socket;
		},

		__createOngoingActionsWindow : function () {

			const win = this.__ongoingActionsWindow = new qx.ui.window.Window();

			win.set( {
				layout :  new qx.ui.layout.VBox(),
				showMinimize : false,
				alwaysOnTop : true,
				caption : "Running actions",
				width : 500,
				height : 500,
				zIndex : 1000000
			} );

			this.__ongoingActions = new qx.ui.form.List();
			this.__actionsGarbageContainer = new qx.ui.form.List();

			const getAction = () => {

				const selection = this.__ongoingActions.getSelection();
				if ( !selection || !selection.length ) {
					window.alert( "No action was selected. Please select one" );
					return;
				}

				return selection[ 0 ];

			};

			const kill = new qx.ui.menu.Button('Kill/remove');
			kill.addListener('execute', () => {
				const item = getAction();
				if  (!item ) return;
				this.killAction(item.getUserData("params").POST.handle );
			} );

			const killAll = new qx.ui.menu.Button('Kill/remove all').set({
				blockToolTip : false, toolTipText : "To kill all runing actions on server"});

			killAll.addListener( 'execute', () => {

				if (!confirm('Do you want to kill all actions?')) {
					return;
				}

				for ( let handle of Object.keys(this.__runingActions) ) {
					this.killAction( handle );
					const children = this.__ongoingActions.getChildren();
					for ( let item of children )
						this.killAction( item.getUserData("params").POST.handle );

				}

			} );

			const properties = new qx.ui.menu.Button('Properties');
			properties.addListener('execute', () => {
				const item = getAction();
				if  (!item ) return;
				console.log( item.getUserData("params") );
			} );

			const tail = new qx.ui.menu.Button('Console output');
			tail.addListener('execute', async () => {

				const item = getAction();
				if  (!item ) return;
				const handle = item.getUserData("params").POST.handle;
				const res = await desk.Actions.executeAsync( { manage : 'list'} );

				for ( let handle2 of Object.keys( res.ongoingActions ) ) {
					if ( handle !== handle2 ) continue;
					new desk.Xterm.FileTail( res.ongoingActions[handle].outputDirectory + "action.log" );
				}

			} );

			const menu = new qx.ui.menu.Menu();
			menu.add(kill);
			menu.add(killAll);
			menu.add(properties);
			menu.add(tail);
			this.__ongoingActions.setContextMenu(menu);

			const action = new qx.ui.form.TextArea( "" );
			const pane = new qx.ui.splitpane.Pane( "vertical" );
			pane.add( this.__ongoingActions, 2 );
			pane.add( action, 1 );
			win.add( pane, { flex : 1 } );

			this.__ongoingActions.addListener( "changeSelection", ( e ) => {

				if ( !e.getData().length ) {

					action.setValue( "" );
					return;

				}

				const params = e.getData()[ 0 ].getUserData("params");
				console.log( params );
				const params2 = { ...params };
				delete params2[ "item" ];
				action.setValue( JSON.stringify( params2, null, 2 ) );

			} );
		},

		__addFinishedAction : function( params ) {

			this.__historyItems.push( { name : params.POST.action,

				id : this.__historyItems.length,
				color : params.error? "red" : "black"

			} );

			this.__finishedActions.push( params );
			if ( this.__historyWindowIsOpen ) this.__updateFinishedActions();

		},

		__historyItems : [],
		__updateFinishedActions : null,
		__historyWindowIsOpen : false,

		__createHistoryWindow : function () {

			const win = this.__historyWindow = new qx.ui.window.Window();
			const model = qx.data.marshal.Json.createModel( [] );
			const list = this.__history = new qx.ui.list.List( model );
			list.setLabelPath( "name");
			let throttle = 1000;

			let update = () => {

				const start = performance.now();
				const model = qx.data.marshal.Json.createModel( this.__historyItems );
				list.setModel( model );
				const duration = performance.now() - start;
				if ( ( duration * 10 ) > throttle ) {

					throttle *= 2;
					console.warn( "Throttling history update to " + throttle + "ms." );
					this.__updateFinishedActions = _.throttle( update, throttle );

				}

			};

			this.__updateFinishedActions = _.throttle( update, throttle );

			list.addListener( "appear", () => {

				this.__updateFinishedActions()
				this.__historyWindowIsOpen = true;

			} );

			list.setDelegate( {

				bindItem( controller, item, id ) {

					controller.bindDefaultProperties(item, id);
					controller.bindProperty( "color", "textColor", {}, item, id );

				}

			} );

			win.addListener( "close", () => {

				this.__historyWindowIsOpen = false

			} );

			win.set( {

				layout :  new qx.ui.layout.VBox(),
				alwaysOnTop : true,
				showMinimize : false,
				caption : "Actions history",
				width : 500,
				height : 500,
				zIndex : 1000000

			} );

			const action = new qx.ui.form.TextArea( "" );
			action.set( { readOnly : true } );
			const pane = new qx.ui.splitpane.Pane( "vertical" );
			pane.add( this.__history, 2 );
			pane.add( action, 1 );
			win.add( pane, { flex : 1 } );

			list.getSelection().addListener( "change", () => {

				if ( !list.getSelection().getLength() ) {
					action.setValue( "" );
					return;
				}

				const item = list.getSelection().getItem( 0 );
				const params = this.__finishedActions[ item.getId() ];
				console.log( params );
				action.setValue( JSON.stringify( params, null, 2 ) );

			} );

			const open = new qx.ui.menu.Button('Browse output directory');
			open.addListener('execute', async () => {

				if ( !list.getSelection().getLength() ) {
					window.alert( "No action was selected. Please select one" );
					return;
				}

				const item = list.getSelection().getItem(0);
				const params = this.__finishedActions[ item.getId() ];
				const dir = params.response.outputDirectory;

				if ( !dir ) {

					window.alert( "there is no output directory for this action" );
					return;

				}

				const browser = new desk.FileBrowser( dir, { standalone : true } );
				browser.getWindow().center();

			} );

			const menu = new qx.ui.menu.Menu();
			menu.add(open);
			this.__history.setContextMenu(menu);

		},

		__initNode : function () {

			this.__createDisconnectContainer();
			this.__socket = require('socket.io-client')({path : desk.FileSystem.getBaseURL() + 'socket.io'});
			this.__engine = "node";
			this.__socket.on("action started", POST => {

				const params = this.__runingActions[POST.handle] =
					this.__runingActions[POST.handle] || { POST : POST };
				this.__addActionToList( params );

			} );

			this.__socket.on("action finished", this.__onActionEnd.bind(this));
			this.__socket.on("disconnect", this.__onDisconnect.bind( this ) );
			console.log("powered by node.js");
			this.__socket.once( "connect", async () => {

				// add already running actions
				const res = await desk.Actions.executeAsync( { manage : 'list'} );
				const actions = res.ongoingActions;
				for ( let handle of Object.keys(actions) ) {
					this.__addActionToList( actions[ handle ] );
					this.__runingActions[ handle ] = actions[ handle ];
				}

			} );

		},

		__initElectronNW : function () {

			this.__socket = require('desk-base');
			this.__setEmitLog = this.__socket.setEmitLog;
			this.__socket.setLogToConsole(false);
			this.__engine = "electron/nw";
			this.__execute = function (params) {
				this.__socket.execute(params, this.__onActionEnd.bind(this));
			};
			this.__loadSettings = function () {
				setTimeout(function() {
					this.__setSettings(this.__socket.getSettings());
				}.bind(this), 10);
			};
			if (typeof window.nw === 'undefined') {
				this.__engine = "electron";
				console.log("powered by electron.js");
				const el = "electron";
				var ipcRenderer = require(el).ipcRenderer;
				window.prompt = function(title, val) {
					return ipcRenderer.sendSync('prompt', {title : title, val : val});
				};
			} else {
				console.log("powered by nw.js");
				this.__engine = "nw";
			}
			this.__loadSettings();
		},

		__onDisconnect : async function() {

			this.__disconnectContainer.setVisibility( "visible" );
			console.warn( 'disconnected from server' );
			await new Promise( res => this.__socket.once( 'connect', res ) );
			console.warn( 'connected' );
			this.__disconnectContainer.setVisibility( "excluded" );
			const res = await desk.Actions.executeAsync( { manage : 'list'} );
			const actions = res.ongoingActions;

			for ( let item of this.__ongoingActions.getChildren().slice() ) {

				const params = item.getUserData( 'params' );
				const action = actions[ params.POST.handle ];

				if ( !action ) {

					params.callback = function () {};
					this.__onActionEnd( { handle : params.POST.handle } );

				}

			}

		},

		/**
		* Creates the action menu
		*/
		__createActionsMenu : function () {

			const menu = new qx.ui.menu.Menu();

			// add server load item
			var loadWidget = new qx.ui.menu.Button("CPU Load");
			menu.add(loadWidget);
			loadWidget.set({blockToolTip : false,
				toolTipText : "server CPU Load",
				appearance : "label"
			});

			menu.addSeparator();
			var filesMenu = new qx.ui.menu.Menu();
			var filesButton = new qx.ui.menu.Button("Files", null, null, filesMenu);
			menu.add(filesButton);


			for ( let dir of Object.keys(this.__settings.dataDirs).sort() ) {

				const settings = this.__settings.dataDirs[ dir ];
				if ( ( settings.listed != undefined ) && !settings.listed )
					continue;

				const button = new qx.ui.menu.Button(dir);
				button.addListener("execute", function () {
					new desk.FileBrowser(dir, {standalone : true});
				});
				filesMenu.add(button);
			}

			var terminalButton = new qx.ui.menu.Button("Terminal");
			terminalButton.setBlockToolTip(false);
			terminalButton.setToolTipText("Open a new terminal window");
			terminalButton.addListener( 'execute', function () {
				new desk.Xterm.Terminal( {standalone : true} );
			});
			menu.add(terminalButton);

			var actionsMenu = new qx.ui.menu.Menu();
			menu.add(new qx.ui.menu.Button("Actions", null, null, actionsMenu));

			var showActionsButton = new qx.ui.menu.Button("Show running actions");
			showActionsButton.addListener( "execute", () => {

				this.__ongoingActionsWindow.open();
				this.__ongoingActionsWindow.center();

			} );

			actionsMenu.add(showActionsButton);

			var showHistoryButton = new qx.ui.menu.Button("Show actions history");
			showHistoryButton.addListener( "execute", () => {

				this.__historyWindow.open();
				this.__historyWindow.center();

			} );

			actionsMenu.add(showHistoryButton);

			var forceButton = new qx.ui.menu.CheckBox("Disable cache");
			forceButton.setBlockToolTip(false);
			forceButton.setToolTipText("When active, this options disables actions caching");
			forceButton.bind('value', this, 'forceUpdate');
			this.bind('forceUpdate', forceButton, 'value');
			actionsMenu.add(forceButton);

			menu.add(this.__getPasswordButton());
			var logMenu = new qx.ui.menu.Menu();
			menu.add(new qx.ui.menu.Button("Logs", null, null, logMenu));
			logMenu.add(this.__getConsoleLogButton());
			logMenu.add(this.__getServerLogButton());
			this.__addSaveActionButtons(menu);

			var devMenu = new qx.ui.menu.Menu();
			menu.add(new qx.ui.menu.Button("dev", null, null, devMenu));

			var links = {
				'THREE.js API' : 'https://threejs.org/docs/',
				'desk-ui API' : window.location.href + "/apiviewer",
				'desk-ui debug mode' : desk.FileSystem.getFileURL('ui/compiled/source'),
				'desk-ui changelog' : 'https://github.com/valette/desk-ui/commits/master',
				'Qooxdoo demo browser' : 'http://qooxdoo.org/qxl.demobrowser/',
				'Qooxdoo Widget browser' : 'https://qooxdoo.org/qxl.widgetbrowser/',
				'Qooxdoo Interactive playground' : 'https://qooxdoo.org/qxl.playground/'
			};

			Object.keys( links ).forEach( function (key) {
				var button = new qx.ui.menu.Button(key);
				button.addListener( 'execute', function () {
					var win = window.open(links[ key ], '_blank' );
					win.focus();
				});
				devMenu.add(button);
			});

			['make', 'qooxdoo'].forEach(function (action) {
				var button = new qx.ui.menu.Button(action);
				button.addListener('execute', function () {
					desk.FileSystem.executeScript('dev/' + action + '.js');
				});
				devMenu.add(button);
			});

			var button = this.__settingsButton = new qx.ui.form.MenuButton(null, "icon/16/categories/system.png", menu);
			button.setToolTipText("Files/Configuration");

			if ( !this.__engine ) return;

			setInterval( async ( ) => {

				const res = await desk.Actions.executeAsync( {

					action : 'cpuLoad',
					stdout  : true,
					silent : true

				} );

				const loadavg = JSON.parse( res.stdout )[ 0 ];
				const load = Math.max( 0, Math.min( 100, Math.round( 100 * loadavg ) ) );
				const color = Math.floor( 2.55 * ( 100 - load ));
				loadWidget.setBackgroundColor( 'rgb(255,'  + color + ', ' + color + ')');
				loadWidget.setLabel( "CPU Load  : " + load + "%" );

			}, 60000);

			qx.core.Init.getApplication().getRoot().add(button, {top : 0, right : 0});
		},

		/**
		* Creates the actions record/save buttons
		* @param actionsMenu {qx.ui.menu.Menu} input menu
		*/
		__addSaveActionButtons : function (actionsMenu) {

			const menu = new qx.ui.menu.Menu();
			actionsMenu.add(new qx.ui.menu.Button("Statifier", null, null, menu));
			let recordedFiles;
			let oldGetFileURL;
			const crypto = require( "crypto" );

			const getFileURL = file => {

				this.debug("read : " + file);
				this.__firstReadFile = this.__firstReadFile || file;
				recordedFiles.add( file );
				return oldGetFileURL( file );

			};

			const start = new qx.ui.menu.Button('Start recording');
			start.setBlockToolTip(false);
			start.setToolTipText("To save recorded actions");

			start.addListener('execute', async () => {

				this.__recordedActions = {};
				recordedFiles = new Set();
				this.__firstReadFile = null;
				oldGetFileURL = desk.FileSystem.getFileURL;
				desk.FileSystem.getFileURL = getFileURL;
				start.setVisibility("excluded");
				stop.setVisibility("visible");

				// hack to include init scripts
				const initDir = 'code/init';
				const exists = await desk.FileSystem.existsAsync( initDir );
				if ( exists ) desk.FileSystem.readDir(initDir, function () {});

			} );

			menu.add(start);

			const stop = new qx.ui.menu.Button('Stop recording').set({

				blockToolTip : false, toolTipText : "To stop recording and save actions",
				visibility : "excluded"

			});

			stop.addListener('execute', async () => {

				this.__settings.init.forEach( desk.FileSystem.getFileURL );
				desk.FileSystem.getFileURL = oldGetFileURL;

				const records = this.__toStatify = {
					actions : this.__recordedActions,
					files : Array.from( recordedFiles )
				};

				this.__recordedActions = null;

				alert(Object.keys(records.actions).length + " actions recorded\n"
					+ records.files.length + " files recorded");
				start.setVisibility("visible");
				stop.setVisibility("excluded");

			} );

			menu.add(stop);

			const statify = new qx.ui.menu.Button('Statify');
			statify.addListener('execute', this.__statify, this);
			menu.add( statify );

		},

		/**
		* Creates the password change button
		* @return {qx.ui.menu.Button} the button
		*/
		__getPasswordButton : function () {
			var button = new qx.ui.menu.Button('Change password');
			button.setBlockToolTip(false);
			button.setToolTipText("To change your password");
			button.addListener('execute', function () {
				var win = new qx.ui.window.Window();
				win.setLayout(new qx.ui.layout.VBox());
				var pass = new qx.ui.form.PasswordField();
				win.add( new qx.ui.basic.Label( "Enter new password:" ) );
				win.add(pass, {flex : 1});
				pass.addListenerOnce( 'appear', pass.focus, pass );
				win.add( new qx.ui.basic.Label( "Retype password:" ) );
				var pass2 = new qx.ui.form.PasswordField();
				win.add(pass2, {flex : 1});
				var button = new qx.ui.form.Button( "Save password" );
				button.addListener( 'execute', function () {
					if ( pass.getValue().length && ( pass.getValue() === pass2.getValue() ) ){
						this.__socket.emit( 'password', pass.getValue() );
						win.close();
					} else {
						alert( 'Password not typed correctly twice! Please retry' );
					}
				}, this );
				win.add( button, { flex : 1 });
				win.open();
				win.center();
				win.addListener( 'close', function () {
					button.destroy();
					pass.destroy();
					pass2.destroy();
					win.destroy();
				});
			}, this);
			return button;
		},

		/**
		* Creates the server log button
		* @return {qx.ui.menu.Button} the button
		*/
		__getServerLogButton : function () {
			var button = new qx.ui.menu.Button('Server log');
			button.setBlockToolTip(false);
			button.setToolTipText("To display server logs");
			button.addListener('execute', function () {
				function displayLog(data) {
					if ( typeof data === "object" ) data = JSON.stringify( data, null, "  " );
					log.log( data + '\n', 'yellow');
				}
				var win = new qx.ui.window.Window('Server log').set(
					{width : 600, height : 500, layout : new qx.ui.layout.HBox()});
				var log = new desk.Xterm.Logger().set({backgroundColor : 'black'});
				win.add(log, {flex : 1});
				this.__setEmitLog(true);
				this.__socket.on("log", displayLog);
				win.addListener('close', function () {
					this.__socket.removeListener('log', displayLog);
					this.__setEmitLog(false);
				}, this);
				win.open();
				win.center();
			}, this);
			return button;
		},

		/**
		* Creates the console log button
		* @return {qx.ui.menu.Button} the button
		*/
		__getConsoleLogButton : function () {

			const button = new qx.ui.menu.Button('Console log');
			button.setBlockToolTip(false);
			button.setToolTipText("To display console logs");
			button.addListener('execute', () => {

				const oldConsoleLog = console.log;

				console.log = function (message) {

					oldConsoleLog.apply( console, arguments );
					log.log( message.toString() + '\n' );

				};

				const win = new qx.ui.window.Window( 'Console log' ).set(
					{width : 600, height : 300, layout : new qx.ui.layout.HBox()});

				const log = new desk.Xterm.Logger();
				win.add(log, { flex : 1 } );

				win.addListener( 'close', function () {

					console.log = oldConsoleLog;

				} );

				win.open();
				win.center();

			} );

			return button;

		},

		__createErrorContainer : function () {

			const cont = this.__errorContainer = new qx.ui.container.Composite();
			cont.set( {
				layout : new qx.ui.layout.VBox(),
				width : 350,
				height : 80,
				zIndex : 1000000,
				decorator : "border-invalid",
				backgroundColor : "white"
			} );

			qx.core.Init.getApplication().getRoot().add(
				cont, { right : 100, top : 0 } );

			const label = new qx.ui.basic.Label( "<strong>An action error has occured. Please check history</strong>" );
			label.set( { rich : true } );
			cont.add( label, { flex : 1 } );

			const cont2 = new qx.ui.container.Composite( new qx.ui.layout.HBox() );

			const button = new qx.ui.form.Button( "Check history" );
			button.addListener( "execute", () => {
				this.__historyWindow.open();
				this.__historyWindow.center();
				cont.setVisibility( "excluded" );
			} );
			cont2.add( button, { flex : 1 } );

			const clearButton = new qx.ui.form.Button( "Clear" );
			clearButton.addListener( "execute", () => {
				cont.setVisibility( "excluded" );
			} );
			cont2.add( clearButton, { flex : 1 } );
			cont.add( cont2, { flex : 1 } );
			cont.setVisibility( "excluded" );

		},

		__createDisconnectContainer : function () {

			const cont = this.__disconnectContainer = new qx.ui.container.Composite();
			cont.set( {
				layout : new qx.ui.layout.VBox(),
				width : 350,
				height : 50,
				zIndex : 1000000,
				decorator : "border-invalid",
				backgroundColor : "white"
			} );

			qx.core.Init.getApplication().getRoot().add(
				cont, { left : 100, top : 0 } );

			const label = new qx.ui.basic.Label( "<strong>Disconnected from server. Please wait</strong>" );
			label.set( { rich : true } );
			cont.add( label, { flex : 1 } );
			cont.setVisibility( "excluded" );

		},

		/**
		* Returns the complete settings object
		* @return {Object} settings
		*/	
		getSettings : function () {
			return JSON.parse(JSON.stringify(this.__settings));
		},

		/**
		* Returns the JSON object defining a specific action
		* @param name {String} the action name
		* @return {Object} action parameters as a JSON object
		*/	
		getAction : function (name) {
			var action = this.__settings.actions[name];
			return action ? JSON.parse(JSON.stringify(action)) : null;
		},

		
		/**
		* Returns the container which lists all ongoing actions
		* @return {qx.ui.form.List} actions menu
		*/
		getOnGoingContainer : function() {
			return this.__ongoingActions;
		},

		/**
		* builds the actions UI. Does nothing now
		*/
		buildUI : function () {
			console.warn( "desk.Actions.buildUI() is now useless. Do not call it." );

		},

		/**
		* kills an action
		* @param handle {String} action handle to kill
		* @param callback {Function} callback when the action has been killed
		* @param context {Object} optional context for the callback
		*/
		killAction : function (handle, callback, context) {

			desk.Actions.execute({manage : 'kill', actionHandle : handle}, callback, context);

		},

		/**
		* returns the SHA1 hash of action parameters (handle omitted)
		* @param params {Object} action parameters
		* @return {String} the hash
		*/
		__getActionSHA : function (params) {

			const log = desk.Actions.logSHA;
			const parameters = _.omit(params, 'handle');
			if ( log ) console.log( "SHA:" );
			if ( log ) console.log( parameters.action );
			if ( log ) console.log( parameters );
			const sha = require( "crypto" ).createHash("SHA1");
			sha.update(JSON.stringify(parameters));
			const res = sha.digest("hex")
			if ( log ) console.log( res );
			return res;

		},

		/**
		* Fired whenever an action is finished
		* @param res {Object} the server response
		*/
		__onActionEnd : async function ( res ) {

			const params = this.__runingActions[ res.handle ];
			if ( !params ) return;
			res.action = params.POST.action;

			if ( params.listener ) {

				if ( this.__socket )
					this.__socket.removeListener( "actionEvent", params.listener );

				if ( ( res?.status != 'CACHED' ) && this.__recordedActions ) {

					for ( let type of [ "log", "err" ] )
						desk.FileSystem.getFileURL(
							res.outputDirectory + "action." + type );

				}

				if ( ( res?.status === 'CACHED' ) || !this.__socket ) {

					params.listener( {

						handle : res.handle,
						type : "outputDirectory",
						data : res.outputDirectory

					} );

					for ( let [ type, stream ] of [ [ "log", "stdout" ], [ "err", "stderr" ] ] ) {

						const log = await desk.FileSystem.readFileAsync(
							res.outputDirectory + "action." + type );

						for ( let line of log.split( '\n' ) ) {

							params.listener( {

								handle : res.handle,
								type : stream,
								data : line + "\n"

							} );

						}

					}

				}

			}

			if (this.__recordedActions && this.__engine)
				this.__recordedActions[this.__getActionSHA(params.POST)] = res;

			delete this.__runingActions[ res.handle ];

			if ( res.error  ) {

				console.log( "Error : ", res );
				if ( res.error.message ) console.log( res.error.message );
				params.error = res.error;
				this.__errorContainer.setVisibility( "visible" );

			}

			const item = params.item || this.__addActionToList( params );

			if ( item ) {

				params.response = res;
				this.__actionsGarbageContainer.add( item );
				this.__addFinishedAction( params );

			}

			if ( this.__settingsButton && ( this.__ongoingActions.getChildren().length == 0 ) )
				this.__settingsButton.setBackgroundColor( "transparent" );

			try {

				if ( params.callback )
					params.callback.call(params.context, res.killed || res.error, res);

			} catch ( e ) { console.warn( e ); }

			for ( let field of [ "callback", "item", "context", "listener" ] )
				delete params[ field ];

		},

		/**
		* launches an action
		* @deprecated {5.0} Please use Use desk.Actions.execute() instead
		* @param params {Object} object containing action parameters
		* @param callback {Function} callback for when the action has been performed
		* @param context {Object} optional context for the callback
		* @return {String} action handle for managemenent (kill etc...)
		*/
		launchAction : function (params, callback, context) {
			console.error(new Error('desk.actions.launchAction is deprecated! Use desk.Actions.execute() instead!'));
			return desk.Actions.execute(params, function (err, res) {
				if (typeof callback === "function") {
					res.err = err;
					callback.call(context, res);
				}
			});
		},

		/**
		* Adds the action widget to the list of runing actions
		* @param params {Object} action parameters
		*/
		__addActionToList : function(params) {

			if ( !params || params.POST.silent || params.POST.manage ) {
				return;
			}

			let item = this.__actionsGarbageContainer.getChildren()[ 0 ];
			if ( !item ) item = new qx.ui.form.ListItem("dummy");
			item.setLabel(params.POST.action || params.POST.manage || "");
			params.item = item;
			item.setUserData( "params" , params );
			if ( this.__ongoingActions ) this.__ongoingActions.add( item );
			if ( this.__settingsButton ) this.__settingsButton.setBackgroundColor( "green" );
			return item;

		},

		/**
		* Loads actions.json from server and refreshes the action menu
		*/
		__loadSettings : function() {
			this.debug("loading actions");
			desk.FileSystem.readFile('actions.json', function (err, res) {
				this.__setSettings(JSON.parse(res));
			}.bind(this));
		},

		/**
		* refreshes the actions
		* @param settings {Object} new settings
		*/
		__setSettings : async function( settings ) {

			if ( this.__serverRandomValue && (this.__serverRandomValue != settings.randomValue ) ) {
				console.warn( "Server has restarted" );
			}

			this.__serverRandomValue = settings.randomValue;

			if ( this.__settings && this.__settings.version == settings.version ) {
				this.debug( "update avoided" );
				// avoid updating when version is the same
				return;
			}

			this.debug("Updating settings");
			settings.init = settings.init || [];

			console.log("Desk launched, baseURL : " + desk.FileSystem.getBaseURL());
			console.log("Settings : ", settings);

			this.fireEvent('update');

			if ( this.__settings && !this.__settings.not_initialised ) {
				this.debug("Init files already loaded");
				this.__settings = settings;
				return;
			}

			this.__settings = settings;
			if ( settings.permissions ) this.__createActionsMenu();
			this.debug("loading init files");
			const initDir = 'code/init';

			if ( await desk.FileSystem.existsAsync( initDir ) ) {

				const files = await desk.FileSystem.readDirAsync( initDir );

				for ( let file of files ) {
					if ( file.name.split( "." ).pop().toLowerCase() === "js" )
						settings.init.push(initDir + '/' + file.name);
				}

			}
			await desk.FileSystem.includeScriptsAsync(
				settings.init.map( file => desk.FileSystem.getFileURL(file) ) );

			this.fireEvent('changeReady');

		},

		/**
		* Copies recorded actions and files to a static location
		*/

		__statifyWindow : null,
		__statifyLog : null,
		__slimStatification : null,

		/**
		* Executes statification
		* @param show {Boolean} display or not the statify window
		*/
		__statify : async function (show) {

			let win = this.__statifyWindow;

			if (!win) {

				win = this.__statifyWindow = new qx.ui.window.Window( "Statify" );
				win.set({layout : new qx.ui.layout.VBox(), 
					height :400, width : 500, showClose : false});
				this.__slimStatification = new qx.ui.form.CheckBox( "Slim statification" );
				this.__slimStatification.setValue( true );
				win.add( this.__slimStatification );
				this.__statifyLog = new desk.Xterm.Logger();
				win.add( this.__statifyLog, { flex :1 } );
				var button = new qx.ui.form.Button( "Statify" );
				button.addListener( "execute", () => this.__statify2() );
				win.add(button);

			}

			const log = this.__statifyLog;

			if ( show ) {

				win.open();
				win.center();

			}

			log.clear();

			const content = this.__toStatify;
			const actions = content.actions;
			const files = content.files;
			const usedCachedDirs = {};

			for ( let file of files ) {

				if ( file.slice( 0, 6 ) === 'cache/' ) {
					const dir = desk.FileSystem.getFileDirectory( file )
						.split('/')
						.filter( function ( f ) { return f.length } )
						.join('/')
						+ "/";

					usedCachedDirs[ dir ] = true;
				}
			}

			let nUnused = 0;

			for ( let hash of Object.keys( actions ) ) {

				let dir = actions[ hash ].outputDirectory;
				if ( !dir ) continue;

				dir = dir.split('/')
					.filter( function ( f ) { return f.length } )
					.join('/')
					+ "/";

				if ( !usedCachedDirs[ dir ] ) {

					actions[ hash ].unused = true;

				}

			}

			if ( nUnused ) log.log( nUnused + ' actions were discarded as they were not used.\n' );
			log.log("Actions to copy : \n");
			for ( let action of Object.values( actions ) ) log.log( action.outputDirectory + '\n', "blue" );
			if ( Object.keys( actions ).length === 0 ) log.log( "none\n" );
			log.log( "Files to copy : \n" );
			for ( let file of files ) log.log( file + '\n' );
			if ( files.length === 0) log.log("none\n");

		},

		/**
		* Executes statification (for real...)
		* @param content {Object} content to statify
		*/
		__statify2 : async function() {

			const content = this.__toStatify;
			var installDir = prompt('output directory?' , "code/static");
			var boot = prompt('what is the startup file?', this.__firstReadFile );
			var startupFile;

			if ( !boot ) {
				boot = "";
			} else {
				startupFile = boot;
				boot = 'desk_startup_script = "' + boot + '";';
			}

			await desk.Actions.executeAsync( {
				   action : "copy",
				   source : desk.Actions.statifyCode,
				   destination : installDir,
				   recursive : true
			} );

			await desk.FileSystem.mkdirpAsync(installDir + "/cache" );
			this.debug("copying actions results...");
			let files = content.actions;

			for ( let res of Object.values( files ) ) {

				var source = res.outputDirectory;
				if ( !source ) continue;
				var des2 = source.split('/');
				des2.pop();
				des2.pop();
				if ( res.unused ) {
					delete res.unused;
					continue;
				}

				if ( this.__slimStatification.getValue() ) {

					const action = this.__settings.actions[ res.action ];

					if ( !action.statify ) {

						this.__statifyLog.log( "Avoid " + res.action + " " + source + "\n", "red" );
						continue;

					}

				}

				var dest = installDir + '/' + des2.join("/");
				await desk.FileSystem.mkdirpAsync( dest );
				this.__statifyLog.log( "copying " + source + " to " + dest + "\n" );
				await desk.Actions.executeAsync( {
					action : "copy",
					source : source,
					recursive : true,
					destination : dest
				} );
			}

			this.debug("copying files...");
			files = content.files;
			files.push( startupFile );

			for ( let file of files )  {

				this.debug( "file : ", file );
				if ( !file ) continue;
				if ( !( await desk.FileSystem.existsAsync( file ) ) ) {

					this.__statifyLog.log( "skipping " + file + " copy" + "\n" );
					continue;
				}

				var dest = installDir + "/" + desk.FileSystem.getFileDirectory( file );
				await desk.FileSystem.mkdirpAsync( dest )
				this.__statifyLog.log( "copying " + file + " to " + dest + "\n" );

				await desk.Actions.executeAsync( {

					action : "copy",
					source : file,
					recursive : true,
					destination : dest

				} );

			}

			// hack index.html
			var file = installDir + "/index.html";
			res = await desk.FileSystem.readFileAsync(file, {forceText : true} )
			var lines = res.split('\n').map(function (line, index) {
				if (line.indexOf('desk_startup_script') >= 0) {
					return boot;
				} else {
					return line;
				}
			});
			await desk.FileSystem.writeFileAsync(file, lines.join('\n') );
			this.debug("Writing recorded actions");

			await desk.FileSystem.writeFileAsync( installDir + "/" + this.__savedActionFile,
				JSON.stringify( content ) );

			this.debug("copying actions list");
			desk.FileSystem.writeJSONAsync( installDir + "/actions.json", this.__settings );
			this.__statifyLog.log( "Done\n" );
			this.debug( "Records statified!" );
			alert( "done" );
		}
	}
}
);

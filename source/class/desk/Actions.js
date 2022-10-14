/**
 * Singleton class which stores all available actions, handles launching
 * and display actions in progress
 * @asset(desk/desk.png)
 * @asset(qx/icon/${qx.icontheme}/16/categories/system.png) 
 * @asset(qx/icon/${qx.icontheme}/16/actions/dialog-close.png)
 * @ignore (require)
 * @ignore (_.*)
 * @ignore (confirm)
 * @ignore (jsSHA)
 * @ignore (prettyData.json)
 * @ignore (prompt)
 * @ignore (desk_startup_script)
 * @lint ignoreDeprecated (alert)
 * @require(desk.LogContainer)
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
		desk.AddLibs.getInstance();
		desk.AddPromises.getInstance();
		desk.FileSystem.getInstance();
		this.__garbageContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox());

		if ( typeof desk_startup_script !== "string" ) {
			if ( qx.bom.Cookie.get("homeURL" ) ) {
				// support for node.js
				this.__socket = require('socket.io-client')({path : desk.FileSystem.getBaseURL() + 'socket.io'});
				this.__engine = "node";
				this.__socket.on("action started", function (POST) {
					var actions = desk.Actions.getInstance();
					var params = actions.__runingActions[POST.handle] =
						actions.__runingActions[POST.handle] || { POST : POST };
					setTimeout(function () {
						actions.__addActionToList( actions.__runingActions[POST.handle] );
					}.bind( this ) , 2000 );
				}, this );
				this.__socket.on("action finished", this.__onActionEnd.bind(this));
				this.__socket.on("disconnect", function () {
					console.warn( 'disconnected from server' );
					this.__socket.once( 'connect', function () {
						console.warn( 'connected' );
						desk.Actions.execute( { manage : 'list'}, function (err, res) {
							var actions = res.ongoingActions
							this.__ongoingActions.getChildren().slice().map( function ( item ) {
								var params = item.getUserData( 'params' );
								var action = actions[ params.POST.handle ];
								if ( !action ) {
									params.callback = function () {};
									this.__onActionEnd( { handle : params.POST.handle } );
								}

							}.bind( this ) );
						}.bind( this ) );
					}.bind( this ) );
				}.bind( this ) );
				console.log("powered by node.js");
				this.__socket.once( "connect", function () {
					// add already running actions
					desk.Actions.execute( { manage : 'list'}, function (err, res) {
						var actions = res.ongoingActions
						Object.keys(actions).forEach( function ( handle ) {
							desk.Actions.getInstance().__addActionToList( actions[ handle ] );
							desk.Actions.getInstance().__runingActions[ handle ] = actions[ handle ];
						});
					} );
				} );
			} else try {
				// support for electron.js / nw.js
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
					var ipcRenderer = require(el).ipcRenderer
					window.prompt = function(title, val) {
						return ipcRenderer.sendSync('prompt', {title : title, val : val});
					}
				} else {
					console.log("powered by nw.js");
					this.__engine = "nw";
				}
				this.__loadSettings();
			} catch (e) {
				console.log(e);
			}
		}

		if (!this.__engine) {
			desk.FileSystem.readFile(this.__savedActionFile,
				function (err, result) {
					console.log(err);
					if (err) {
						console.log("Error while reading actions cache");
					}
					try {
						result = JSON.parse(result);
						this.__recordedActions = result.actions;
						this.__loadSettings();
					} catch ( e ) {
						console.log("Error while reading actions cache");
						this.fireEvent('changeReady');
					}
			}, this);
			return;
		}

		this.__socket.on("actions updated", this.__setSettings.bind(this));
		this.__ongoingActions = new qx.ui.container.Composite(new qx.ui.layout.VBox());
		this.__clearErrorButton = new qx.ui.form.Button(null, "icon/16/actions/dialog-close.png");
		this.__clearErrorButton.addListener( "click" , function () {
			Object.entries( this.__runingActions ).forEach( function ( entry ) {
				if ( entry[ 1 ].error ) this.killAction( entry[ 0 ] );
			}, this );
			this.__clearErrorButton.setVisibility( "excluded" );
		}, this );
		this.__clearErrorButton.setToolTipText("Clear errors");
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
			var actions = desk.Actions.getInstance();
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
						options.listener(message);
					}
				};
				actions.__socket.on("actionEvent", parameters.listener);
			}

			if (actions.__recordedActions && !actions.__engine) {
				var response = actions.__recordedActions[actions.__getActionSHA(params)];
				if (response) {
					response.handle = params.handle;
					setTimeout(function () {
						actions.__onActionEnd(response);
					}, 1);
				} else {
					console.log("Error : action not found");
					console.log(params);
				}
			} else {
				actions.__execute(params);
			}

			actions.__runingActions[params.handle] = parameters;
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
		}

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
		__clearErrorButton : null,
		__recordedActions : null,
		__savedActionFile : 'cache/responses.json',
		__firstReadFile : null,
		__settingsButton : null,
		__engine : false,

		statifyCode : "ui/compiled/build",

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

		/**
		* Creates the action menu
		*/
		__createActionsMenu : function () {
			var menu = new qx.ui.menu.Menu();

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
				button.addListener("execute", function (e) {
					new desk.FileBrowser(dir, {standalone : true});
				});
				filesMenu.add(button);
			}

			var terminalButton = new qx.ui.menu.Button("Terminal");
			terminalButton.setBlockToolTip(false);
			terminalButton.setToolTipText("Open a new terminal window");
			terminalButton.addListener( 'execute', function () {
				new desk.Terminal( {standalone : true} );
			});
			menu.add(terminalButton);

			var forceButton = new qx.ui.menu.CheckBox("Disable cache");
			forceButton.setBlockToolTip(false);
			forceButton.setToolTipText("When active, this options disables actions caching");
			forceButton.bind('value', this, 'forceUpdate');
			this.bind('forceUpdate', forceButton, 'value');
			menu.add(forceButton);

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
				'desk-ui API' : desk.FileSystem.getFileURL('ui/compiled/dist/apiviewer'),
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

			setInterval( function( ){

				desk.Actions.execute({

					action : 'cpuLoad',
					stdout  : true,
					silent : true

				}, function ( err, res ) {

					var loadavg = JSON.parse( res.stdout )[ 0 ];
					var load = Math.max( 0, Math.min( 100, Math.round( 100 * loadavg ) ) );
					var color = Math.floor( 2.55 * ( 100 - load ));
					loadWidget.setBackgroundColor( 'rgb(255,'  + color + ', ' + color + ')');
					loadWidget.setLabel( "CPU Load  : " + load + "%" );

				} );

			}, 5000);

			qx.core.Init.getApplication().getRoot().add(button, {top : 0, right : 0});
		},

		/**
		* Creates the actions record/save buttons
		* @param actionsMenu {qx.ui.menu.Menu} input menu
		*/
		__addSaveActionButtons : function (actionsMenu) {
			var menu = new qx.ui.menu.Menu();
			actionsMenu.add(new qx.ui.menu.Button("Statifier", null, null, menu));
			var recordedFiles
			var oldGetFileURL;

			var getFileURL = function (file) {
				this.debug("read : " + file);
				this.__firstReadFile = this.__firstReadFile || file;
				var sha = new jsSHA("SHA-1", "TEXT");
				sha.update(JSON.stringify(file));
				recordedFiles[sha.getHash("HEX")] = file;
				return oldGetFileURL(file);
			}.bind(this);

			var start = new qx.ui.menu.Button('Start recording');
			start.setBlockToolTip(false);
			start.setToolTipText("To save recorded actions");
			start.addListener('execute', function () {
				this.__recordedActions = {};
				recordedFiles = {};
				this.__firstReadFile = null;
				oldGetFileURL = desk.FileSystem.getFileURL;

				desk.FileSystem.getFileURL = getFileURL;
				start.setVisibility("excluded");
				stop.setVisibility("visible");

				// hack to include init scripts
				var initDir = 'code/init';
				desk.FileSystem.exists(initDir, function ( err, exists ) {
					if ( exists ) desk.FileSystem.readDir(initDir, function () {});
				} );
			}, this);
			menu.add(start);

			var stop = new qx.ui.menu.Button('Stop recording').set({
				blockToolTip : false, toolTipText : "To stop recording and save actions",
				visibility : "excluded"
			});

			stop.addListener('execute', function () {
				this.__settings.init.forEach(desk.FileSystem.getFileURL);

				desk.FileSystem.getFileURL = oldGetFileURL;

				var records = {actions : this.__recordedActions,
					files : recordedFiles
				};
				this.__recordedActions = null;
				this.debug( 'saving action list to ' + this.__savedActionFile );
				desk.FileSystem.writeFile(this.__savedActionFile,
					JSON.stringify(records), function () {
						alert(Object.keys(records.actions).length + " actions recorded\n"
							+ Object.keys(records.files).length + " files recorded");
						start.setVisibility("visible");
						stop.setVisibility("excluded");
				}, this);
			}, this);
			menu.add(stop);

			var statify = new qx.ui.menu.Button('Statify');
			statify.addListener('execute', this.__statify, this);
			menu.add(statify);
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
				var log = new desk.LogContainer().set({backgroundColor : 'black'});
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
			var button = new qx.ui.menu.Button('Console log');
			button.setBlockToolTip(false);
			button.setToolTipText("To display console logs");
			button.addListener('execute', function () {
				var oldConsoleLog = console.log;
				console.log = function (message) {
					oldConsoleLog.apply(console, arguments);
					log.log(message.toString() + '\n' );
				};
				var win = new qx.ui.window.Window('Console log').set(
					{width : 600, height : 300, layout : new qx.ui.layout.HBox()});
				var log = new desk.LogContainer();
				win.add(log, {flex : 1});
				win.addListener('close', function () {
					console.log = oldConsoleLog;
				});
				win.open();
				win.center();
			}, this);
			return button;
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
		* builds the actions UI
		*/
		buildUI : function () {
			this.__ongoingActions.set ({width : 200, zIndex : 1000000,
				decorator : "statusbar", backgroundColor : "transparent"});
			qx.core.Init.getApplication().getRoot().add(this.__ongoingActions, {top : 0, right : 100});
			qx.core.Init.getApplication().getRoot().add(this.__clearErrorButton, {top : 0, right : 300});
			this.__clearErrorButton.set ({visibility : "excluded", zIndex : 1000000 });

		},

		/**
		* kills an action
		* @param handle {String} action handle to kill
		* @param callback {Function} callback when the action has been killed
		* @param context {Object} optional context for the callback
		*/
		killAction : function (handle, callback, context) {
			var params = this.__runingActions[handle];
			if (params && params.item && (params.item.getDecorator() === "tooltip-error")) {
				this.__garbageContainer.add(params.item);
				params.item.resetDecorator();
				delete this.__runingActions[handle];
				return;
			}
			desk.Actions.execute({manage : 'kill', actionHandle : handle}, callback, context);
		},

		/**
		* returns the SHA1 hash of action parameters (handle omitted)
		* @param params {Object} action parameters
		* @return {String} the hash
		*/
		__getActionSHA : function (params) {
			var parameters = _.omit(params, 'handle');
			var sha = new jsSHA("SHA-1", "TEXT");
			sha.update(JSON.stringify(parameters));
			return sha.getHash("HEX");
		},

		/**
		* Fired whenever an action is finished
		* @param res {Object} the server response
		*/
		__onActionEnd : function (res) {
			var params = this.__runingActions[res.handle];
			if (!params) return;

			if (params.listener) {
				this.__socket.removeListener("actionEvent", params.listener);
			}

			if (this.__recordedActions && this.__engine) {
				this.__recordedActions[this.__getActionSHA(params.POST)] = res;
			}

			if ( params.POST.manage ) {

				delete this.__runingActions[ res.handle ];

			} else if ( res.error  ) {

				console.log( "Error : ", res );
				if ( res.error.message ) console.log( res.error.message );
				params.error = res.error;
				var item = params.item;
				if ( item ) item.setDecorator("tooltip-error");
				this.__clearErrorButton.setVisibility( "visible" );

			} else {

				delete this.__runingActions[res.handle];
				if (params.item) this.__garbageContainer.add(params.item);

			}

			if (params.callback) {
				params.callback.call(params.context, res.killed || res.error, res);
			}
		},

		__garbageContainer : null,

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
			if (this.__ongoingActions.getChildren().length > 20) {
				setTimeout(function () {
					this.__addActionToList(params);
				}.bind(this), 2000 * Math.random());
				return;
			}
			var item = this.__garbageContainer.getChildren()[0];
			if (!item) {
				item = new qx.ui.form.ListItem("dummy");

				var kill = new qx.ui.menu.Button('Kill/remove');
				kill.addListener('execute', function () {
					this.killAction(item.getUserData("params").POST.handle);
				}, this);

				var killAll = new qx.ui.menu.Button('Kill/remove all').set({
					blockToolTip : false, toolTipText : "To kill all runing actions on server"});
				killAll.addListener('execute', function () {
					if (!confirm('Do you want to kill all actions?')) {
						return;
					}
					Object.keys(this.__runingActions).forEach(_.ary(this.killAction, 1), this);
				}, this);
				
				var properties = new qx.ui.menu.Button('Properties');
				properties.addListener('execute', function () {
					console.log(item.getUserData("params"));
				}, this);
				
				var tail = new qx.ui.menu.Button('Console output');
				tail.addListener('execute', function () {
					var handle = item.getUserData("params").POST.handle;
					desk.Actions.execute( { manage : 'list'}, function (err, res) {
						Object.keys(res.ongoingActions).forEach( function ( handle2 ) {
							if ( handle !== handle2 ) return;
							new desk.FileTail( res.ongoingActions[handle].outputDirectory + "action.log" );
						});
					} );
				} );

				var menu = new qx.ui.menu.Menu();
				menu.add(kill);
				menu.add(killAll);
				menu.add(properties);
				menu.add(tail);
				item.setContextMenu(menu);
			}
			item.setLabel(params.POST.action || params.POST.manage || "");
			if ( params.POST.action && ( params.POST.action === "cpuLoad" ) ) {
				item.setLabel( "Reconnecting to server ..." );
				this.__socket.connect();
			}

			item.setOpacity( 0.7 );
			if ( params.error ) {
				this.__clearErrorButton.setVisibility( 'visible' );
				item.setDecorator( "tooltip-error" );
			} else {
				item.setDecorator( "button-hover" );
			}
			params.item = item;
			item.setUserData("params", params);
			this.__ongoingActions.add(item);
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
				this.__statifyLog = new desk.LogContainer();
				win.add( this.__statifyLog, { flex :1 } );
				var button = new qx.ui.form.Button( "Statify" );
				button.addListener( "execute", () => this.__statify2( content ) );
				win.add(button);

			}

			const log = this.__statifyLog;

			if ( show ) {
				win.open();
				win.center();
			}

			log.clear();
			const res = await desk.FileSystem.readFileAsync( this.__savedActionFile )
			const content = JSON.parse( res ) ;
//			if (err) content = {files : {} ,actions : {}};
			var actions = content.actions;
			var files = content.files;
			var usedCachedDirs = {};

			for ( let file of Object.values( files ) ) {

				if ( file.slice( 0, 6 ) === 'cache/' ) {
					const dir = desk.FileSystem.getFileDirectory( file )
						.split('/')
						.filter( function ( f ) { return f.length } )
						.join('/')
						+ "/";

					usedCachedDirs[ dir ] = true;
				}
			}

			var nUnused = 0;

			for ( let hash of Object.keys( actions ) ) {

				let dir = actions[ hash ].outputDirectory;
				if ( !dir ) continue;

				dir = dir.split('/')
					.filter( function ( f ) { return f.length } )
					.join('/')
					+ "/";

				if ( !usedCachedDirs[ dir ] ) {

					delete actions[ hash ];
					nUnused++;

				}

			}

			if ( nUnused ) log.log( nUnused + ' actions were discarded as they were not used.\n' );
			log.log("Actions to copy : ");
			for ( let action of Object.values( actions ) ) log.log( action.outputDirectory + '\n', "blue" );
			if ( Object.keys( actions ).length === 0 ) log.log( "none\n" );
			log.log( "Files to copy : " );
			for ( let file of Object.values( files ) ) log.log( file + '\n' );
			if ( Object.keys( files ).length === 0) log.log("none\n");

		},

		/**
		* Executes statification (for real...)
		* @param content {Object} content to statify
		*/
		__statify2 : async function(content) {
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
				   source : this.statifyCode,
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
				var dest = installDir + '/' + des2.join("/");
				await desk.FileSystem.mkdirpAsync( dest )
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
			files.boot = startupFile;

			for ( let file of Object.values(files) )  {

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
			this.debug("copying recorded actions");

			await desk.Actions.executeAsync( {
				action : "copy",
				source : this.__savedActionFile,
				destination : installDir + "/cache"
			} );

			this.debug("copying actions list");
			desk.FileSystem.writeJSONAsync( installDir + "/actions.json", this.__settings );
			this.__statifyLog.log( "Done\n" );
			this.debug( "Records statified!" );
			alert("done");
		}
	}
});

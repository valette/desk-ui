/**
 * A container to launch RPC actions and edit parameters
 * @lint ignoreDeprecated (alert)
 * @ignore (Promise.all)
 * @ignore (_.*)
 */
qx.Class.define("desk.Action", 
{
	extend : qx.ui.container.Composite,
	/**
	* Creates a new container
	* @param name {String} name of the action to create
	* @param opt {Object} settings object. Available options:
	* <pre class='javascript'>
	* { <br>
	*   standalone : true/false, <br> defines whether the container should be
	* embedded in a window or not (default : false)
	* }
	* </pre>
	*/
	construct : function ( name, opt ) {

		opt = opt || {};
		this.base( arguments );
		this.__action = desk.Actions.getInstance().getAction( name );
		qx.core.Assert.assert( _.isObject( this.__action ), 'action "' + name +  '" not found');
		this.__name = name;
		if ( opt.standalone ) this.__standalone = true;
		this.__connections = [];
		this.__buildUI();

	},

	properties : {
		/** disable caching*/
		forceUpdate : { init : false, check: "Boolean", event : "changeForceUpdate"},
		/** force caching*/
		forceCache : { init : false, check: "Boolean", event : "changeForceCache"}
	},

	statics : {
		/**
		* Creates a new container, with parameters contained in a JSON file
		* @param file {String} .JSON file to get settings from
		*/
		CREATEFROMFILE : function (file) {
			desk.FileSystem.readFile(file, function (err, parameters) {
				parameters = JSON.parse (parameters);
				var action = new desk.Action (parameters.action, {standalone : true});
				action.setParameters(parameters);
			});
		}
	},

	events : {
		/**
		* Fired whenever the output directory is changed
		*/
		"changeOutputDirectory" : "qx.event.type.Event",

		/**
		* Fired whenever the action has been completed
		*/
		"actionUpdated" : "qx.event.type.Data",

		/**
		* Fired whenever the action has been triggered
		*/
		"actionTriggered" : "qx.event.type.Data",

		/**
		* Fired whenever a parameter has been modified
		*/
		"changeParameter" : "qx.event.type.Data",

	},

	members : {
		__actionsCounter : 0,

        __controls : null,

        __tabView : null,

		__connections : null,

		__outputDir : null,

		__action : null,

		__name : null,

		__standalone : false,

		__window : null,

		__manager : null,

		__fileBrowser : null,
		__logContainer : null,
		__outputTab : null,
		__logTab : null,

		/**
		* Returns the buttons container
		* @return {qx.ui.container.Composite} the controls container
		*/
        getControlsContainer : function () {
            return this.__controls;
        },

		/**
		* Connects a parameter to an output file from an other action
		* @param parameterName {String} name of the parameter to set
		* @param parentAction {desk.Action} action to link to
		* @param fileName {string} name of the output file from parentAction
		*/
		connect : function ( parameter, action, file ) {

			if ( action === this ) return;
			this.__connections.push( { action, parameter, file } );
			this.setParameterVisibility( parameter, false );

		},

		/**
		* Disconnects a parameter to an output file from an other action
		* @param parameterName {String} name of the parameter to set
		* @param parentAction {desk.Action} action to link to
		* @param fileName {string} name of the output file from parentAction
		*/
		disconnect : function ( parameter, action, file ) {

			this.__connections = this.__connections.filter( c => {

				if ( ( c.parameter == parameter ) && ( c.action == action )
					&& ( c.file == file ) ) {

					this.setParameterVisibility( parameter, true );
					return false;

				} else return true;

			} );

		},

		/**
		* Defines the output directory for the action
		* @param directory {String} target directory
 		* @param loadJSON {bool} determines whether saved json 
 		* parameters file will be loaded from the output directory (default : true)
		*/
		setOutputDirectory : async function ( directory, loadJSON ) {

			if ( !directory.endsWith ( '/' ) ) directory += '/';
			this.__outputDir = directory;

			if ( ( loadJSON === false ) || ( directory === "cache/" ) ) {

				this.fireEvent("changeOutputDirectory");
				return;

			}

			const jsonFile = this.getOutputDirectory() + 'action.json';
			if ( !( await desk.FileSystem.existsAsync (jsonFile ) ) ) return;
			const result = await desk.FileSystem.readFileAsync( jsonFile );
			this.setParameters( JSON.parse( result ) );
			if ( this.__tabView ) this.__addOutputTab();
			this.fireEvent("changeOutputDirectory");

        },

		/**
		* Returns the action output directory
		* @return {String} output directory
		*/
		getOutputDirectory : function () {
			return this.__outputDir;
		},

		/**
		* DEPRECATED! use desk.Action.setParameters() instead
		* @param parameters {Object} parameters as JSON object
		*/
		setActionParameters : function (parameters) {
			console.log("desk.Action.setActionParameters() is deprecated, use setParameters")
			console.log(new Error().stack);
			this.setParameters(parameters, !this.__standalone);
		},

		/**
		* DEPRECATED! use desk.Action.setParameters() instead
		* @param parameters {Object} parameters as JSON object
		* @param hide {Boolean} hide parameters
		*/
        setUIParameters : function (parameters, hide) {
			console.log("desk.Action.setUIParameters() is deprecated, use setParameters")
			console.log(new Error().stack);
			this.setParameters(parameters, hide);
		},
		
        /**
		* Defines UI input parameters for the action
		* @param parameters {Object} parameters as JSON object
		* @param hide {Boolean} hide/don't hide provided parameter forms
		*/
		setParameters : function ( parameters, hide ) {

			for ( let [ param, value ] of Object.entries( parameters ) )
				this.setParameter( param, value, hide );

        },

        /**
		* Defines UI input parameter
		* @param parameter {String} parameter
		* @param value {String} hide parameter in UI
		* @param hide {Boolean} hide/don't hide provided parameter forms
		*/
		setParameter : function ( parameter, value, hide ) {

			if ( parameter == "output_directory") {

				this.__outputDir = value;
				if ( this.__tabView ) this.__addOutputTab();

			}

			const form = this.getForm( parameter );
			if ( !form ) return;

			if ( form.getUserData( 'type' ) === "flag" )
				form.setValue( value === "true" || value === true );
			else
				form.setValue( value.toString() );

			if ( hide === undefined ) return;
			this.setParameterVisibility( parameter, !hide );

        },

        /**
		* Defines UI input parameter visibility
		* @param parameter {String} parameter
		* @param visible {Boolean} set to true for visible, false for invisible
		*/
		setParameterVisibility : function ( parameter, visible ) {

			const form = this.getForm( parameter );
			if ( !form ) return;
			if ( visible === undefined ) return;
			const visibility = visible ? "visible" : "excluded";
			form.setVisibility( visibility );
			form.getUserData( "label" ).setVisibility( visibility );

        },

		/**
		* (DEPRECATED) Triggers the action execution
		*/
		executeAction : function() {

			console.warn("desk.Action.executeAction() is deprecated, use execute() instead")
			console.log(new Error().stack);

			this.__manager.validate();

		},

		/**
		* Triggers the action execution
		* @param callback {Function} callback when done
		*/
		execute : function( callback ) {

			if ( !this.__manager.validate() && callback ) return callback( "Validation error" );

			this.addListenerOnce( "actionUpdated", function ( event ) {

				const res = event.getData().response;
				if ( res.error && callback ) return callback( res.error );
				if ( callback ) callback( null, res );

			}, this );

		},

		/**
		* Returns the tabview containing different UI pages
		* @return {qx.ui.tabview.TabView} the tabViex container
		*/
		getTabView : function () {

			if ( !this.__tabView ) {

				this.__tabView = new qx.ui.tabview.TabView ();
				var page = new qx.ui.tabview.Page( "Parameters" );
				page.setLayout( new qx.ui.layout.HBox() );
				page.add( this, { flex : 1 } );
				this.__tabView.add( page );
				this.addListenerOnce( "actionUpdated", this.__addOutputTab, this );

			}

			return this.__tabView;

		},

		/**
		* Constructs the tab containing the output directory file browser
		*/
		__addOutputTab : function () {
			if (this.__action.voidAction || this.__outputTab) {
				return;
			}
			var page = this.__outputTab = new qx.ui.tabview.Page("Output");
			this.__tabView.add( page );
			page.addListenerOnce('appear', function () {
				page.setLayout(new qx.ui.layout.HBox());
				this.__fileBrowser = new desk.FileBrowser( this.__outputDir );
				this.__fileBrowser.setUserData( "action" , this );
				this.__fileBrowser.setHeight(200);
				page.add( this.__fileBrowser , { flex : 1 } );

				this.addListener( "actionUpdated", this.__updateFileBrowser, this );
				this.addListener( "changeOutputDirectory", this.__updateFileBrowser , this );
			}, this);
		},

		/**
		* Constructs the tab containing the output log
		* @return {qx.ui.tabview.Page} log tab
		*/
		getLogTab : function () {
			if ( this.__logTab ) {
				return this.__logTab;
			}
			var page = this.__logTab = new qx.ui.tabview.Page("Log");
			this.__tabView.add( page );
			page.setLayout(new qx.ui.layout.HBox());
			this.__logContainer = new desk.Xterm.Logger();
			this.__logContainer.setBackgroundColor('black');
			page.add( this.__logContainer , { flex : 1 } );
			return page;
		},


		/**
		* Refreshes the file browser
		*/
		__updateFileBrowser : function () {
			this.__fileBrowser.updateRoot(this.getOutputDirectory());
		},

		__update : null,

		__forceUpdate : null,
		__forceCache : null,

		__status : null,


		/**
		* Fired whenever the execute button has been pressed
		*/
		__afterValidation : async function () {

			let response;

			try {

				response = await this.__afterValidationUnsafe();

			} catch ( error ) {

				this.__status.setValue( "Error" );
				response = { response : { error } };
				console.warn( error );

			} finally {

				this.__update.setEnabled( true );
				this.__update.setLabel( "Update" );

			}

			this.fireDataEvent( "actionUpdated", response );

		},

		/**
		* Returns the action parameters
		* @return {Object}
		*/
		getParameters : function () {

			const params = { "action" : this.__name };

			// add all parameters
			for ( let item of this.__manager.getItems() ) {

				const value = item.getValue();

				if ( ( typeof value === 'string' )  && value.length  ) {

					params[ item.getUserData( "name" ) ] = value;

				}

				if ( ( typeof value === 'boolean' ) && value ) {

					params[ item.getUserData( "name" ) ] = value;

				}

			}

			return params;

		},

		/**
		* Fired whenever the execute button has been pressed
		*/
		__afterValidationUnsafe : async function () {

			// check the validation status
			if ( !this.__manager.getValid() ) {

				alert( this.__manager.getInvalidMessages().join( "\n" ) );
				return;

			}

			// update parent Actions
			this.__update.setEnabled( false );
			this.__update.setLabel( "Parents..." );
			this.__status.setValue( "Processing..." );

			await Promise.all(
				_.uniq( this.__connections.map( conn => conn.action ) )
				.map( action => action.executeAsync() ) );


			// update parameters from connections
			for ( let connection of this.__connections ) {

				const file = connection.action.getOutputDirectory() +
					desk.FileSystem.getFileName( connection.file )

				this.setParameter( connection.parameter, file );

			}

			const params = this.getParameters();
			this.__update.setLabel( "Processing..." );

			if ( this.__outputDir && !this.__outputDir.startsWith( "cache/" ) )
				params.output_directory = this.__outputDir;

			// add the value of the "force update" checkbox
			params.force_update = this.__forceUpdate.getValue();
			params.forceCache = this.getForceCache();
			const id = this.__actionsCounter++;
			let log, started;
			const options = {};

			if ( ( this.__standalone === true ) && ( this.__action.voidAction !== true ) ) {

				const logTab = this.getLogTab();
				logTab.getButton().execute();
				log = logTab.getChildren()[0];
				log.clear();

				options.listener = function ( message ) {

					if ( message.type === "outputDirectory" ) return;
					if ( !started ) log.log( "Starting\n", "yellow" );
					started = true;
					const color = message.type == "stdout" ? "white" : "red";
					log.log( message.data, color );

				};

			}

			this.fireDataEvent( "actionTriggered", { id, params } );
			const response = await desk.Actions.executeAsync( params, options );
			this.__status.setValue( response.status +
				( response.status == "CACHED" ?
					( " (" + Math.round( response.duration / 1000 ) + "s.)" )
					: ""
					)
				);

			if ( started ) {

				log.log( "Finished\n", "yellow" );

			}

			if ( !this.__action.voidAction  &&  ( ( this.__outputDir === null ) ||
					this.__outputDir.startsWith( "cache/" ) ||
					this.__outputDir.startsWith( "actions/") ) ) {

				this.setOutputDirectory( response.outputDirectory );

			}

			return { id, response };

		},

		/**
		* Returns the form containing the desired parameter
		* @name  parameter {String} the parameter name
		* @return {qx.ui.form.TextField} the input form
		*/
		getForm : function ( name ) {

			for ( let item of this.__manager.getItems() ) {

				const parameter = item.getUserData( "parameter" );
				if ( parameter.name === name ) return item;
				if ( parameter.alias && parameter.alias === name ) return item;
				if ( parameter.aliases && parameter.aliases.includes( name ) ) return item;

			}

		},

		/**
		* Validator for int values
		* @param value {String} the parameter value
		* @param item {qx.ui.form.TextField} the parameter UI form
		* @return {Boolean} true if the aprameter is valid
		*/
        __intValidator : function(value, item) {
			if ((value == null) || (value == '')) {
				if (this.required) {
					item.setInvalidMessage('"' + this.name + '" is empty');
					return false;
				}
			} else if ((parseInt(value, 10) != parseFloat(value)) || isNaN(value)) {
				item.setInvalidMessage('"' + this.name + '" should be an integer');
				return false;
			}
			return true;
		},

		/**
		* Validator for string values
		* @param value {String} the parameter value
		* @param item {qx.ui.form.TextField} the parameter UI form
		* @return {Boolean} true if the aprameter is valid
		*/
		__stringValidator : function(value, item) {
			if ((value == null) || (value == '')) {
				if (this.required) {
					item.setInvalidMessage('"' + this.name + '" is empty');
					return false;
				}
			} else if (value.split(" ").length != 1){
				item.setInvalidMessage('"' + this.name + '" should contain no space characters');
				return false;
			}
			return true;
		},

		/**
		* Validator for floating point values
		* @param value {String} the parameter value
		* @param item {qx.ui.form.TextField} the parameter UI form
		* @return {Boolean} true if the aprameter is valid
		*/
		__floatValidator : function(value, item) {
			if ((value == null) || (value == '')) {
				if (this.required) {
					item.setInvalidMessage('"' + this.name + '" is empty');
					return false;
				}
			} else if (isNaN(value)){
				item.setInvalidMessage('"' + this.name + '" should be a number');
				return false;
			}
			return true;
		},

		/**
		* Dummy validator (always returns true)
		* @param value {String} the parameter value
		* @param item {qx.ui.form.TextField} the parameter UI form
		* @return {Boolean} true if the aprameter is valid
		*/
		__dummyValidator : function(value, item) {
            return true;
        },

		/**
		* Builds the UI
		*/
		__buildUI : function () {
			this.setLayout(new qx.ui.layout.VBox(5));

			var scroll = new qx.ui.container.Scroll();
			var container = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
			scroll.add(container, {flex : 1});
			this.add(scroll, {flex : 1});

			// create the form manager
			this.__manager = new qx.ui.form.validation.Manager();

			this.__action.parameters.forEach(function (parameter) {
				if (parameter.text || _.find(this.__connections, function (connection ) {
						return connection.parameter === parameter.name;
					})) {
					return;
				}

				var toolTip = '';
				["info", "description", "min", "max", "defaultValue"].forEach(function (field) {
					if (parameter[field]) {
						toolTip += field + ' : ' + parameter[field] + '<br>';
					}
				});

				let label;

				if ( parameter.type !== "flag" ) {
					label = new qx.ui.basic.Label(parameter.name);
					container.add(label);
				}

				var form;

				switch (parameter.type) {

				case "file":
				case "directory":
					form = new desk.FileField();
					break;
				case "flag":
					label = form = new qx.ui.form.CheckBox( parameter.name );
					break;
				default :
					form = new qx.ui.form.TextField();
				break;
				}

				form.setUserData("label", label);
				form.setUserData("parameter", parameter);
				form.setUserData("name", parameter.name);
				form.setUserData("type", parameter.type);
				if (toolTip.length) {
					form.setToolTipText(toolTip);
					label.setToolTipText(toolTip);
				}

				container.add(form);

				var validator = {
					"int" : this.__intValidator,
					"string" : this.__stringValidator,
					"float" : this.__floatValidator,
					"file" : this.__dummyValidator,
					"directory" : this.__dummyValidator,
					"xmlcontent" : this.__dummyValidator,
					"flag" : this.__dummyValidator
				} [ parameter.type ];

				if (validator) {
					this.__manager.add(form, validator, parameter);				
				} else {
					alert("no validator implemented for type : "+ parameter.type);
				}

				//use default value if provided
				if (parameter.defaultValue !== undefined)  {
					form.setValue( parameter.type === "flag" ? parameter.defaultValue
						: ( "" + parameter.defaultValue ) );
				}

				if ( parameter.type !== "flag" ) {
					form.setPlaceholder(parameter.name);
					form.addListener("input", function(e) {
						this.setInvalidMessage('');
					}, form);
				}

				form.addListener( "changeValue", () => {

					const data = {}
					data[ parameter.name ] = form.getValue();
					this.fireDataEvent( "changeParameter", data );

				} );

			}, this);

			this.__controls = new qx.ui.container.Composite();
			this.__controls.setLayout(new qx.ui.layout.HBox(5));
			this.add(this.__controls);

			this.__update = new qx.ui.form.Button("Process");
			this.__update.setWidth( 100 );
			this.__update.addListener("execute", this.__manager.validate, this.__manager);
			this.__controls.add(this.__update, {flex : 1});
			this.__controls.add( new qx.ui.core.Spacer( 1 ), { flex : 0.2 } );
			const cont = new qx.ui.container.Composite();
			cont.setWidth( 60 );
			cont.setLayout( new qx.ui.layout.VBox() );
			this.__controls.add(cont);
			this.__controls.add( new qx.ui.core.Spacer( 1 ), { flex : 0.2 } );
			this.__forceUpdate = new qx.ui.form.CheckBox("force");
			this.__forceUpdate.setToolTipText("Check to disable caching for this action");
			this.bind("forceUpdate", this.__forceUpdate, "value");
			this.__forceUpdate.bind("value", this, "forceUpdate");
			cont.add(this.__forceUpdate, {flex : 1});
			this.__forceCache = new qx.ui.form.CheckBox("cache");
			this.__forceCache.setToolTipText("Check to force caching for this action");
			this.bind("forceCache", this.__forceCache, "value");
			this.__forceCache.bind("value", this, "forceCache");
			cont.add(this.__forceCache, {flex : 1});
			this.__status = new qx.ui.form.TextField().set({readOnly: true});
			this.__controls.add(this.__status, {flex : 2});

			// add a listener to the form manager for the validation complete
			this.__manager.addListener("complete", this.__afterValidation, this);

            if (this.__standalone) {
				this.__window = new qx.ui.window.Window();
				this.__window.set({ layout : new qx.ui.layout.HBox(),
					width : 300,
					height : 500,
					showClose :true,
					showMinimize : false,
					useMoveFrame : true,
					caption : this.__name});
				this.__window.add(this.getTabView(), {flex : 1});
				this.__window.open();
                this.__window.center();
			}
        }
	}
});

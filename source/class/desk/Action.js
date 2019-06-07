/**
 * A container to launch RPC actions and edit parameters
 * @lint ignoreDeprecated (alert)
 * @ignore (async.each)
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
	construct : function (name, opt) {
		opt = opt || {};
		this.base(arguments);

		this.__action = desk.Actions.getInstance().getAction(name);
		qx.core.Assert.assert(_.isObject(this.__action), 'action "' + name +  '" not found');
		this.__name = name;

		if (opt.standalone) {
			this.__standalone = true;
		}

		this.__connections = [];
		this.__buildUI();
	},

	properties : {
		/** disable caching*/
		forceUpdate : { init : false, check: "Boolean", event : "changeForceUpdate"}
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
		"actionTriggered" : "qx.event.type.Data"
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
		connect : function (parameterName, parentAction, fileName) {
			if (parentAction !== this) {
				this.__connections.push({action : parentAction,
					parameter : parameterName, file : fileName			
				});
			}
		},

		/**
		* Defines the output directory for the action
		* @param directory {String} target directory
 		* @param loadJSON {bool} determines whether saved json 
 		* parameters file will be loaded from the output directory (default : true)
		*/
		setOutputDirectory : function (directory, loadJSON) {
			if ( directory.charAt( directory.length - 1 ) != '/' ) {
				directory += '/';
			}

			this.__outputDir = directory;

            if ((loadJSON === false) || (directory === "cache/")){
				this.fireEvent("changeOutputDirectory");
				return;
			}
			var jsonFile = this.getOutputDirectory() + 'action.json';
			desk.FileSystem.exists(jsonFile, function (err, exists) {
				if (!exists) return;
				desk.FileSystem.readFile(jsonFile,
					function(err, result) {
						if (err) {
							return;
						}
						this.setParameters(JSON.parse(result));
						if (this.__tabView) {
							this.__addOutputTab();
						}
						this.fireEvent("changeOutputDirectory");
				}, this);
			}, this);
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
		setParameters : function (parameters, hide) {
			if (typeof parameters.output_directory === "string") {
				this.__outputDir = parameters.output_directory;
				this.__addOutputTab();
			}
            Object.keys(parameters).forEach(function (key) {
                var form = this.getForm(key);
                if (!form) {
					return
				}
				form.setValue(parameters[key].toString());
				if (hide === undefined) {
					return;
				}
				var visibility = hide ? "excluded" : "visible";
				form.setVisibility(visibility);
				form.getUserData("label").setVisibility(visibility);
            }, this);
        },

		/**
		* Triggers the action execution
		*/
		executeAction : function() {
			this.__manager.validate();
		},

		/**
		* Returns the tabview containing different UI pages
		* @return {qx.ui.tabview.TabView} the tabViex container
		*/
		getTabView : function () {
			if (!this.__tabView) {
				this.__tabView = new qx.ui.tabview.TabView ();
				var page = new qx.ui.tabview.Page("Parameters");
				page.setLayout(new qx.ui.layout.HBox());
				page.add(this, {flex : 1});
				this.__tabView.add(page);
				this.addListenerOnce("actionUpdated", this.__addOutputTab, this);
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
			this.__logContainer = new desk.LogContainer();
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

		__status : null,


		/**
		* Fired whenever the execute button has been pressed
		*/
		__afterValidation : function () {
			// check the validation status
			if (!this.__manager.getValid()) {
				alert(this.__manager.getInvalidMessages().join("\n"));
				return;
			}

			var params = {"action" : this.__name};
			// add all parameters
			this.__manager.getItems().forEach(function (item) {
				var value = item.getValue();
				if ((typeof value === 'string') && value.length) {
					params[item.getUserData("name")] = value;
				}
			});

			// update parent Actions
			this.__update.setEnabled(false);
			this.__update.setLabel("Updating Parents...");

			async.each(
				_.uniq(this.__connections.map(function (connection) {
					return connection.action;
				})),
 
				function (action, callback) {
					action.addListenerOnce("actionUpdated", function (event) {
						callback();
					});
					action.executeAction();
				},

				function (err) {
					// update parameters from connections
					this.__connections.forEach(function (connection) {
						params[connection.parameter] =
							connection.action.getOutputDirectory() +
								desk.FileSystem.getFileName(connection.file);
					});

					this.__update.setLabel("Processing...");

					if (this.__outputDir) {
						params.output_directory = this.__outputDir;
						if (this.__outputDir.substring(0,6) === "cache/") {
							params.output_directory = "cache/";
						}
					}

					// add the value of the "force update" checkbox
					params.force_update = this.__forceUpdate.getValue();
					this.__status.setValue("Processing...");

					this.__executeAction(params);
				}.bind(this)
			);
		},

		/**
		* Executes the action
		* @param params {Object} action parameters
		*/
		__executeAction : function (params) {
			var id = this.__actionsCounter;
			this.__actionsCounter++;

			var logTab, log, started;

			if ( ( this.__standalone === true ) && ( this.__action.voidAction !== true ) ) {
				logTab = this.getLogTab();
				logTab.getButton().execute();
				log = logTab.getChildren()[0];
				log.clear();
				var options = {
					listener : function (message) {
						if (message.type === "outputDirectory") {
							return;
						}

						if (!started) {
							started = true;
							log.log("Starting\n", "yellow");
						}
						var color;
						switch (message.type) {
							case "stdout" : 
								color = 'white';
								break;
							case "stderr" : 
								color = 'red';
								break;
							default : return;
						}
						log.log(message.data, color);
					}
				};
			}

			desk.Actions.execute(params, options, function (err, res) {
				if (started) {
					log.log("Finished\n", "yellow");
				} else if ( log && (res.status === 'CACHED')) {
					log.log("Replaying cached output :\n", "green");
					desk.FileSystem.readFile(res.outputDirectory + "/action.log", function (err, stdout) {
						stdout.split('/n').forEach(function (line) {
							log.log(line, 'white');
						});
						desk.FileSystem.readFile(res.outputDirectory + "/action.err", function (err, stderr) {
							stderr.split('/n').forEach(function (line) {
								log.log(line, 'red');
							});
						});
						log.log("Cache replay ended\n", "green");
					});
				}
				this.__afterExecute(id, res);
			}, this);
			this.fireDataEvent("actionTriggered", {id : id, params : params});
		},

		/**
		* callback launched when the action has been performed
		* @param id {Int} the action id
		* @param res {Ojbect} action response
		*/
		__afterExecute : function (id, res) {
			this.__update.setEnabled(true);
			this.__update.setLabel("Update");
			if ( !this.__action.voidAction  &&  ( ( this.__outputDir === null ) ||
					(this.__outputDir.substring(0, 6) === "cache/") ||
					(this.__outputDir.substring(0, 8) === "actions/") ) ) {
				this.setOutputDirectory(res.outputDirectory);
			}

			this.__status.setValue(res.status);
			this.fireDataEvent("actionUpdated", {id : id, response : res});
		},

		/**
		* Returns the form containing the desired parameter
		* @param  parameter {String} the parameter name
		* @return {qx.ui.form.TextField} the input form
		*/
		getForm : function (parameter) {
			return _.find(this.__manager.getItems(), function (item) {
				return item.getUserData("name") === parameter;
			});
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
		__flagValidator : function(value, item) {
			if ((value == null) || (value == '')) {
				if (this.required) {
					item.setInvalidMessage('"' + this.name + '" is empty');
					return false;
				} else return true;
			}

			switch(value.toLowerCase()) {
				case "true": case "yes": case "1": 
				case "false": case "no": case "0": return true;
				default: 
					item.setInvalidMessage('"' + this.name + '" should be a boolean');
					return false;
			}
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
				["info", "min", "max", "defaultValue"].forEach(function (field) {
					if (parameter[field]) {
						toolTip += field + ' : ' + parameter[field] + '<br>';
					}
				});

				var label = new qx.ui.basic.Label(parameter.name);
				container.add(label);
				var form;
				switch (parameter.type) {
				case "file":
				case "directory":
					form = new desk.FileField();
					break;
				default :
					form = new qx.ui.form.TextField();
				break;
				}

				form.setUserData("label", label);
				form.setUserData("name", parameter.name);
				if (toolTip.length) {
					form.setToolTipText(toolTip);
					label.setToolTipText(toolTip);
				}
				form.setPlaceholder(parameter.name);
				container.add(form);

				var validator = {
					"int" : this.__intValidator,
					"string" : this.__stringValidator,
					"float" : this.__floatValidator,
					"file" : this.__dummyValidator,
					"directory" : this.__dummyValidator,
					"xmlcontent" : this.__dummyValidator,
					"flag" : this.__flagValidator
				}[parameter.type];

				if (validator) {
					this.__manager.add(form, validator, parameter);				
				} else {
					alert("no validator implemented for type : "+ parameter.type);
				}

				//use default value if provided
				if (parameter.defaultValue !== undefined)  {
					form.setValue('' + parameter.defaultValue);
				}

				form.addListener("input", function(e) {
					this.setInvalidMessage('');
				}, form);
			}, this);

			this.__controls = new qx.ui.container.Composite();
			this.__controls.setLayout(new qx.ui.layout.HBox(10));
			this.add(this.__controls);

			this.__update = new qx.ui.form.Button("Process");
			this.__update.addListener("execute", this.__manager.validate, this.__manager);
			this.__controls.add(this.__update, {flex : 1});

			this.__forceUpdate = new qx.ui.form.CheckBox("force");
			this.__forceUpdate.setToolTipText("Check to disable caching for this action");
			this.bind("forceUpdate", this.__forceUpdate, "value");
			this.__forceUpdate.bind("value", this, "forceUpdate");
			this.__controls.add(this.__forceUpdate, {flex : 1});

			this.__status = new qx.ui.form.TextField().set({readOnly: true});
			this.__controls.add(this.__status, {flex : 1});

			// add a listener to the form manager for the validation complete
			this.__manager.addListener("complete", this.__afterValidation, this);

            if (this.__standalone) {
				this.__window = new qx.ui.window.Window();
				this.__window.set({ layout : new qx.ui.layout.HBox(),
					width : 300,
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

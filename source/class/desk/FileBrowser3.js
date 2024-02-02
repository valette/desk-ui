/**
 * A file browser, with customizable launch options
 * 
 * @ignore (async.each)
 * @ignore (confirm)
 * @ignore (prompt)
 * @lint ignoreDeprecated (alert)
 * @lint ignoreDeprecated (confirm)
 * @asset(qx/icon/${qx.icontheme}/22/places/folder.png)
 * @asset(qx/icon/${qx.icontheme}/22/mimetypes/office-document.png)
 * @ignore (_.*)
*/

qx.Class.define("desk.FileBrowser3", 
{
	extend : qx.ui.container.Composite,
	/**
	* Creates a new file browser
	* @param baseDir {String} directory to browse. Defaults to "data"
	* @param standAlone {bool} defines whether the container should be
	* embedded in a window or not (default : false).
	*/
	construct : function(baseDir, standAlone) {
		baseDir = baseDir || "data";
		if(baseDir.substr(-1) === '/') {
			baseDir = baseDir.substr(0, baseDir.length - 1);
		}

		this.base(arguments);
		this.__fileBrowsers.push(this);

		this.setLayout(new qx.ui.layout.VBox(8));
        // this.setLayout(new qx.ui.layout.HBox(8));
		this.__standAlone = standAlone || false;
		
		this.__createToolbar();

		this.__actionCallbacks = [];
		this.__actionNames = [];

		this.__files = new qx.ui.tree.VirtualTree(null, "name", "children");
		this.__files.setIconPath("");
		this.__files.setIconOptions(this.__iconOptions);
		this.__files.set({
			draggable : true,
			droppable : true,
			showTopLevelOpenCloseIcons : true,
			selectionMode : "multi"
		});
		this.__files.addListener("open", this.__onOpen, this);

        if (this.__standAlone) {
            this.add(this.__getShortcutsContainer());
        }

        // this.__populateParentMap(this.__files, null);
        // console.log(this.__parentMap);
        var mainContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox());
        this.add(mainContainer, { flex: 1 });
        var leftContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox());
        // mainContainer.add(this.__createSortToolbar());
        leftContainer.add(this.__files, { flex : 1});
        
        var rightContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox());
        this.__tree = new qx.ui.tree.Tree().set({
            width: 200,
            height: 500,
        })
        this.__createTree();
        
        rightContainer.add(this.__createSortToolbar());
        rightContainer.add(this.__tree, { flex : 1});
        mainContainer.add(leftContainer, { flex: 1});
        mainContainer.add(rightContainer, { flex: 3});
        // mainContainer.add(this.__files, { flex: 4});
        // mainContainer.add(this.__getExpandedContainer(), { flex: 1});
// 		this.add(this.__files, {flex: 1});
		this.__createFilter();

		// add root directory
		this.updateRoot(baseDir);

		this.setFileHandler(this.__defaultFileHandler);
		desk.Actions.init(this.__createDefaultStaticActions, this);

		this.__files.addListener("dbltap", this.__onDbltap, this);
		this.__files.addListener("dragstart", this.__onDragstart, this);
		this.__files.addListener("dragend", this.__onDragEnd, this);
		this.__files.addListener("droprequest", this.__onDropRequest, this);
		this.__files.addListener('drop', this.__onDrop, this);

		// this code is for backwards compatibility, may be removed later
// 		this.__files.getSelection().addListener("change", function (e) {
// // 			this.__files.fireDataEvent("changeSelection", this.__files.getSelection());
//             console.log(this.__files.getSelection());
// 		}, this);

        this.__files.getSelection().addListener("change", this.__changeSelection, this);

        // this.__setDelegateTreeColumns(this.__files);
        // this.__setDelegateTreeColumns();

		if (this.__standAlone) {
			var win = this.__window = new qx.ui.window.Window();
			win.set({ShowMinimize : false,
				layout : new qx.ui.layout.VBox(),
				caption : this.__baseDir,
				width : 800,
				height : 600
			});
			win.add(this, {flex : 1});
			win.addListener('close', function () {
				this.destroy();
				win.destroy();
			}, this);
			win.open();
		}
	},

	destruct : function() {

		desk.Actions.getInstance().removeListenerById( this.__actionListener );
		if ( this.__standAlone ) this.__window.destroy();
		this.__files.dispose();

		qx.util.DisposeUtil.destroyContainer(this);
		for (var i = 0; i < this.__fileBrowsers.length; i++) {
			if (this.__fileBrowsers[i] === this) {
				this.__fileBrowsers.splice(i, 1);
				return;
			}
		}
	},

	members : {
		__displayHiddenFiles : false,
		__actionListener: null, // listens for action updates;

		__iconOptions : {
			converter : function(value, model) {
				if (model.getChildren) {
					return "icon/22/places/folder.png";
				} else {
					var image = "icon/22/mimetypes/office-document.png";
					switch (desk.FileSystem.getFileExtension(model.getName())) {
					case "vtk":
					case "ply":
					case "obj":
					case "stl":
						image = "desk/tris.png";
						break;
					case "gz" :
						if ( model.getName().split( "." ).slice( -2 ).join( "." ) !== "nii.gz" ) break;
					case "mhd":
					case "jpg":
					case "png":
					case "hdr":
					case "tif":
					case "nii":
						image = "desk/img.png";
						break;
					default:
						break;
					}
					return image;
				}
			}
		},

		/** 
		* Creates the filter container
		*/
		__createFilter : function () {
		    var self = this;
			// create the filter bar
			var filterBox = new qx.ui.container.Composite();
			filterBox.setLayout(new qx.ui.layout.HBox(10));
			var filterText = new qx.ui.basic.Label("Filter files :");
			filterBox.add(filterText);
			var filterField = new qx.ui.form.TextField();
			filterField.setValue("");
			filterField.addListener("input", this.__files.refresh, this.__files);
			filterBox.add(filterField, {flex:1});
			this.__filterField = filterField;

			var resetButton = new qx.ui.form.Button("Reset filter");
			resetButton.setAllowGrowY(false);
			resetButton.addListener("execute",function(e){
				filterField.setValue("");
				this.__files.refresh();
			}, this);

			filterBox.add(resetButton);
			this.__files.setDelegate({
				filter : function (node) {
					var name = node.getName().toLowerCase();
					if (!this.__displayHiddenFiles &&  name.indexOf(".") === 0) {
						return false;
					}
					return node.getChildren || name.indexOf(filterField.getValue().toLowerCase()) != -1;
				}.bind(this)
			});

			if(this.__standAlone) {
				this.add(filterBox);
			}
		},

		/** 
		* Fired whenever a file is double-clicked
		* @param e {qx.event.type.Event}
		*/
		__onDbltap :  function (e) {
			var node = e.getTarget();
			if (node && node.getModel && e.isLeftPressed() && !e.isCtrlOrCommandPressed()) {
				if (!node.getModel().getChildren && this.__fileHandler) {
					this.__fileHandler(node.getModel().getFullName());
				}
			}
		},

		/** 
		* Fired whenever a directory is opened
		* @param e {qx.event.type.Event}
		*/
		__onOpen : function (e) {
			var node = e.getData();
			this.__expandDirectoryListing(node);
		},

		/** 
		* Fired whenever a directory is closed
		* @param e {qx.event.type.Event}
		*/
		__onClose : function (e) {
			var node = e.getData();
			node.getChildren().removeAll();
			node.getChildren().push(
				qx.data.marshal.Json.createModel({name: "Loading", loading : false})
			);
			this.__files.refresh();
		},

		/** 
		* Fired whenever a file drag starts
		* @param e {qx.event.type.Drag}
		*/
		__onDragstart : function(e) {
			e.addAction("move");
			e.addType("fileBrowser");
			e.addType("file");
			var selection = this.getSelectedFiles();
			var dragged = e.getDragTarget().getModel().getFullName();
			if (_.indexOf(selection, dragged) < 0) {
				selection = [dragged];
			}
			this.__draggedNodes = selection;
		},

		/** 
		* Fired whenever a file drag ends
		* @param e {qx.event.type.Drag}
		*/
		__onDragEnd : function(e) {
			this.__draggedNodes = null;
		},

		/** 
		* Fired at each drop request
		* @param e {qx.event.type.Drop}
		*/
		__onDropRequest : function(e) {
			var type = e.getCurrentType();
			switch (type) {
			case "file":
				e.addData(type, e.getDragTarget().getModel().getFullName());
				break;
			case "fileBrowser":
				e.addData(type, this);
				break;
			default :
				break;
			}
		},

		/** 
		* Fired at each drop
		* @param e {qx.event.type.Drop}
		*/
		__onDrop : function (e) {
			if (!e.supportsType('fileBrowser')) {
				return;
			}

			var browser = e.getData('fileBrowser');
			if (browser === this) {
				return;
			}
			var source = e.getDragTarget().getModel().getFullName();
			var selection = browser.__files.getSelection().toArray()
				.map(function(node) {return node.getFullName()});
			var files;
			if (_.indexOf(selection, source) >= 0) {
				files = selection;
			} else {
				files = [source];
			}
			
			var target = e.getOriginalTarget().getModel();
			var destination = target.getFullName();
			if (!target.getChildren) {
				destination = desk.FileSystem.getFileDirectory(destination);
			}
			var actionType = prompt('Copy or move? \n0 : copy,  1 : move', '0');
			actionType = actionType === '1' ? 'move' : 'copy'

			if (!confirm ('Are you sure you want to ' + actionType + ' move these files:\n' +
					files.join('\n') + ' to :\n' + destination)) return;

			async.each(files, function (file, callback) {
				desk.Actions.execute({
						action : actionType,
						source : file,
						destination : destination,
						recursive : true
					},
						callback);
				}, function (err) {
					var directories = files.map(function (file) {
						return desk.FileSystem.getFileDirectory(file);
					});
					directories.push(destination);
					this.__updateDirectories(directories);
			}.bind(this));
		},

		// array to store all file browsers, usefull for updates
		__fileBrowsers : [],

		// defines whether the file browser is a standalone one
		// i.e. whether it needs to create a window
		__standAlone : false,

		// the window containing the widget when in standalone mode
		__window : null,
		__fileHandler : null,
		__baseDir : null,
		__root : null,
		__files : null,
		__rootId : null,
		__filterField : null,
		__actionButton : null,

		__actionNames : null,
		__actionCallbacks : null,

		/** 
		* Creates the top shortcuts
		* @return {qx.ui.container.Composite}
		*/
		__getShortcutsContainer : function() {
			const all = new qx.ui.container.Composite();
			all.setLayout( new qx.ui.layout.HBox( 5 ) );
			const container = new qx.ui.container.SlideBar( "horizontal" );

			container.addListener( "mousewheel", e => {
				container.scrollBy( e.getWheelDelta() * 10 );
			} );

			container.setScrollStep( 50 );
			var settings = desk.Actions.getInstance().getSettings();
			var dataDirs = settings.dataDirs;
			var permissions = settings.permissions;
			var dirs = Object.keys(dataDirs);
			dirs.sort(this.__caseInsensitiveSort);
			var hiddenDirs = [];
			container.add( new qx.ui.core.Spacer( 5 ) );

			dirs.forEach( dir => {

				const settings = dataDirs[ dir ];
				if ( ( settings.listed != undefined ) && !settings.listed )
					return;

				if ((dir === "cache") || (dir === "application") ||
					((permissions === 0) && (dir ==="actions")) ||
					dataDirs[dir].hidden) {
					hiddenDirs.push(dir);
					return;
				}

				var button = new qx.ui.form.Button(dir);
				button.addListener("click", function ( e ) {
					if ( e.isMiddlePressed() ) {
						var browser = new desk.FileBrowser(dir, true);
						browser.getWindow().center();
					} else {
						this.updateRoot(dir);
					}
				}, this);
				button.setAllowShrinkX( false );
				container.add(button, { flex : 1 });
				container.add( new qx.ui.core.Spacer( 5 ) );
				var menu = new qx.ui.menu.Menu();
				var openButton = new qx.ui.menu.Button('open in new window');
				openButton.addListener('execute', function () {
					var browser = new desk.FileBrowser(dir, true);
					browser.getWindow().center();
				});
				menu.add(openButton);
				button.setContextMenu(menu);
			} );

			var menu = new qx.ui.menu.Menu();
			var button = new qx.ui.form.MenuButton( '...', null, menu);
			all.add( container, { flex : 1 } );
			all.add(button);
			
            // console.log(hiddenDirs);
            
			hiddenDirs.forEach(function (dir) {
				var button = new qx.ui.menu.Button(dir);
				button.addListener("click", function ( e ) {
					if ( e.isMiddlePressed() ) {
						var browser = new desk.FileBrowser(dir, true);
						browser.getWindow().center();
					} else {
						this.updateRoot(dir);
					}
				}, this);
				menu.add(button, {flex : 1});
				var menu2 = new qx.ui.menu.Menu();
				var openButton = new qx.ui.menu.Button('open in new window');
				openButton.addListener('execute', function (e) {
					var browser = new desk.FileBrowser(dir, true);
					browser.getWindow().center();
				});
				menu2.add(openButton);
				button.setContextMenu(menu2);
			}, this);

			return all;
		},

		/** Returns the window containing the container in standalone mode
		* @return {qx.ui.window.Window} the file browser window
		*/
		getWindow : function() {
			return this.__window;
		},

		/**
		* Returns the field used to filter files
		* @return {qx.ui.form.TextField} the filter field
		*/
		getFileFilter : function() {
			return this.__filterField;
		},
		
		/**
		* returns the directory for the given file, session type and Id
		* @param file {String} file
		* @param sessionType {String} type of session
		* @param sessionId {Int} Id for the session
		* @return {String} session directory
		*/
		getSessionDirectory : function (file,sessionType,sessionId) {
			return file + "." + sessionType + "."+sessionId;
		},

		/**
		* Updates/changes the root
		* @param newRoot {String} new root
		*/
		updateRoot : function (newRoot) {
			this.__baseDir = newRoot || this.__baseDir;

			this.__root = qx.data.marshal.Json.createModel({
				name: this.__baseDir,
				fullName : this.__baseDir,
				children: [],
				icon: "default",
				loading: false
			}, true);

			if (this.__window) {
				this.__window.setCaption(newRoot);
			}
			this.__root.getChildren().push(
				qx.data.marshal.Json.createModel({name: "Loading", loading : false})
			);
			
			this.__files.setModel(this.__root);
// 			console.log(this.__root);
// 			this.__treeController.setModel(this.__root);
// 			this.__tree.getRoot().setOpen(true);
		},

		/**
		* Handles file double-click
		* @param file {String} file to handle
		*/
		__defaultFileHandler : function (file) {
			var extension = desk.FileSystem.getFileExtension(file);
			switch (extension)
			{
			case 'js':
				if (desk.Actions.getInstance().getSettings().permissions) {
					desk.FileSystem.executeScript(file);
				} else {
					desk.Ace.TabbedEditor.open(file);
				}
				break;
			case 'log':
			case 'txt':
			case 'cpp':
			case 'cxx':
			case 'h':
			case 'py':
				desk.Ace.TabbedEditor.open(file);
				break;
			case "vtk":
			case "ply":
			case "obj":
			case "stl":
			case "ctm":
			case "off":
				new desk.THREE.Viewer(file);
				break;
			case "xml":
				desk.FileSystem.readFile(file, function (error, xmlDoc) {
					xmlDoc = (new DOMParser()).parseFromString(xmlDoc, "text/xml")
					if (xmlDoc.getElementsByTagName("mesh").length !== 0) {
						new desk.THREE.Viewer(file);
					} else {
						alert ('xml file of unknown type!');
					}
				});
				break;
			case "gz" :
				if ( file.split( "." ).slice( -2 ).join( "." ) !== "nii.gz" ) break;
			case "png":
			case "jpg":
			case "bmp":
			case "mhd":
			case "nii":
			case "hdr":
			case "tif":
				new desk.MPR.Viewer(file);
				break;
			case "vol": 
				if (desk.Actions.getInstance().getAction("vol_slice") != null) {
					new desk.MPR.Viewer(file);
				} else {
					console.log("vol_slice action does not exist. Skipping this filetype handler.")
				}
				break;
			case "json":
				desk.Action.CREATEFROMFILE(file);
				break;
			default:
				alert("no file handler exists for extension "+extension);
				break;
			}				
		},

		/**
		* Launches Out-of-core volume visualization
		* @param node {Object} file node
		*/
		__OOCViewAction : function (node) {
			if (!node.getChildren) {
				new desk.MPR.Viewer(node.getFullName(), {
					ooc : true,
					format : 0,
					nbOrientations : 1
					});
			} else {
				alert("Cannot view a directory!");
			}
		},

		/**
		* Launches the file download
		* @param node {Object} file node
		*/
		__downloadAction : function (node) {
			if (!node.getChildren) {
				desk.FileSystem.downloadFile( node.getFullName() );
            } else {
				alert("Cannot download a directory!");
			}
		},

		/**
		* Launches an uploader 
		* @param node {Object} file node
		*/
		__uploadAction : function (node) {
			node = node || this.__root;
			var dir = node.getFullName();
			if (!node.getChildren) {
				dir = desk.FileSystem.getFileDirectory(dir);
				node = this.__getFileNode(dir);
			}
			var uploader = new desk.Uploader(dir);
			uploader.addListener("upload",
				_.throttle(function () {
					this.__expandDirectoryListing(node);
				}.bind(this), 2000)
			);
		},

		/**
		* Creates a directory
		* @param node {Object} file node
		*/
		__newDirectoryAction : function (node) {
			var dir = node.getFullName();
			if (!node.getChildren) {
				dir = desk.FileSystem.getFileDirectory(dir);
			}
			var newDir = prompt('Name of the directory to create','new_dir');
			if (!newDir) return;
			desk.Actions.execute({
				"action" : "create_directory",
				"directory" : dir + '/' + newDir},
				function () {
					this.updateDirectory(dir);
			}, this);
		},

		/**
		* Deletes a file/directory
		* @param node {Object} file node
		*/
		__deleteAction : function (node) {
			var nodes = this.__files.getSelection().toArray();
			var message = 'Are you shure you want to delete those files/directories? \n';
			var dirs = nodes.map(function (node) {
				var file = node.getFullName();
				message +=  file + '\n';
				return desk.FileSystem.getFileDirectory(file);
			}, this);
			if (!confirm(message)) return;

			async.each(nodes, function (node, callback) {
				desk.Actions.execute({
					action : node.getChildren ? 'delete_directory' : 'delete_file',
					file_name : node.getFullName(),
					directory : node.getFullName()},
					callback
				);
			}, function (err) {
				this.__updateDirectories(dirs);
			}.bind(this));
		},

		/**
		* Renames file/directory
		* @param node {Object} file node
		*/
		__renameAction : function (node) {
			var file = node.getFullName();
			var newFile = prompt('enter new file name : ', desk.FileSystem.getFileName(file));
			if (newFile === null) {
				return;
			}
			var dir = desk.FileSystem.getFileDirectory(file);
			desk.Actions.execute({
					action : "move",
					source : file,
					destination : dir + newFile
				},
				function () {
					this.updateDirectory(dir);
			}, this);
		},

		/**
		* Creates a new file
		* @param node {Object} file node
		*/
		__newFileAction : function (node) {
			var dir = node.getFullName();
			if (!node.getChildren) {
				dir = desk.FileSystem.getFileDirectory(dir);
			}
			var baseName = prompt('enter new file name : ', "newFile");
			if (baseName !== null) {
				desk.FileSystem.writeFile(dir + '/' + baseName, '',
				function () {
					this.updateDirectory(dir);
				}.bind(this));
			}
		},

		/**
		* Launches the text editor on the file
		* @param node {Object} file node
		*/
		__viewEditAction : function (node) {
			if (!node.getChildren) {
				desk.Ace.TabbedEditor.open(node.getFullName());;
			}
		},

		/**
		* Creates he default menu
		*/
		__createDefaultStaticActions : function () {
			var menu = new qx.ui.menu.Menu();

			var hideButton = new qx.ui.menu.CheckBox("Show hidden files");
			hideButton.setBlockToolTip(false);
			hideButton.setToolTipText("Enable this to see hidden files");
			hideButton.addListener("changeValue", function (event) {
				this.__displayHiddenFiles = event.getData();
				this.__files.refresh();
			}, this);
			menu.add(hideButton);

			// the default "open" button
			var openButton = new qx.ui.menu.Button("Open");
			openButton.addListener("execute", this.__onDbltap, this);

			menu.addSeparator();
			menu.add(openButton);
			menu.addSeparator();

			this.__actionButton = new qx.ui.menu.Button("Actions");
			menu.add(this.__actionButton);
			menu.addSeparator();

			this.__files.setContextMenu(menu);
			qx.util.DisposeUtil.disposeTriggeredBy(menu, this);

			this.__actionListener = desk.Actions.getInstance().addListener( 'update', this.__updateActions, this);
			this.__updateActions();

			if (desk.Actions.getInstance().getSettings().permissions < 1) {
				return;
			}

			this.addAction("OOC Volume viewer", this.__OOCViewAction, this);
			this.addAction("download", this.__downloadAction, this);
			this.addAction("upload", this.__uploadAction, this);
			this.addAction("view/edit text", this.__viewEditAction, this);
			this.addAction("new directory", this.__newDirectoryAction, this);
			this.addAction("delete", this.__deleteAction, this);
			this.addAction('rename', this.__renameAction, this);
			this.addAction('new file', this.__newFileAction, this);
			this.addAction('properties', function (node) {
			 //   console.log(node);
				alert(node.getName() + " : " + node.getSize() + " bytes");
			});
		},

		/**
		* updates action list
		*/
		__updateActions : function () {
			this.__files.addListenerOnce( "contextmenu", function (e) {
				const actionMenu = new qx.ui.menu.Menu();
				this.__actionButton.setMenu( actionMenu );
				const actions = desk.Actions.getInstance().getSettings().actions;
				const libs = {};

				for ( let [ name, action ] of Object.entries(actions) ) {
					if ( !libs[ action.lib ] ) libs[ action.lib ] = [];
					libs[ action.lib ].push( name );
				}

				for ( let lib of Object.keys( libs ).sort( this.__caseInsensitiveSort ) ) {
					const menu = new qx.ui.menu.Menu();
					const menubutton = new qx.ui.menu.Button( lib, null, null, menu );
					for ( let name of libs[ lib ].sort( this.__caseInsensitiveSort ) ) {
						if ( actions[ name ].alias == name ) continue;
						const button = new qx.ui.menu.Button( name );
						const description = actions[ name ].description;
						if ( description ) {
							button.setBlockToolTip( false );
							button.setToolTipText( description );
						}
						button.addListener( "execute", this.__launch, this );
						menu.add( button );
					}
					actionMenu.add( menubutton );
				}
			}, this);
		},

		/**
		* fired when an action is launched via the action menu
		* @param e {qx.event.type.Event} button event
		*/
		__launch : function (e) {
			var name = e.getTarget().getLabel();
			var action = new desk.Action(name, {standalone : true});
			_.some(desk.Actions.getInstance().getSettings().actions[name].parameters, function (param) {
				if ((param.type !== "file") && (param.type !== "directory")) {
					return false;
				}
				var parameters = {};
				parameters[param.name] = this.getSelectedFiles()[0];
				action.setParameters(parameters);
				return true;
			}.bind(this));
			action.setOutputDirectory("actions/");
		},

		/**
		* Adds a new action in context menu
		* @param actionName {String} : label for the action
		* @param callback {Function} : callback for the action
		* @param context {Object} : optional context for the callback
		*/
		addAction : function (actionName, callback, context) {
			if (this.__actionNames.indexOf(actionName) == -1) {
				this.__actionNames.push(actionName);
			} else {
				console.log ('Warning : action "' + actionName + '" already exists, is overwritten!');
			}

			this.__actionCallbacks[actionName] = callback;

			var button = new qx.ui.menu.Button(actionName);
			button.setUserData("fileBrowser", this);
			button.setUserData("actionName", actionName);
			button.addListener("execute", function (e) {
				var fileBrowser = button.getUserData("fileBrowser");
				var actionName = button.getUserData("actionName");
				var node = fileBrowser.__files.getSelection().getItem(0);
				fileBrowser.__actionCallbacks[actionName].call(context, node);
			}, this);
			this.__files.getContextMenu().add(button);
		},

		/**
		* Changes the callback when a double click is performed
		* @param callback {Function} callback when a file is double clicked
		*/
		setFileHandler : function (callback) {
			this.__fileHandler = callback;
		},

		/**
		* Returns the qx.ui.treevirtual.TreeVirtual underneath
		* @return {qx.ui.treevirtual.TreeVirtual} the virtual tree
		*/
		getTree : function () {
			return this.__files;
		},

		__draggedNodes : null,
	
		/**
		* Returns an array containing currently selected files
		* @return {Array} array of files (strings)
		*/
		getSelectedFiles : function () {
			return this.__draggedNodes || this.__files.getSelection()
				.toArray().map(function(node) {
					return node.getFullName()
				});
		},

		/**
		* Returns the base directory
		* @return {String} base directory
		*/
		getRootDir : function () {
			var baseDir = this.__baseDir + '/';
			if (baseDir.charAt(baseDir.length - 1) === '/') {
				baseDir = baseDir.substring(0, baseDir.length -1);
			}
			return baseDir;
		},

		/**
		* Returns node matching the file string, null if it does not exist
		* @param file {String} the file
		* @return {Object} the file node
		*/
		__getFileNode : function (file) {
			var baseDir = this.getRootDir();
			if (file.indexOf(baseDir) !== 0) {
				return null;
			}
			var inFile = file.substring(baseDir.length + 1);
			var hierarchy = inFile.length ? inFile.split('/') : [""];
			if (hierarchy[hierarchy.length - 1].length === 0) {
				hierarchy.pop();
			}
			var node = this.__root;
			for (var i = 0; i < hierarchy.length; i++) {
				if (!_.find(node.getChildren().toArray(), function (child) {
					if (child.getName() === hierarchy[i]) {
						node = child;
						return true;
					}
					return false;
				})) {
					return null;
				}
			}
			return node;
		},

		/**
		* Updates a directory
		* @param file {String} directory to update
		*/
		updateDirectory : function (file) {
			this.__fileBrowsers.forEach(function (browser) {
				var nodeId = browser.__getFileNode(file);
				if (nodeId) {
					browser.__expandDirectoryListing(nodeId);
				}
			});
		},

		/**
		* Updates directories for all matching file browsers
		* @param files {Array} array of directories/files
		*/
		__updateDirectories : function (files) {
			_.uniq(files).forEach(this.updateDirectory, this);
		},

		/**
		* sorting function to
		* @param a {String} first element to compare
		* @param b {String} second element to compare
		* @return {Boolean} returns true if a < b
		*/
		__caseInsensitiveSort : function (a, b) {
			return a.toLowerCase().localeCompare(b.toLowerCase());
		},

		/**
		* sorting function to
		* @param a {String} first element to compare
		* @param b {String} second element to compare
		* @return {Boolean} returns true if a < b
		*/
		__caseInsensitiveSort2 : function (a, b) {
			return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
		},

		/**
		* populates directory node with contained files
		* @param node {Object} directory node to populate
		*/
		__expandDirectoryListing : function(node) {
			var directory = node.getFullName();
			var children = node.getChildren();
			desk.FileSystem.readDir(directory, function (err, files) {
				children.removeAll();
				files.sort(this.__caseInsensitiveSort2)
				files.forEach(function (file) {
					file.fullName = directory + "/" + file.name;
					if (file.isDirectory) {
						file.children = [];
						file.loading = false;
						var model = qx.data.marshal.Json.createModel(file);
						children.push(model);
						model.getChildren().push(
							qx.data.marshal.Json.createModel({name: "Loading", loading : false})
						);
					}
				});
				files.forEach(function (file) {
					if (!file.isDirectory) {
						file.loading = false;
						children.push(qx.data.marshal.Json.createModel(file));
					}
				});
				this.__files.refresh();
			}, this);
		},
		
		__parentMap : new Map(),
		__pathPart : new qx.ui.toolbar.Part(),
		__tableModel : new qx.ui.table.model.Simple(),
		__sortCriterion : "name",
		__sortDescending : "false",
		__tree : new qx.ui.tree.Tree(),
		__treeController : new qx.data.controller.Tree(),
		__currDir : null,
		
		__createToolbar : function() {
		    // Toolbar for navigation buttons and search
            var toolbar = new qx.ui.toolbar.ToolBar();
            this.add(toolbar);
        
            // Create navigation buttons (prev and next)
            var prevButton = new qx.ui.toolbar.Button("<");
            var nextButton = new qx.ui.toolbar.Button(">");
            toolbar.add(prevButton);
            toolbar.add(nextButton);
            
            // Create a toolbar part for the folder path
            this.__pathPart = new qx.ui.toolbar.Part();
            toolbar.add(this.__pathPart);
		},
		
		__populateParentMap : function(node, parent) {
		    var self = this;
		    this.__parentMap.set(node, parent);
		    if (typeof node.getChildren === "function") {
		        let children = node.get("children");
		        if (children) {
		            children.toArray().forEach(function(child) {
		                self.__populateParentMap(child, node);
		            }, this);
		        }
		    }
		},
		
		__updateFolderPath : function(folder) {
		    this.__pathPart.removeAll();
		    
		    var self = this;
		    let path = [];
		  //  console.log(folder);
		  //  console.log(this.__parentMap);
		  //  this.__populateParentMap(self.__files, null);
		  //  console.log(this.__parentMap);
		    while(folder) {
		        path.unshift(folder.get("name"));
		        folder = self.__parentMap.get(folder);
		    }
		    
		  //  console.log(path);
		    
		    path.forEach(function(part, index) {
		        let button = new qx.ui.toolbar.Button(part);
		        self.__pathPart.add(button);
		        
		        button.addListener("execute", function() {
		            let selectedFolder;
		            for (let [key, _] of this.__parentMap.entries()) {
		                if (ket.getName() === part) {
		                    selectedFolder = key;
		                }
		            }
		            self.__files.setSelection([selectedFolder]);
		        });
		        
                if (index < path.length - 1) {
                    pathPart.add(new qx.ui.toolbar.Separator());
                }
		    });
		},
		
		__changeSelection : function(e) {
		    let selectedFolder = this.__files.getSelection().getItem(0);
		  //  console.log(selectedFolder.getChildren().toArray());
		    if (selectedFolder && selectedFolder.getChildren) {
		        // For instance, because of the constraint of time, this code allows us to show the detail of the
		        // folder in the Gallery form but in another window. Need some changes and add a button to alternate
		        // between 2 types of view
		        new desk.WidgetGallery(selectedFolder.getName(), selectedFolder);
		        
                var model = qx.data.marshal.Json.createModel(selectedFolder);
		        this.__treeController.setModel(model);
		        this.__tree.getRoot().setOpen(true);
		        this.__tree.setHideRoot(true);
		    }
		  //  if (typeof selectedFolder.getChildren === "function") {
		  //      let files = selectedFolder.getChildren().toArray();
		        
		  //      let rowData = files.map((file) => {
		  //        //  console.log(file);
		  //        if (file.getSize) {
		  //          var date = new Date(file.getMtime());
		            
    //                 // Extract the day, month, and year components
    //                 let day = date.getDate();
    //                 let month = date.getMonth() + 1; // Months are zero-based, so add 1
    //                 let year = date.getFullYear();
                
    //                 // Pad single-digit day and month with leading zeros
    //                 day = day < 10 ? '0' + day : day;
    //                 month = month < 10 ? '0' + month : month;
                
    //                 // Format the date as dd/mm/yyyy
    //                 var formattedDate =  day + '/' + month + '/' + year;
                    
		  //          return [file.getName(), formattedDate, file.getSize() + " KB"];
		  //        }
		  //        return [file.getName()];
		  //      });
		        
		  //      this.__tableModel.setData(rowData);
		  //  }
		    
		    this.__updateFolderPath(selectedFolder);
		},
		
		__getExpandedContainer : function() {
		    const all = new qx.ui.container.Composite(new qx.ui.layout.VBox());
		    this.__tableModel.setColumns(["Name", "Date", "Size"]);
		    
		    //Sort
            this.__tableModel.setSortMethods(1, function(row1, row2) {
                let date1 = new Date(row1[1]);
                let date2 = new Date(row2[1]);
                return date1.getTime() - date2.getTime();
            });
		    
		    this.__tableModel.setSortMethods(2, function(row1, row2) {
		        let size1 = parseInt(row1[2].split(" ")[0]);
		        let size2 = parseInt(row2[2].split(" ")[0]);
		        return size1 - size2;
		    })
		    
		    let table = new qx.ui.table.Table(this.__tableModel);
		    table.set({
                columnVisibilityButtonVisible: false,
                statusBarVisible: false
            });
            
            // table.addListener("cellTap", function(e) {
            //     let rowIndex = e.getRow();
            //     let rowData = table.getTableModel().getRowData(rowIndex);
            //     table.getSelectionModel().setSelectionInterval(rowIndex, rowIndex);
            // });
            
            // table.getTableColumnModel().setDataCellRenderer(0, new desk.IconTextCellRenderer());
            
            table.setColumnWidth(0, 200);
            table.setColumnWidth(1, 100);
            table.setColumnWidth(2, 100);
            
            
            all.add(table, {flex: 1});
            
		    return all
		},
		
		__setDelegateTreeColumns : function() {
		    this.__files.setDelegate({
			    bindItem : function(controller, item, id) {
			        controller.bindDefaultProperties(item, id);
			        controller.bindProperty("name", "label", null, item, id);
			        controller.bindProperty("size", "size", null, item, id);
			    },
			    
			    configureItem : function(item) {
			        if (item.getUserData("timeoutId")) {
			            clearTimeout(item.getUserData("timeoutId"));
			        }
			        
			        var timeoutId = setTimeout(() => {
			         //   if (item.getSize() === null) {
        			     //   console.log(item.getIcon());
        			        var name = item.getLabel();
        			        var size = item.getSize();
                		    //Name
                		    item.addLabel(name);
                		    item.addWidget(new qx.ui.core.Spacer(), { flex: 1 });
                		            
                //             // Date
                //             let dateLabel;
                //             if(typeof model.getMtime === "function") {
                //     		    var date = new Date(model.getMtime());
                //                 // Extract the day, month, and year components
                //                 let day = date.getDate();
                //                 let month = date.getMonth() + 1; // Months are zero-based, so add 1
                //                 let year = date.getFullYear();
                            
                //                 // Pad single-digit day and month with leading zeros
                //                 day = day < 10 ? '0' + day : day;
                //                 month = month < 10 ? '0' + month : month;
                                
                //                 // Format the date as dd/mm/yyyy
                //                 var formattedDate =  day + '/' + month + '/' + year;
                //                 dateLabel = new qx.ui.basic.Label(formattedDate);
                //                 dateLabel.setWidth(150);
                //                 // item.addWidget(text);
                //             } else {
                //                 dateLabel = new qx.ui.basic.Label("");
                //                 dateLabel.setWidth(150);
                //                 // item.addWidget(text);
                //             }
                                
                //             //Size
                //             let sizeLabel;
                //             if(model.getSize) {
                //                 sizeLabel = new qx.ui.basic.Label(model.getSize() + " kb");
                //                 sizeLabel.setWidth(100);
                //                 // item.addWidget(text);
                //             } else {
                //                 sizeLabel = new qx.ui.basic.Label("");
                //                 sizeLabel.setWidth(100);
                //                 // item.addWidget(text);
                //             }
                            
                            sizeLabel = new qx.ui.basic.Label(size + " kb");
                            sizeLabel.setWidth(100);
                //             item.addWidget(dateLabel);
                            item.addWidget(sizeLabel);
			             //   self.__files.refresh();
			         //   }
			            
			        }, 200);
			        
			        item.setUserData("timeoutId", timeoutId);
		        },
		        
		      //  sorter: function(a, b) {
		      //      var propA = a.get(this.__sortCriterion).toLowerCase();
		      //      var propB = b.get(this.__sortCriterion).toLowerCase();
		            
		      //      var result = this.__sortDescending ? propA.localeCompare(propB) : propB.localeCompare(propA);
		            
		      //      return result;
		      //  },
		      
		        createItem : function() {
		            return new desk.CustomTreeItem();
		        },
		    })
		},
		
		__createSortToolbar : function () {
		    var self = this;
		    var toolbar = new qx.ui.toolbar.ToolBar();
		  //  var model = this.__files.getModel();
		    
		    var nameButton =  new qx.ui.toolbar.Button("Sort by Name");
		    nameButton.addListener("execute", function() {
		        var model = this.__treeController.getModel();
		        this.__sortCriterion = "name";
		        this.__sortDescending = !(this.__sortDescending);
		        console.log(model.getChildren().sort(this.__sort));
		        this.__treeController.setModel(null);
		        this.__treeController.setModel(model);
		        this.__tree.getRoot().setOpen(true);

		    }, this);
		    toolbar.add(nameButton, { flex : 1});
		    
		    var dateButton =  new qx.ui.toolbar.Button("Sort by Date");
		    toolbar.add(dateButton, { flex : 1});
		    
		    var sizeButton =  new qx.ui.toolbar.Button("Sort by Size");
		    toolbar.add(sizeButton, { flex : 1});
		    
		    return toolbar;
		    
		},
		
		__createTree : function() {
		    this.__treeController = new qx.data.controller.Tree(
		        null,
		        this.__tree,
		        "children",
		        "name",
		    );
		    
		    this.__treeController.setDelegate({
			    configureItem : function (item) {
			        setTimeout(() => {
			            if (item.getLabel() !== "Loading") {
			                var model = item.getModel();

			                // Icon
			                let iconLabel;
			                if(model.getChildren) {
			                    iconLabel = "icon/22/places/folder.png";
			                } else {
			                    iconLabel = "icon/22/mimetypes/office-document.png";
			                }
			                item.setIcon(iconLabel);
			                
			                // Name
			                var nameLabel = item.getLabel();
			                item.addLabel(nameLabel);
                		    item.addWidget(new qx.ui.core.Spacer(), { flex: 1 });
                		    
                		    // Date
                            let dateLabel;
                            if(typeof model.getMtime === "function") {
                    		    var date = new Date(model.getMtime());
                                // Extract the day, month, and year components
                                let day = date.getDate();
                                let month = date.getMonth() + 1; // Months are zero-based, so add 1
                                let year = date.getFullYear();
                            
                                // Pad single-digit day and month with leading zeros
                                day = day < 10 ? '0' + day : day;
                                month = month < 10 ? '0' + month : month;
                                
                                // Format the date as dd/mm/yyyy
                                var formattedDate =  day + '/' + month + '/' + year;
                                dateLabel = new qx.ui.basic.Label(formattedDate);
                                dateLabel.setWidth(150);
                            } else {
                                dateLabel = new qx.ui.basic.Label("");
                                dateLabel.setWidth(150);
                            }
                            item.addWidget(dateLabel);
                            
                            // Size
                            let sizeLabel;
                            if(model.getSize) {
                                sizeLabel = new qx.ui.basic.Label(model.getSize() + " kb");
                                sizeLabel.setWidth(100);
                            } else {
                                sizeLabel = new qx.ui.basic.Label("");
                                sizeLabel.setWidth(100);
                            }
                            item.addWidget(sizeLabel);
			            }
			            
			        }, 100);
			    },
			    
        		sorter : function(a, b) {
        		  //  console.log(a);
        		    var propA = a.get(this.__sortCriterion).toLowerCase();
        		    var propB = b.get(this.__sortCriterion).toLowerCase();
        		    var result = this.__sortDescending ? propA.localeCompare(propB) : propB.localeCompare(propA);
        		    
        		    return result;
        		}.bind(this),
        		
		    });
		},
		
		__sort : function(a, b) {
		  //  console.log(a);
		    var propA = a.get(this.__sortCriterion).toLowerCase();
		    var propB = b.get(this.__sortCriterion).toLowerCase();
		    var result = this.__sortDescending ? propA.localeCompare(propB) : propB.localeCompare(propA);
		    
		    return result;
		},
	}
});

new desk.FileBrowser3("code", true);
/**
* A widget containing a THREE.Canvas to visualize 3D meshes
*
* @asset(desk/camera-photo.png)
* @asset(qx/icon/${qx.icontheme}/16/categories/system.png)
* @ignore(THREE.*)
* @ignore(requestAnimationFrame)
* @ignore(Detector)
* @ignore(prompt)
* @ignore(Uint8Array)
* @lint ignoreDeprecated(alert)
* @ignore (async.*)
* @ignore (_.*)
* @ignore (Float32Array)
* @asset(desk/workers/CTMWorkerBundle.js)
* @asset(desk/workers/VTKWorker.js)
*/

qx.Class.define("desk.THREE.Container",
{
    extend : desk.THREE.Scene,

	/**
	 * constructor
	 * @param file {String} file to open
	 * @param opts {Object} options, see desk.SceneContainer.addFile()
	 * @param callback {Function} callback when done
	 * @param context {Object} optional context for the callback
	 */
	construct : function(file, opts, callback, context) {

		qx.Class.include(qx.ui.treevirtual.TreeVirtual, qx.ui.treevirtual.MNode);

		if (typeof file != "string") {

			opts = file;
			file = callback = context = undefined;

		}

		if (typeof opts === "function") {
			callback = opts;
			context = callback;
			opts = {};
		}
		this.options = opts = opts || {};

        this.base(arguments, opts);

		if (opts.convertVTK !== undefined) {
			this.setConvertVTK(opts.convertVTK);
		}

		if (!desk.Actions.getAction('mesh2ctm')) {
			this.setConvertVTK(false);
		}

		if (this.options.maxZoom)
			this.getControls().setMaxZoom(this.options.maxZoom)
		if (this.options.minZoom)
			this.getControls().setMinZoom(this.options.minZoom)

		var leftContainer = this.__leftContainer = new qx.ui.container.Composite();
		leftContainer.setLayout(new qx.ui.layout.VBox());
		this.add(leftContainer, {left : 0, top : 30, width : "60%", height : "60%" });
		leftContainer.set( { visibility : "hidden", maxWidth : 300, maxHeight : 600 } );

		this.addListener("mousedown", this.__onMouseDown, this);
		this.addListener("mousemove", this.__onMouseMove, this);
		this.addListener("mouseup", this.__onMouseUp, this);
		this.addListener("mousewheel", this.__onMouseWheel, this);
		this.addListener("touchstart", this.__onTouchStart, this);
		this.addListener("touchmove", this.__onTouchMove, this);

		this.addListener('keydown', async event => {
			if ((event.getTarget() !== this.getCanvas()) ||
                (event.getKeyIdentifier() !== 'G')) {
					return;
			}

			const intersection = this.getIntersections()[0];
			if (intersection === undefined) return;
			console.log("picked : ");
			console.log(intersection);
			const node = intersection?.object?.userData?.viewerProperties?.branch;
			const tree = this.__meshes;
			if ( !isNaN( node ) )
				tree.nodeSetSelected( tree.nodeGet( node), true )

			const controls = this.getControls();
			const init = controls.target.clone();
			const final = intersection.point.clone();
			const nFrames = 30;
			for ( let i = 0; i <= nFrames; i++ ) {
				controls.target.lerpVectors ( init, final, i / nFrames );
				controls.update();
				this.render();
				this._propagateLinks();
				await new Promise ( r => setTimeout( r, 10 ) );
			}

		} );

		var button = this.__optionsButton = new qx.ui.form.ToggleButton("+").set({opacity : 0.5, width : 30});
		if (opts.noOpts === undefined || !opts.noOpts) {
			this.add(button, {left : 0, top : 0});
			button.addListener("changeValue", function () {
				leftContainer.setVisibility(button.getValue() ? "visible" : "hidden");
				button.setLabel(button.getValue() ? "-" : "+");
				var color = this.getRenderer().getClearColor( new THREE.Color() );
				var colors = this.__meshes.getDataRowRenderer()._colors;
				colors.colNormal = "rgb(" + (255 * (1 - color.r)) + "," +
				(255 * (1 - color.g)) + "," + (255 * (1 - color.b)) + ")";
				colors.bgcolEven = colors.bgcolOdd = colors.horLine = "transparent";
				colors.bgcolFocused = "rgba(249, 249, 249, 0.5)";
				colors.bgcolFocusedSelected = "rgba(60, 100, 170, 0.5)";
				colors.bgcolSelected = "rgba(51, 94, 168, 0.5)";
			}, this);
		}

		var buttons = new qx.ui.container.Composite(new qx.ui.layout.HBox());
		buttons.add(this.__getDragLabel(), {flex : 1});
		buttons.add(this.__getSaveViewButton(), {flex : 1});
		buttons.add(this.__getResetViewButton(), {flex : 1});
		buttons.add(this.__getSnapViewButton(), {flex : 1});
		buttons.add(this.__getSnapshotButton(), { flex : 1 });
		buttons.add(this.__getCameraPropertiesButton(), { flex : 1 } );
		for ( let [ index, b ] of buttons.getChildren().entries() )
			if ( index > 0 ) b.setWidth( 0 );
		leftContainer.add(buttons);

		this.__meshes = new qx.ui.treevirtual.TreeVirtual(["meshes"]);
		this.__meshes.set({
			width  : 0,
			height : 0,
			columnVisibilityButtonVisible : false,
            statusBarVisible : false,
            backgroundColor : "transparent",
            selectionMode : qx.ui.treevirtual.TreeVirtual.SelectionMode.MULTIPLE_INTERVAL
		});

        leftContainer.add(this.__meshes,{flex : 1});
//		leftContainer.add(this.__getFilterContainer());

		this.__meshes.setContextMenu(this.__getContextMenu());

		if (THREE.CTMLoader) {
			this.__ctmLoader = new THREE.CTMLoader();
		}
		this.__vtkLoader = new THREE.VTKLoader();

		var concurrency = (navigator && 2 * navigator.hardwareConcurrency) || 4;
		this.__queue = async.queue(this.__urlLoad.bind(this), concurrency);

		this.__setData = _.debounce(this.__meshes.getDataModel().setData
			.bind(this.__meshes.getDataModel()), 500);

		if (file) {
			this.addFile(file, opts, callback, context);
		}
		this.__addDropSupport();
	},

	destruct : function(){
		this.__setData = function () {};
		qx.util.DisposeUtil.destroyContainer(this.__leftContainer);
		this.removeMeshes(this.getScene().children.slice() );
		this.unlink();
		this.__meshes.dispose();
		this.__meshes.getDataModel().dispose();
		this.__ctmLoader = null;
	},

	properties : {
		/**
		 * if true, .vtk files will be converted to .ctm files before loading
		 */
		convertVTK : {init : true, check: "Boolean"},

		/**
		 * allows picking with mouse instead of rotation, pan, etc..
		 */
		pickMode : {init : false, check: "Boolean"}
	},

	events : {
		/**
		 * Fired whenever picking is performed (in pick mode only)
		 */
		"pick" : "qx.event.type.Data"
	},

	members : {
		// a treeVirtual element storing all meshes
		__meshes : null,

		// a async.queue to load meshes
		__queue : null,

		// a THREE.VTKLoader
        __vtkLoader : null,

		// a THREE.CTMLLoader
        __ctmLoader : null,

		__setData : null,

		__leftContainer : null,

		__optionsButton : null,

		rayCasterParams : null,

		/**
		 * Returns the button opening the options pane
		 * @return {qx.ui.form.ToggleButton} button opening the options pane
		 */
		getOptionsButton : function () {
			return this.__optionsButton;
		},

		/**
		 * Returns the objects handled in the scene
		 * @return {Array} array of objects
		 */
		getMeshes : function() {
			const meshes = [];
			if (!this.getScene()) return [];
			this.getScene().traverse(function(child) {
				if (!child.isGroup && child.userData.viewerProperties) {
					meshes.push(child);
				}
			});
			return meshes;
		},

		/**
		 * Creates a branch in the tree
		 * @param opt {Object} possible options : parent, label
		 * @return {Integer} branch id
		 */
        __addBranch : function (opt) {
			opt = opt || {};
			opt.label = opt.label || "mesh";
			const parent = opt?.parent?.userData?.viewerProperties?.branch;
			const model = this.__meshes.getDataModel();
			const branch = model.addBranch(parent, opt.label, null );
			const icon = opt.icon || "desk/tris.png";
			this.__meshes.nodeSetIcon( branch, icon );
			this.__meshes.nodeSetSelectedIcon( branch, icon );
			this.__setData();
			return branch;
		},

		/**
		 * Returns the object corresponding to the node
		 * @param node {Object} node
		 * @return {THREE.Object3D} object
		 */
		__getMeshFromNode : function (node) {
			const branch = this.__meshes.nodeGet(node);
			return branch?.viewerProperties?.mesh;
		},

		/**
		 * Adds a mesh to the scene
		 * @param mesh {THREE.Object3D} object to add
		 * @param opt {Object} options
		 */
		addMesh : function (mesh, opt) {
			opt = opt || {};
			(opt.parent || this.getScene()).add(mesh);
			if ( !opt.icon && mesh.isGroup )
				opt.icon = "icon/22/places/folder.png";

			const branch = opt.branch = opt.branch || this.__addBranch( opt );
			opt.mesh = mesh;

			if ( opt.position ) {
				if ( Array.isArray( opt.position ) )
					mesh.position.fromArray( opt.position );
				else mesh.position.copy( opt.position );
			}
			this.__meshes.nodeGet(branch).viewerProperties = mesh.userData.viewerProperties = opt;
			if (opt.updateCamera !== false) {
				this.viewAll();
			} else this.render();
		},

		/**
		 * Creates the filter container
		 * @return {qx.ui.container.Composite} the container
		 */
		__getFilterContainer : function () {
			var dataModel = this.__meshes.getDataModel();
			var container = new qx.ui.container.Composite();
			container.setLayout(new qx.ui.layout.HBox(10));
			var filterText = new qx.ui.basic.Label("search");
			container.add(filterText);

			var filterField = new qx.ui.form.TextField();
			filterField.set({value : "", backgroundColor : "transparent"});
			filterField.addListener("input", function() {
				this.__meshes.getDataModel().setData()
				this.render();
			}, this);
			container.add(filterField);

			var resetButton = new qx.ui.form.Button("Reset filter");
			resetButton.setAllowGrowY(false);
			resetButton.addListener("execute",function(e){
				filterField.setValue("");
			}, this);

			container.add(resetButton);
			dataModel.setFilter(function(node) {
				var label = node.label;
				var mesh = this.__getMeshFromNode(node);
				var visibility = false;
				if (label.toLowerCase().indexOf(filterField.getValue().toLowerCase()) != -1) {
					visibility = true;
				}
				if (mesh) {
					mesh.visible = visibility;
				}
				return visibility;
			}.bind(this));
			return container;
		},

		/**
		 * reads the file
		 * @param file {String} file to read
		 * @param opt {Object} options
		 * @param callback {Function} callback when done
		 */
		__readFile : function (file, opt, callback) {
            opt = opt || {};
            opt.branch = this.__addBranch( {parent : opt.parent,
				label : opt.label || desk.FileSystem.getFileName(file)});

			switch (desk.FileSystem.getFileExtension(file)) {
            case "vtk":
				if (!this.isConvertVTK() || opt.convert === false) {
					this.__loadFile(file, opt, callback);
					break;
				}
			case "ply":
			case "obj":
			case "stl":
			case "off":
				if (!desk.Actions.getAction('mesh2ctm')) {
					var message = "Error : action mesh2ctm is not installed. Please install binary addons to read more formats than VTK";
					alert(message);
					throw new Error(message);
				}
				desk.Actions.execute({
                    "action" : "mesh2ctm",
					"input_mesh" : file},
                    function (err, response) {
                       var outputDir = response.outputDirectory;
                        opt.timeStamp = response.timeStamp;
                        this.__loadFile(outputDir + '/mesh.ctm', opt, callback);
				}, this);
				break;

			case "ctm":
				this.__loadFile(file, opt, callback);
				break;
			default :
				console.error("error : file " + file + " cannot be displayed by mesh viewer");
			}
		},

		/**
		 * loads a file
		 * @param file {String} file to read
		 * @param opt {Object} options
		 * @param callback {Function} callback when done
		 */
		__loadFile : function (file, opt, callback) {
			opt.timeStamp = opt.timeStamp || Math.random();
			opt.url = desk.FileSystem.getFileURL(file);
			this.loadURL(opt, callback);
		},

		/**
		 * reloads all loaded objects
		 */
		update : function () {
			var files = [];
			this.getMeshes().forEach(function (mesh) {
				if (mesh.userData.viewerProperties.file) {
					files.push(mesh.userData.viewerProperties.file);
				}
			});
			this.removeAllMeshes();
			this.__meshes.getDataModel().clearData();
			files.forEach(function (file) {this.addFile(file);}, this);
		},

		/**
		 * Removes all meshes in the scene
		 * @param dispose {Boolean} dispose meshes to avoid memory leaks (default : true)
		 */
		removeAllMeshes : function (dispose) {
			this.removeMeshes(this.getMeshes(), dispose);
			this.resetView();
		},

		/**
		 * parses xml data
		 * @param file {String} the read file
		 * @param xml {Element} the xml tree
		 * @param opts {Object} options
		 * @param callback {Function} callback when done
		 */
		 __parseXMLData : function (file, xml, opts, callback) {
			var root = xml.childNodes[0];
			opts.timeStamp = root.hasAttribute("timestamp")?
				parseFloat(root.getAttribute("timestamp")) : Math.random();

			var dataModel = this.__meshes.getDataModel();
			var branch = dataModel.addBranch(null, desk.FileSystem.getFileName(file), null);
			this.__setData();
			const object = new THREE.Group();
			opts.branch = branch;
			opts.file = file;
			this.addMesh(object, opts);

			var path = desk.FileSystem.getFileDirectory(file);
			async.each(xml.getElementsByTagName("mesh"), function (mesh, callback) {
				var meshParameters = {parent : object};
				if (mesh.hasAttribute("color")) {
					var color = mesh.getAttribute("color").split(" ").map(
						function (color) {
							return parseFloat(color);
						}
					);
					meshParameters.color = color;
					meshParameters.renderOrder = color[4];
				}

				if (mesh.hasAttribute("Mesh")) {
					var xmlName = mesh.getAttribute("Mesh");
				} else {
					xmlName = mesh.getAttribute("mesh");
				}
				this.__readFile(path + xmlName, meshParameters,
					function () {callback();});
			}.bind(this), function () {
				callback(object);
			});
		},

		/**
		 * Loads a file in the scene.
		 * @param file {String} input file
		 * @param opts {Object} options
		 * @param callback {Function} callback when done
		 * @param context {Object} optional context for the callback
		 */
		addFile : function (file, opts, callback, context) {
			if (typeof opts === "function") {
				callback = opts;
				context = callback;
				opts = {};
			}
			opts = opts || {};
			callback = callback || function ( err, res ) {};

			if ( callback.length === 1 ) {
				console.warn( "Please change the callback to a error-first node-style callback : change function (mesh) to function ( err, mesh )" );
				console.warn( new Error().stack );

				var oldCallback = callback;
				callback = function ( err, mesh ) {

					oldCallback.call( context, mesh );

				}

			}

            opts.file = file;

			function after (mesh) {callback.call(context, null, mesh);}

			switch (desk.FileSystem.getFileExtension(file)) {
				case "ply":
				case "obj":
				case "stl":
				case "vtk":
				case "ctm":
				case "off":
					this.__readFile (file, opts, after);
					break;
				case "xml":
					desk.FileSystem.readFile(file, function (error, result){
						if (error) {
							console.error("Error while reading " + file + "\n" + error);
							throw (error);
							return;
						}
						result = (new DOMParser()).parseFromString(result, "text/xml");
						this.__parseXMLData(file, result, opts, after);
					}, this);
					break;
				case "json" :
					desk.FileSystem.readFile(file, function (error, result){
						if (error) {
							console.error("Error while reading " + file + "\n" + error);
							throw (error);
						}
						result = JSON.parse(result);
						if (result.viewpoint) {
							this.setViewpoint(result.viewpoint);
							setTimeout(function () {
								this.render();
								this._propagateLinks();
							}.bind(this), 50);
						};
					}, this);
					break;
				default :
					console.error ("error : meshviewer cannot read " + file);
					break;
			}
		},

		/**
		 * Attaches a set of desk.MPR.Slice to the scene
		 * @param volumeSlices {Array} Array of desk.MPR.Slice;
		 * @return {Array} array of THREE.Mesh
		 */
		attachVolumeSlices : function (slices, opts = {} ) {
			return slices.map( s => this.attachVolumeSlice( s, opts ) );
		},

		/**
		 * Attaches a set of desk.MPR.Slice to the scene
		 * @param slice {desk.MPR.Slice} volume slice to attach;
		 * @param opts {Object} options;
		 * @return {THREE.Mesh} the created mesh;
		 */
		attachVolumeSlice : function ( slice, opts = {} ) {

			const geometry = new THREE.PlaneGeometry( 1, 1 );
			const vertices = geometry.attributes.position.array;
			const indices = desk.MPR.Slice.indices;
			const orientation = slice.getOrientation();
			const origin = slice.getOrigin();
			const extent = slice.getExtent();
			const spacing = slice.getSpacing();
			const xi = indices.x[orientation];
			const yi = indices.y[orientation];
			const zi = indices.z[orientation];
			const { colorFrame = true } = opts;

			for ( let i = 0; i < 4; i++) {
				vertices[3 * i + xi] =  origin[xi] +
					extent[2 * xi + (i % 2)] * spacing[xi];

				vertices[3 * i + yi] =  origin[yi] +
					extent[2 * yi + (i > 1 ? 1 : 0)] * spacing[yi];

				vertices[3 * i + zi] =  0;
			}

			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();
			const material = slice.getMaterial();
			const mesh = new THREE.Mesh(geometry,material);
			let lineMaterial;

			if ( colorFrame )  {

				lineMaterial = new THREE.MeshBasicMaterial({
					color: desk.MPR.Slice.COLORS[ orientation ],
					side:THREE.DoubleSide,
					polygonOffset: true,
					polygonOffsetFactor: 1.0,
					polygonOffsetUnits: 4.0	});

				const line = new THREE.Mesh( geometry.clone(), lineMaterial );
				mesh.add( line );
				const center = new THREE.Vector3();
				line.geometry.boundingBox.getCenter( center );
				line.geometry.scale( 1.03, 1.03, 1.03 );
				line.geometry.center();
				line.geometry.translate( ...center.toArray() );

			}

			const update = () => {
				if ( this.isDisposed() ) return cleanup();
				mesh.position.setComponent( zi, slice.getPosition() );
				this.render();
			};

			const listeners = [ 'changeImage', 'changePosition' ]
				.map( e => slice.addListener( e, update ) );

			update();

			this.addMesh( mesh, { icon : "desk/img.png",
				label : 'View ' + ( slice.getOrientation() + 1 ),
				...opts, volumeSlice : slice } );

			mesh.addEventListener("removed", cleanup );

			function cleanup () {

				if ( colorFrame ) lineMaterial.dispose();
				if ( slice.isDisposed() ) return;
				for ( let id of listeners ) slice.removeListenerById( id );

			}

			return mesh;
		},

		/**
		 * Attaches a volume to the scene. The volume wil be represented
		 *  by its three orthogonal slices
		 * @param file {String} volume file
		 * @param opts {Object} options;
		 * @param callback {Function} callback when done
		 * @param context {Object} optional callback context
		 * @return {THREE.Group} the object;
		 */
		addVolume : function (file, opts, callback, context) {
			if (typeof(opts) === "function") {
				context = callback;
				callback = opts;
				opts = {};
			}

			opts = opts || {};

			var group = new THREE.Group();
			this.addMesh(group, { label : file, ...opts } );
			async.eachSeries(opts.orientations || [0, 1, 2], function (orientation, callback) {
				var slice = new desk.MPR.Slice(file, orientation, opts,
					function (err) {
					if (err) {
						callback(err);
						return;
					}
					slice.setSlice(Math.floor(slice.getNumberOfSlices() / 2));
					this.attachVolumeSlice(slice, { ...opts, parent : group,
						position : [ 0, 0, 0 ] } );
					callback();
				}.bind(this));
			}.bind(this), function () {
				(callback || function () {}).call( context, null, group );
			});
			return group;
		},

		/**
		 * Adds drop support
		 */
		__addDropSupport : function () {
			this.setDroppable(true);
			this.addListener("drop", e => {
				if ( e.getOriginalTarget() != this.getCanvas() ) return;
				if (e.supportsType("fileBrowser")) {
					for ( let file of e.getData("fileBrowser").getSelectedFiles() )
						this.addFile(file);
				} else if (e.supportsType("volumeSlices")) {
					this.attachVolumeSlices(e.getData("volumeSlices"));
				}
			} );
		},

		__filterTouchEvents : function ( events ) {

			const t = events.getTargetTouches();
			const origin = this.getContentLocation();

			return t.filter( e => {

				if ( e.pointerType === "mouse" ) return false;
				if ( ( !e.x ) && ( !e.y ) ) return false;
				return true;

				} ).map( e  => {

					return { x : e.x - origin.left, y : e.y - origin.top } ;

			} );

		},

		__onTouchMove : function ( e ) {

			const obj = this.__filterTouchEvents( e );
			if ( !obj.length ) return;
			this.getControls().touchMove( obj );
			this.render();
			this._propagateLinks();

		},

		__onTouchStart : function ( e ) {

			const obj = this.__filterTouchEvents( e );
			if ( !obj.length ) return;
			this.getControls().touchStart( obj );

		},


		/**
		 * fired whenever a button is clicked
		 * @param event {qx.event.type.Event} the event
		 */
		__onMouseDown : function (event) {
			if (event.getTarget() != this.getCanvas()) return;
			this.capture();
			if (this.isPickMode()) {
				var mesh = this.getIntersections()[0];
				if (mesh !== undefined) {
					this.fireDataEvent("pick", mesh);
					return;
				}
			}
			var origin = this.getContentLocation();
			var button = 0;
			if (event.isRightPressed() ||
				(event.isCtrlPressed() && !event.isShiftPressed())) {
				button = 1;
			}
			else if ( event.isMiddlePressed() ||
				(event.isShiftPressed() && !event.isCtrlPressed())) {
				button = 2;
			}
			else if (event.isCtrlPressed() && event.isShiftPressed()) {
				button = 3;
			}

			this.getControls().mouseDown(button,
				event.getDocumentLeft() - origin.left,
				event.getDocumentTop() - origin.top);
		},

        __x : null,

        __y : null,

		/**
		 * fired whenever the mouse is moved
		 * @param event {qx.event.type.Event} the event
		 */
		__onMouseMove : function (event) {
			this.__x = event.getDocumentLeft();
			this.__y = event.getDocumentTop();

			if (!this.isCapturing()) {
				return;
			}
			if (this.isPickMode()) {
				var mesh = this.getIntersections()[0];
				if (mesh !== undefined) {
					this.fireDataEvent("pick", mesh);
					return;
				}
			}
			var origin = this.getContentLocation();
			this.getControls().mouseMove(event.getDocumentLeft() - origin.left,
				event.getDocumentTop() - origin.top);
			this.render();
			this._propagateLinks();
		},

		/**
		 * fired whenever a button is released
		 * @param event {qx.event.type.Event} the event
		 */
		__onMouseUp : function (event) {
			this.releaseCapture();
			this.getControls().mouseUp();
		},

		/**
		 * computes the intersections between an array of objects and the mouse pointer
		 * @param meshes {Array} array of THREE objects. Default value : all visible objects in the scene
		 * @return {Array} array of intersections
		 */
		getIntersections : function (meshes) {
			const origin = this.getContentLocation();
			const x = this.__x - origin.left;
			const y = this.__y - origin.top;

			const elementSize = this.getInnerSize();
			const mouse = new THREE.Vector2();
			mouse.x = ( x / elementSize.width ) * 2 - 1;
			mouse.y = - ( y / elementSize.height ) * 2 + 1;

			const raycaster = new THREE.Raycaster();
			raycaster.setFromCamera(mouse, this.getCamera());

			meshes = meshes || this.getMeshes().filter( m => m.visible );
			if ( this.rayCasterParams ) raycaster.params = this.rayCasterParams;
			return raycaster.intersectObjects(meshes);
		},

		/**
		 * fired whenever the mouse wheel is turned
		 * @param event {qx.event.type.MouseWheel} the event
		 */
		__onMouseWheel : function (event) {

			if ( this.getControls()._state >= 0 ) return;
			if (event.getTarget() != this.getCanvas()) return;
			const slices = [];

			this.getScene().traverseVisible( mesh => {
				if ( mesh?.userData?.viewerProperties?.volumeSlice )
					slices.push(mesh);
			});

			const intersects = this.getIntersections(slices)[0];
			const delta = event.getWheelDelta() > 0 ? 1 : -1;

			if ( intersects && ( this.options.sliceOnWheel != false ) ) {

				const slice = intersects?.object?.userData?.viewerProperties?.volumeSlice || intersects?.object?.parent?.userData?.viewerProperties?.volumeSlice;
				const maximum = slice.getNumberOfSlices() - 1;
				const newValue = slice.getSlice() + delta;
				slice.setSlice( Math.max( Math.min( newValue, maximum ), 0 ) );

			} else {

				this.getControls().mouseDown(1, 0, 0);
				this.getControls().mouseMove(0, 0.05 * delta * this.getInnerSize().height);
				this.getControls().mouseUp();
				this.render();
				this._propagateLinks();

			}
		},

		/**
		 * loads an url
		 * @param opts {Object} options
		 * @param callback {Function} callback when done
		 */
		loadURL : function (opts, callback) {
			this.__queue.push(opts, callback || function () {});
		},

		/**
		 * adds a geometry to the scene
		 * @param geometry {THREE.Geometry} the input geometry
		 * @param opts {Object} options
		 * @return {THREE.Mesh} the mesh containing the geometry
		 */
        addGeometry : function (geometry, opts) {
            opts = opts || {label : 'geometry'};
			geometry.computeBoundingBox();

			var color = opts.color || [1, 1, 1];
			var opacity = color[3];
			if (opts.opacity !== undefined) {
				opacity = opts.opacity;
			}

			var material =  new THREE.MeshLambertMaterial({
				color : new THREE.Color().fromArray(color).getHex(),
				side : THREE.DoubleSide
			});

			if ((opacity !== undefined) && (opacity < 1)) {
				material.transparent = true;
				material.opacity = opacity;
			}

			var mesh = new THREE.Mesh(geometry, material );
			if (geometry.attributes && geometry.attributes.color) {
				mesh.material.vertexColors = true;
			}
			mesh.renderOrder = opts.renderOrder || 0;
            this.addMesh( mesh, opts );
            return mesh;
        },

		__ctmWorkers : [],

		/**
		 * (really) loads an url
		 * @param opts {Object} options
		 * @param callback {Function} callback when done
		 */
		 __urlLoad : function (opts, callback) {
			if (desk.FileSystem.getFileExtension(opts.url) === "vtk") {
				this.__vtkLoader.load (opts.url + "?nocache=" + opts.timeStamp,
					function (geometry) {
						callback (this.addGeometry(geometry, opts));
				}.bind(this));
			} else {
				if (this.__ctmWorkers.length) {
					var worker = this.__ctmWorkers[0];
					this.__ctmWorkers.shift();
				} else {
					const manager = qx.util.ResourceManager.getInstance();
					const url = manager.toUri( "desk/workers/CTMWorkerBundle.js");
					worker = new window.Worker( url );
				}

				this.__ctmLoader.load (opts.url + "?nocache=" + opts.timeStamp, function (geometry) {
					this.__ctmWorkers.push(worker);
					callback (this.addGeometry(geometry, opts));
				}.bind(this), {useWorker : true, worker : worker});
			}
		},

		/**
		 * creates the snapshot button
		 * @return {qx.ui.form.Button} the button
		 */
		__getSnapshotButton : function () {
			var factor = 1;
			var menu = new qx.ui.menu.Menu();
			[1, 2, 3, 4].forEach(function (f) {
				var button = new qx.ui.menu.Button("x" + f);
				button.addListener("execute", function (){
					factor = f;
				},this);
				menu.add(button);
			});

			var button = new qx.ui.form.Button(null, "desk/camera-photo.png");
			button.addListener("click", function(e) {
				if (!e.isLeftPressed()) return;
				this.snapshot({ratio : factor});
			}, this);

			button.setContextMenu(menu);
			qx.util.DisposeUtil.disposeTriggeredBy(menu, this);
			return button;
		},

		/**
		 * creates the reset view button
		 * @return {qx.ui.form.Button} the button
		 */
		__getResetViewButton : function () {
			var button = new qx.ui.form.Button("reset");
			button.addListener("execute", this.resetView, this);
			return button;
		},

		/**
		 * creates the snap view button
		 * @return {qx.ui.form.Button} the button
		 */
		__getSnapViewButton : function () {
			var button = new qx.ui.form.Button("snap");
			button.addListener( "execute", function (){
				var camera = this.getCamera();
				var euler = new THREE.Euler().setFromQuaternion( camera.quaternion );
				["x", "y", "z"].forEach(function (coord) {
					euler[ coord ] = 0.5 * Math.PI * Math.round( 2 * euler[ coord ] / Math.PI);
				});
				var target = this.getControls().target;
				var eye = camera.position.clone().sub( target );
				camera.quaternion.setFromEuler( euler );
				var m = new THREE.Matrix4().makeRotationFromQuaternion(camera.quaternion);
				camera.up.set( 0, 1, 0 ).transformDirection(m);
				var dir = new THREE.Vector3( 0, 0, -1 ).transformDirection(m);
				dir.multiplyScalar( dir.dot( eye ) );
				camera.position.copy( target ).add( dir );
				this.render();
				this._propagateLinks();
			}, this );
			return button;
		},

		/**
		 * creates the save view button
		 * @return {qx.ui.form.Button} the button
		 */
		__getSaveViewButton : function () {
			var button = new qx.ui.form.Button("save");
			button.addListener("click", function () {
				console.log("viewPoint : ");
				console.log(JSON.stringify(this.getViewpoint()));
				var file = prompt("Enter file name to save camera view point", "data/viewpoint.json");
				if (!file) {return;}
				button.setEnabled(false);
				desk.FileSystem.writeFile(file,
					JSON.stringify({viewpoint : this.getViewpoint()}),
					function () {
						button.setEnabled(true);
				});
			}, this);

			return button;
		},

		/**
		 * creates the camera button
		 * @return {qx.ui.form.Button} the button
		 */
		__getCameraPropertiesButton : function () {
			var button = new qx.ui.form.MenuButton(null, "icon/16/categories/system.png");
			button.addListener("execute", function () {
				var win = new qx.ui.window.Window();
				win.setLayout(new qx.ui.layout.VBox());
				["near", "far"].forEach(function (field) {
					var container = new qx.ui.container.Composite(new qx.ui.layout.HBox());
					container.add(new qx.ui.basic.Label(field));
					var form = new qx.ui.form.TextField(this.getCamera()[field].toString());
					container.add(form);
					win.add(container);
					form.addListener("changeValue", function () {
						this.getCamera()[field] = parseFloat(form.getValue());
						this.getCamera().updateProjectionMatrix();
						this.render();
					}, this);
				}, this);
				win.open();
				win.center();
				win.addListener('close', function () {
					win.destroy();
				});
			}, this);
			return button;
		},

		/**
		 * creates the drag label
		 * @return {qx.ui.basic.Label} the label
		 */
		__getDragLabel : function () {
			var label = new qx.ui.basic.Label("Link").set({
                decorator: "button-box", width : 30, height : 30});
			// drag and drop support
			label.setDraggable(true);
			label.addListener("dragstart", function(e) {
				e.addAction("alias");
				e.addType("meshView");
				});

			label.addListener("droprequest", function(e) {
					if (e.getCurrentType() === "meshView") {
						e.addData(e.getCurrentType(), this);
					}
				}, this);

			// enable linking between viewers by drag and drop
			this.setDroppable(true);
			this.addListener("drop", function(e) {
				if (!e.supportsType("meshView")) {return}
				var meshView = e.getData("meshView");
				this.link(meshView);
				meshView._propagateLinks();
			},this);

			var menu = new qx.ui.menu.Menu();

			var unlinkButton = new qx.ui.menu.Button("unlink");
			unlinkButton.addListener("execute", this.unlink, this);
			menu.add(unlinkButton);
			label.setContextMenu(menu);
			qx.util.DisposeUtil.disposeTriggeredBy(menu, this);
			return label;
		},

		/**
		 * creates mesh properties edition container
		 * @param parentWindow {qx.ui.window.Window} optional parent window
		 * @return {qx.ui.container.Composite} the container
		 */
		__getPropertyWidget : function (parentWindow){
			var mainContainer = new qx.ui.container.Composite();
			mainContainer.setLayout(new qx.ui.layout.VBox());

			var topBox = new qx.ui.container.Composite();
			topBox.setLayout(new qx.ui.layout.HBox());
			var bottomBox = new qx.ui.container.Composite();
			bottomBox.setLayout(new qx.ui.layout.HBox());
			mainContainer.add(topBox);
			mainContainer.add(bottomBox);

			var colorSelector = new qx.ui.control.ColorSelector();
			bottomBox.add(colorSelector);//, {flex:1});

			var renderOrderLabel = new qx.ui.basic.Label("Render Order");
			topBox.add(renderOrderLabel);

			var renderOrderSpinner = new qx.ui.form.Spinner(-100, 0,100);
			topBox.add(renderOrderSpinner);

			topBox.add(new qx.ui.core.Spacer(10, 20),{flex:1});
			if (parentWindow) {
				var alwaysOnTopCheckBox = new qx.ui.form.CheckBox("this window always on top");
				alwaysOnTopCheckBox.setValue(true);
				parentWindow.setAlwaysOnTop(true);
				alwaysOnTopCheckBox.bind("value", parentWindow, "alwaysOnTop");
				topBox.add(alwaysOnTopCheckBox);
			}
			var ratio = 255;
			var opacitySlider = new qx.ui.form.Slider();
			opacitySlider.setMinimum(0);
			opacitySlider.setMaximum(ratio);
			opacitySlider.setWidth(30);
			opacitySlider.setOrientation("vertical");
			bottomBox.add(opacitySlider);

			var enableUpdate = true;
			var updateWidgets = function (event) {
				enableUpdate = false;
				var selectedNode = this.__meshes.getSelectedNodes()[0];
				var firstSelectedMesh = this.__getMeshFromNode(selectedNode);
				var color=firstSelectedMesh.material.color;
				if (!color) return;
				colorSelector.setRed(Math.round(ratio*color.r));
				colorSelector.setGreen(Math.round(ratio*color.g));
				colorSelector.setBlue(Math.round(ratio*color.b));
				colorSelector.setPreviousColor(Math.round(ratio*color.r),
						Math.round(ratio*color.g),Math.round(ratio*color.b));
				opacitySlider.setValue(Math.round(firstSelectedMesh.material.opacity*ratio));
				if (firstSelectedMesh.renderOrder) {
					renderOrderSpinner.setValue(firstSelectedMesh.renderOrder);
				}
				enableUpdate=true;
			};

			updateWidgets.apply(this);

			this.__meshes.addListener("changeSelection", updateWidgets, this);

			opacitySlider.addListener("changeValue", function(event){
				if (enableUpdate) {
					var opacity=opacitySlider.getValue()/ratio;
                    this.getSelectedMeshes().forEach(function (mesh){
						mesh.material.opacity=opacity;
						if (opacity<1) {
							mesh.material.transparent=true;
						} else {
							mesh.material.transparent=false;
						}
                    });
					this.render();
				}
			}, this);

			colorSelector.addListener("changeValue", function(event){
				if (enableUpdate) {
                    this.getSelectedMeshes().forEach(function (mesh){
						mesh.material.color.setRGB (colorSelector.getRed()/ratio,
									colorSelector.getGreen()/ratio,
									colorSelector.getBlue()/ratio);
					});
					this.render();
				}
			}, this);

			renderOrderSpinner.addListener("changeValue", function(event){
				if (enableUpdate) {
                    this.getSelectedMeshes().forEach(function (mesh){
                        mesh.renderOrder = renderOrderSpinner.getValue();
                    });
					this.render();
				}
			}, this);
			return mainContainer;
		},

		/**
		 * Returns an array of selected meshes in the list
		 * @return {Array} array of THREE.Mesh
		 */
        getSelectedMeshes : function () {
            var meshes = [];
            this.__meshes.getSelectedNodes().forEach(function (node) {
                var mesh = this.__getMeshFromNode(node);
                if (mesh) meshes.push(mesh);
			}, this);
            return meshes;
        },

		/**
		 * Removes all meshes in the scene
		 * @param meshes {Array} Array of meshes to remove
		 * @param dispose {Boolean} dispose mesh to avoid memory leaks (default : true)
		 */
		removeMeshes : function (meshes, dispose) {
			meshes.forEach(function (mesh) {
				this.removeMesh(mesh, dispose);
			}, this);
		},


		__removeReal : function (mesh) {

			if (mesh.parent) {
				mesh.parent.remove( mesh );
			}

			var params = mesh && mesh.userData && mesh.userData.viewerProperties;

			if ( params ) {
				var branch = this.__meshes.nodeGet( params.branch );

				if (branch) {

					delete branch.viewerProperties;
					this.__meshes.getDataModel().prune(branch.nodeId, true);

				}

				this._deleteMembers(params);

			}

			this.__setData();

			if ( mesh.geometry ) mesh.geometry.dispose();

			if ( mesh.material ) {

				if (mesh.material.map) mesh.material.map.dispose();
				mesh.material.dispose();

			}

			this._deleteMembers( mesh.userData );
			if ( mesh.dispose && ( typeof mesh.dispose === "function" ) ) {
				mesh.dispose();
			}
        },

		/**
		 * Removes a mesh from the scene
		 * @param mesh {THREE.Mesh} mesh to remove
		 */
		removeMesh : function (mesh) {

			const objects = [];
			mesh.traverse( m => objects.push( m ) );
			for ( let object of objects ) this.__removeReal( object );
			this.render();

        },

		__animator : null,

		/**
		 * creates the context menu
		 * @return {qx.ui.menu.Menu} the menu
		 */
		__getContextMenu : function() {
			//context menu to edit meshes appearance
			var menu = new qx.ui.menu.Menu();

			var properties = new qx.ui.menu.Button("properties");
			properties.addListener("execute", function (){
				var node = this.__meshes.getSelectedNodes()[0];
				var mesh = this.__getMeshFromNode(node);
				console.log(mesh);
				var geometry = mesh.geometry;
				if (!geometry) return;

				var nV = 0, nT = 0;
				nV = geometry.attributes.position.count;
				if (geometry.index) {
					nT = geometry.index.count / 3;
				}
				console.log("Mesh with " + nV + " vertices and " + nT + " triangles");
			}, this);
			menu.add(properties);

			var appearance = new qx.ui.menu.Button("appearance");

			appearance.addListener("execute", function (){

				var win = new qx.ui.window.Window();
				win.setLayout(new qx.ui.layout.HBox());
				win.add(this.__getPropertyWidget(win));
				win.open();
				let closed = false;
				win.addListener('close', function () {
					if ( !win.isDisposed() ) win.destroy();
					closed = true;
				});

				if ( !this.getWindow ) return;
				this.getWindow().addListener( 'close', function () {
					if ( !closed ) win.destroy();
				} );

			}, this);

			menu.add(appearance);

			var showButton = new qx.ui.menu.Button("show/hide");
			showButton.addListener("execute", function (){
                this.getSelectedMeshes().forEach(function (mesh) {
					mesh.visible = !mesh.visible;
                });
				this.render();
			},this);
			menu.add(showButton);

			var edgesButton = new qx.ui.menu.Button("show/hide edges");
			edgesButton.addListener("execute", function (){

				function removeEdges() {
					this.remove(this.userData.edges);
					this.removeEventListener("removedFromScene", removeEdges);
					delete this.userData.edges;
				}

                this.getSelectedMeshes().forEach(function (mesh) {
					var edges = mesh.userData.edges;
					if (edges) {
						removeEdges.apply(mesh)
					} else {
						edges = new THREE.Mesh(mesh.geometry,
							new THREE.MeshBasicMaterial({
								color : 0x000000,
								wireframe : true
							})
						);
						mesh.userData.edges = edges;
						mesh.material.polygonOffset = true;
						mesh.material.polygonOffsetFactor = 1;
						mesh.material.polygonOffsetUnits = 1;
						mesh.addEventListener("removedFromScene", removeEdges);
						mesh.add(edges);
					}
				});
				this.render();
			},this);
			menu.add(edgesButton);

			var removeButton = new qx.ui.menu.Button("remove");
			removeButton.addListener("execute", function (){
				this.removeMeshes(this.getSelectedMeshes());
				this.render();
			},this);
			menu.add(removeButton);

			var animate = new qx.ui.menu.Button('animate');
			animate.addListener('execute', function () {
				var nodes = this.__meshes.getSelectedNodes();
				if (!this.__animator) {
					this.__animator = new desk.THREE.Animator(this.render.bind(this), {
						standalone : true,
						snapshotCallback : this.snapshot.bind( this )
					});
					this.__animator.addListener('close', function () {
						this.__animator = null;
					}, this);
				}

				nodes.forEach(function (node) {
					this.__animator.addObject(this.__getMeshFromNode(node), node.label);
				}, this);
			},this);
			menu.add(animate);

			//// hide all menu buttons but the "show" and "hide" buttons for the volumeSlices
			menu.addListener("appear", function() {
				var nodes = this.__meshes.getSelectedNodes() || [];
				var selNode = nodes[0];
				if (!selNode) {
					return;
				}

				var visibility = "visible"
				var branch = this.__meshes.nodeGet(selNode);
				if( branch && branch?.viewerProperties?.volumeSlice) {
					visibility = "excluded";
				}

				[properties, appearance, animate].forEach(function (button) {
					button.setVisibility(visibility);
				});
			}, this);

			qx.util.DisposeUtil.disposeTriggeredBy(menu, this);
			return menu;
		}
	}
});

/**
* A container used to display volume slices.
*
* @ignore(THREE.*)
* @ignore(Uint8Array)
* @ignore(_.*)
*/

qx.Class.define("desk.SliceView",
{
	extend : desk.ThreeContainer,
	include : desk.LinkMixin,

	/**
	 * Constructor
	 * @param orientation {Integer} slice orientation : 0,1 or 2
	 * @param options {Object} options : {textColor : "yellow"}
	 */
	construct : function(orientation, options) {
		this.base(arguments);
		this.getCamera().far = 10000;
		this.__slices = [];
		this.__orientation = orientation || 0;
		this.options = options = options || {};
		this.__textColor = options.textColor || "yellow";
		this.__alwaysDisplaySlider = options.alwaysDisplaySlider || false;
		this.__zoomOnWheel = options.zoomOnWheel || false;
		this.__createUI();
		this.__initUndo();
		this.addListener("mousedown", this.__onMouseDown, this);
		this.addListener("mouseout", this.__onMouseOut, this);
		this.addListener("mousemove", this.__onMouseMove, this);
		this.addListener("mouseup", this.__onMouseUp, this);
		this.addListener("mousewheel", this.__onMouseWheel, this);
		this.setDecorator(new qx.ui.decoration.Decorator().set({
			color : desk.VolumeSlice.COLORS[orientation], width : 3}));
	},

	destruct : function(){
		this.removeAllVolumes();
		this.unlink();
		//clean the scene
		qx.util.DisposeUtil.destroyContainer(this.__rightContainer);

		if (this.__drawingCanvas) {this.__drawingCanvas.dispose();}

		if (this.__brushCanvas) {this.__brushCanvas.dispose();}

		this.__intersection = null;
		this.__2DCornersCoordinates = null;
		this.__2DDimensions = null;
		this.__2DSpacing = null;
		this.__origin = null;
		this.__spacing = null;
	},

	properties : {

		/** current display slice */
		slice : { init : 0, check: "Number", event : "changeSlice", apply : "__applyChangeSlice"},

		/** current camera z position */
		cameraZ : { init : 1, check: "Number", event : "changeCameraZ", apply : "__applyCameraZ"},

		/** paint opacity (betwen 0 and 1) */
		paintOpacity : { init : 1, check: "Number", event : "changePaintOpacity"},

		/** is the interaction mode set to paint mode*/
		paintMode : { init : false, check: "Boolean", event : "changePaintMode", apply : "__applyPaintMode"},

		/** is the interaction mode set to erase mode*/
		eraseMode : { init : false, check: "Boolean", event : "changeEraseMode", apply : "__applyEraseMode"},

		/** Should the flip and rotate operations operate on camera or orientation markers*/
		orientationChangesOperateOnCamera : { init : true, check: "Boolean"}
	},

	events : {
		/**
		 * Fired whenever the drawing has changed
		 */
		"changeDrawing" : "qx.event.type.Event",

		/**
		 * Fired whenever the cross position changes
		 */
		"changeCrossPosition" : "qx.event.type.Event"
	},

	members : {
		/**
		 * Returns true if the view is active (if the mouse pointer is over this view)
		 * @return {boolean} true/false depending on the mouse pointer position
		 */
		isViewOn : function () {
			return this.__viewOn;
		},

		__viewOn : false,

		/**
		 * called whenever erase mode is changed
		 * @param mode {Boolean} new erase mode
		 */
		__applyEraseMode : function (mode) {
			this.__initDrawing();
			if (mode) {
				this.setPaintMode(false);
				this.__updateBrush();
			}
		},

		/**
		 * called whenever paint mode is changed
		 * @param mode {Boolean} new paint mode
		 */
		__applyPaintMode : function (mode) {
			this.__initDrawing();
			if (mode) {
				this.setEraseMode(false);
				this.__updateBrush();
			}
		},

		__orientation : 0,

		/**
		 * Returns the viewer orientation
		 * @return {Integer} orientation
		 */
		 getOrientation : function () {
			return this.__orientation;
		},

		__slices : null,

		__slider : null,

		__rightContainer : null,
		__directionOverlays : null,

		__paintWidth : 5,
		// default color is red
		__paintColor : '#ff0000',

		__drawingCanvas : null,
		__drawingMesh : null,

		__brushMesh : null,

		__crossMeshes : [],

		__drawingCanvasModified : false,

		__textColor : null,

		__alwaysDisplaySlider : null,

		__zoomOnWheel : null,

		/**
		 * Returns the 2D projection on slice of the 3D input position
		 * @param x {Float} x coordinate
		 * @param y {Float} y coordinate
		 * @param z {Float} z coordinate
		 * @return {Object} coordinates in an object like {x : 10, y : 100}
		 */
		projectOnSlice : function (x, y, z) {
			var indices = desk.VolumeSlice.indices;
			return {x : indices.x[this.__orientation],
				y : indices.y[this.__orientation]};
		},

		/**
		 * Returns the 2D dimensions
		 * @return {Array} array of dimensions
		 */
		getVolume2DDimensions : function() {
			return this.__2DDimensions;
		},

		/**
		 * Returns the 2D spacing
		 * @return {Array} array of spacings
		 */
		getVolume2DSpacing : function() {
			return this.__2DSpacing;
		},

		/**
		 * Returns the 2D origin
		 * @return {Array} array of origins
		 */
		getVolume2DOrigin : function() {
			return this.__2DCornersCoordinates.slice(0,2);
		},

		/**
		 * Returns the 2D coordinates of the slice corners
		 * @return {Array} array of coordinates
		 */
		get2DCornersCoordinates : function() {
			return this.__2DCornersCoordinates;
		},

		/**
		 * Returns the container used for displaying the slider
		 * @return {qx.ui.container.Composite} the container
		 */
		getRightContainer : function () {
			return this.__rightContainer;
		},

		/**
		 * Returns the canvas where the user can draw
		 * @return {qx.ui.embed.Canvas} the drawing canvas
		 */
		getDrawingCanvas : function () {
			this.__initDrawing();
			return this.__drawingCanvas;
		},

		/**
		 * Returns the mesh displaying the drawing in the scene
		 * @return {THREE.Mesh} the drawing mesh
		 */
        getDrawingMesh : function () {
			this.__initDrawing();
			return this.__drawingMesh;
		},

		/**
		 * updates the view after the drawing canvas is modified
		 */
		updateDrawingCanvas : function () {
			this.fireEvent("changeDrawing");
		},

		/**
		 * informs whether the drawing canvas has been modified or not
		 * @return {Boolean} true/false
		 */
		isDrawingCanvasModified : function () {
			return this.__drawingCanvasModified;
		},

		/**
		 * resets canvas modification flag
		 */
		setDrawingCanvasNotModified : function () {
			this.__drawingCanvasModified = false;
		},

		/**
		 * Returns the first slice present in the view. This slice defines
		 * the volume bounding box, spacing etc..
		 * @return {desk.VolumeSlice} first volume slice present in the view.
		 *  Returns 'null' if no slice is present
		*/
		getFirstSlice : function () {
			return _.find(this.__slices, function (slice) {
				return !slice.getUserData('toDelete') && (slice.isReady());
			});
		},

		/**
		 * Sets paint color
		 * @param color {Color}
		 */
		setPaintColor : function (color) {
			this.__initDrawing();
			this.__paintColor = color;
			this.__updateBrush();
		},

		/**
		 * Sets paint width (in pixels)
		 * @param width {Integer} paint width (in pixels)
		 */
		setPaintWidth : function (width) {
			this.__initDrawing();
			this.__paintWidth = width;
			this.__updateBrush();
		},

		/**
		 * Removes all volumes from the view.
		*/
		removeAllVolumes : function () {
			this.removeVolumes(this.__slices.map(function (o) {return o;}));
		},

		/**
		 * Removes a volume from the view.
		 * @param slice {desk.VolumeSlice} slice to remove
		*/
		removeVolume : function (slice) {
			if (!_.includes(this.__slices, slice)) return;

			var mesh = slice.getUserData("mesh");

			if (mesh) {
				this.getScene().remove(mesh);
				//release GPU memory
				mesh.material.uniforms.texture.value.dispose();
				mesh.material.dispose();
				mesh.geometry.dispose();
				this.removeListenerById( slice.getUserData( "__sliceViewListener" ) );
				this.render();
				slice.dispose();
				this.__slices = _.without(this.__slices, slice);
			} else {
				// the slice has not been loaded yet, postpone deletetion
				slice.setUserData('toDelete', true);
			}
		},

		/**
		 * Removes volumes stored in an array from the view.
		 * @param slices {Array} array of slices to remove
		*/
		removeVolumes : function (slices) {
			if (slices) slices.forEach(this.removeVolume, this);
		},

		__reorientationContainer : null,

		/**
		 * rotates the camera/directions overlays
		 * @param direction {Number} direction (-1 : clockwise, 1 : trigonometric)
		 **/
		 rotate : function (direction) {
			this.getLinks().forEach(function (link) {
				if(link.isOrientationChangesOperateOnCamera()) {
					var camera = link.getCamera();
					var controls = link.getControls();
					var dir = controls.target.clone();
					dir.sub(camera.position);
					var up = camera.up;
					dir.cross(up).normalize().multiplyScalar(direction);
					up.copy(dir);
					controls.update();
					link.render();
				} else {
					var overlays = link.__directionOverlays;
					if (direction < 0) {
						var tempValue = overlays[0].getValue();
						for (var i = 0; i < 3; i++) {
							overlays[i].setValue(overlays[i + 1].getValue());
						}
						overlays[3].setValue(tempValue);
					} else {
						tempValue = overlays[3].getValue();
						for (var i = 3; i > 0; i--) {
							overlays[i].setValue(overlays[i - 1].getValue());
						}
						overlays[0].setValue(tempValue);
					}
				}
			});
		},

		/**
		 * flips the camera/directions overlays
		 * @param orientation {Number} orientation (0 : x, 1 : y)
		 **/
		flip : function (orientation) {
			this.getLinks().forEach(function (link) {
				if(link.isOrientationChangesOperateOnCamera()) {
					if (orientation) {
						link.getCamera().up.negate();
					}
					link.setCameraZ( - link.getCameraZ());
					link.render();
				} else {
					var overlays = link.__directionOverlays;
					var tempValue = overlays[1 - orientation].getValue();
					overlays[1 - orientation].setValue(overlays[3 - orientation].getValue());
					overlays[3 - orientation].setValue(tempValue);
				}
			});
		},

		/**
		 * returns the array of orientation overlays
		 * @return {Array} array of orientation labels
		 */
		getOverLays : function() {
			return this.__directionOverlays;
		},

		/**
		 * returns the UI container containing orientation controls
		 * @return {qx.ui.container.Composite} orientation container
		 */
		getReorientationContainer : function () {
			if (this.__reorientationContainer) {
				return this.__reorientationContainer;
			}

			var container = this.__reorientationContainer =
				new qx.ui.container.Composite();
			var gridLayout = new qx.ui.layout.Grid(3, 3);
			for (var i = 0; i < 2; i++) {
				gridLayout.setRowFlex(i, 1);
				gridLayout.setColumnFlex(i, 1);
			}
			container.set({layout : gridLayout,	decorator : "main"});

			[{label : "Rotate left", cb : function () {this.rotate(1);}},
				{label : "Rotate right", cb : function () {this.rotate(-1);}},
				{label : "Flip X", cb : function () {this.flip(0);}},
				{label : "Flip Y", cb : function () {this.flip(1);}}
			].forEach(function (params, index) {
				var button = new qx.ui.form.Button(params.label);
				button.addListener("execute", params.cb, this);
				container.add(button, {row: index > 1 ? 1 : 0, column: index % 2});
			}, this);

			return container;
		},

		/**
		 * duplicates camera position on all linked views
		 */
		propagateCameraToLinks : function () {
			this.getLinks().forEach(function (link) {
				if (this === link) return;
				link.getControls().copy(this.getControls());
				link.setSlice(this.getSlice());
				link.setCameraZ(this.getCameraZ());
				link.render();
			}, this);
		},

		/**
		 * fired after each camera Z change
		 * @param z {Float} the new z cordinate
		 */
		__applyCameraZ : function (z) {
			this.getCamera().position.z = z;
			this.getControls().update();
			this.render();
		},

		/**
		 * creates the blue cross meshes
		 * @param volumeSlice {desk.VolumeSlice} the reference slice
		 */
		__createCrossMeshes : function (volumeSlice) {
			var coord = volumeSlice.get2DCornersCoordinates();
			var material = new THREE.LineBasicMaterial({color : 0x4169FF,
				linewidth : 2, opacity : 0.5, transparent : true,
			  polygonOffset: true,
        polygonOffsetFactor: -2.0,
        polygonOffsetUnits: -10.0});

			this.__crossMeshes.forEach(function (mesh) {
				this.getScene().remove(mesh);
				mesh.geometry.dispose();
			}, this);

			function v(x,y,z) {return new THREE.Vector3(x,y,z)}
			this.__crossMeshes =  [
				[v(coord[0], 0, 1), v(coord[2], 0, 1)],
				[v(0, coord[1], 1), v(0, coord[5], 1)]
			].map(function (coords) {
				var geometry = new THREE.Geometry();
				geometry.vertices.push(coords[0], coords[1]);
				var line = new THREE.Line(geometry, material);
				line.renderOrder = 900;
				this.getScene().add(line);
				return line;
			}, this);
		},

		__coordinatesRatio : null,
		__brushCanvas : null,

		/**
		 * creates the brush mesh
		 * @param volumeSlice {desk.VolumeSlice} the reference slice
		 */
		__createBrushMesh : function (volumeSlice) {
			var geometry = new THREE.PlaneBufferGeometry( 1, 1);
			var coordinates = volumeSlice.get2DCornersCoordinates();
			var dimensions = volumeSlice.get2DDimensions();

			this.__coordinatesRatio =
				[(coordinates[2] - coordinates[0]) / dimensions[0],
				(coordinates[5] - coordinates[3]) / dimensions[1]];

			var width = 100;
			var height = 100;

			var canvas = this.__brushCanvas = this.__brushCanvas ||
				new qx.ui.embed.Canvas().set({syncDimension: true,
					canvasWidth: width,	canvasHeight: height,
					width: width,	height: height
			});

			var texture = new THREE.DataTexture(new Uint8Array(width * height * 4),
				width, height, THREE.RGBAFormat);
			texture.generateMipmaps = false;
			texture.needsUpdate = true;
			texture.magFilter = texture.minFilter = THREE.NearestFilter;

			var material = new THREE.MeshBasicMaterial({map:texture, transparent: true});
			material.side = THREE.DoubleSide;

			var mesh = new THREE.Mesh(geometry,material);
			mesh.renderOrder = 1000;
			this.__brushMesh = mesh;
			this.__updateBrush();

			mesh.visible = false;
			this.getScene().add(mesh);
		},

		/**
		 * refreshes the brush according to the color and width
		 */
		__updateBrush : function() {
			var canvas = this.__brushCanvas;
			var ctx = canvas.getContext2d();
			var width = canvas.getCanvasWidth();
			var height = canvas.getCanvasHeight();

			// recreate brush image
			if (this.isEraseMode()) {
				ctx.fillStyle = "white";
				ctx.fillRect (0, 0, width, height);
				ctx.fillStyle = "black";
				ctx.fillRect (10, 10, width-20, height-20);
			} else {
				ctx.clearRect (0, 0, width, height);
				ctx.lineWidth = 0;
				ctx.strokeStyle = ctx.fillStyle = this.__paintColor;
				ctx.beginPath();
				ctx.arc(width / 2, height / 2, width/2,
					0, 2 * Math.PI, false);
				ctx.closePath();
				ctx.fill();
			}

			// upload image to texture
			var length = width * height * 4;
			var data = ctx.getImageData(0, 0, width, height).data;
			var material = this.__brushMesh.material;
			var brushData = material.map.image.data;
			for (var i = length; i--;) {
				brushData[i] = data[i];
			}
			material.map.needsUpdate = true;

			// update vertices coordinates
			var radius = this.__paintWidth / 2;
			var ratio = this.__coordinatesRatio;
			var r0 = radius * ratio[0];
			var r1 = radius * ratio[1];
			var positions = this.__brushMesh.geometry.attributes.position;
			positions.setXYZ(0, -r0, -r1, 0);
			positions.setXYZ(1, r0, -r1, 0);
			positions.setXYZ(2, -r0, r1, 0);
			positions.setXYZ(3, r0, r1, 0);
			positions.needsUpdate = true;
		},

		/**
		 * creates the drawing mesh
		 * @param volumeSlice {desk.VolumeSlice} the reference slice
		 */
		__setDrawingMesh : function (volumeSlice) {
			var geometry = new THREE.PlaneBufferGeometry(1, 1);
			var coords = volumeSlice.get2DCornersCoordinates();
			var vertices = geometry.attributes.position;

			// flip Y axis
			vertices.setXYZ(0, coords[4], coords[5], 0);
			vertices.setXYZ(1, coords[6], coords[7], 0);
			vertices.setXYZ(2, coords[0], coords[1], 0);
			vertices.setXYZ(3, coords[2], coords[3], 0);

			var width = this.__2DDimensions[0];
			var height = this.__2DDimensions[1];

			this.__drawingCanvas.set({canvasWidth: width,
				canvasHeight: height, width: width,	height: height
			});
			this.__drawingCanvas.getContext2d().clearRect(0, 0, width, height);

			var dataColor = new Uint8Array( width * height * 4);

			var texture = new THREE.DataTexture(dataColor, width, height, THREE.RGBAFormat);
			texture.generateMipmaps = false;
			texture.needsUpdate = true;
			texture.magFilter = THREE.NearestFilter;
			texture.minFilter = THREE.NearestFilter;

			var material = new THREE.MeshBasicMaterial( {map:texture, transparent: true});
			material.side = THREE.DoubleSide;

			var mesh = new THREE.Mesh(geometry,material);
			mesh.renderOrder = 800;

			this.getScene().add(mesh);
			if (this.__drawingMesh) {
				this.getScene().remove(this.__drawingMesh);
				this.__drawingMesh.geometry.dispose();
				this.__drawingMesh.material.map.dispose();
				this.__drawingMesh.material.dispose();
				this.removeListenerById(this.__drawingListeners[0]);
				this.removeListenerById(this.__drawingListeners[1]);
			}
			this.__drawingMesh = mesh;

			geometry.computeFaceNormals();
			geometry.computeVertexNormals();
			geometry.computeBoundingSphere();

			var dl1 = this.addListener('changeDrawing', function() {
				var data = this.__drawingCanvas.getContext2d().getImageData(
					0, 0, width, height).data;
				for (var i = width * height * 4; i--;) {
					dataColor[i] = data[i];
				}
				texture.needsUpdate = true;
				this.render();
			}, this);

			var dl2 = this.addListener("changePaintOpacity", function (event) {
				mesh.material.opacity = event.getData();
				this.render();
			}, this);

			this.__drawingListeners = [dl1, dl2];
		},

		// listeners Ids to get rid of when changing drawing canvas
		__drawingListeners : null,

		/**
		 * changes slice position
		 * @param volumeSlice {desk.VolumeSlice} the slice to update
		 */
		__updateVolumeSlicePosition : function ( volumeSlice ) {

			if ( !this.__origin ) return; // race condition here : first slice might not be ready (to fix...)

			var index = volumeSlice.getZIndex();
			var position = this.__origin[ index ] + this.getSlice() * this.__spacing[ index ];
			volumeSlice.setPosition( position );

		},

		/**
		 * adds a slice to the scene
		 * @param slice {desk.VolumeSlice} the slice to add
		 * @param callback {Function} callback when done
		 * @param context {Object} optional callback context
		 */
		__addSlice : function ( slice, callback, context ) {
			var geometry = new THREE.PlaneBufferGeometry( 1, 1 );
			var coords = slice.get2DCornersCoordinates();
			var vertices = geometry.attributes.position;

			for ( var i = 0; i < 4; i++ ) {

				vertices.setXYZ( i, coords[ 2 * i ], coords[ 2 * i + 1 ], 0 );

			}

			this.__updateVolumeSlicePosition( slice );

			var listener = this.addListener( 'changeSlice', function () {

				this.__updateVolumeSlicePosition( slice );

			} );

			slice.setUserData( "__sliceViewListener", listener );

			slice.addListener( 'changePosition', function () {

				var position = slice.getPosition();
				var index = slice.getZIndex();
				var sliceNumber = Math.round( ( position - this.__origin[ index ] )
					/ this.__spacing[ index ] );
				sliceNumber = Math.max( 0, Math.min( sliceNumber, this.__slider.getMaximum() ) );
				this.setSlice( sliceNumber );

			}, this );

			var material = slice.getMaterial();
			var mesh = new THREE.Mesh( geometry, material );
			mesh.renderOrder = this.__slices.length;
			slice.setUserData( "mesh", mesh );
			geometry.computeFaceNormals();
			geometry.computeVertexNormals();
			geometry.computeBoundingSphere();

			slice.addListenerOnce( 'changeImage', function () {

				this.getScene().add( mesh );
				callback.call( context );

			}, this );

			slice.addListener( 'changeImage', function () {

				this.render();

			}, this);

		},

		__initDrawingDone : false,

		/**
		 * Initializes drawing
		 */
		__initDrawing : function () {
			if (this.__initDrawingDone) return;
			var volumeSlice = this.getFirstSlice();
			this.__setDrawingMesh(volumeSlice);
			this.__createBrushMesh(volumeSlice);
			this.__initDrawingDone = true;
		},

		/**
		 * Inits all objects from given slice
		 * @param slice {desk.VolumeSlice} first slice
		 */
		__initFromVolume : function ( slice ) {
			this.__initDrawingDone = false;
			this.__slider.setMaximum(slice.getNumberOfSlices() - 1);
			if (!this.__alwaysDisplaySlider) {
				this.__slider.setVisibility(slice.getNumberOfSlices() === 1 ? "hidden" : "visible");
			}

			var camera = this.getCamera();
			var position = camera.position;
			camera.up.set(0, 1, 0);
			var coordinates = slice.get2DCornersCoordinates();

			position.set(0.5 * (coordinates[0] + coordinates[2]),
				0.5 * (coordinates[3] + coordinates[5]), 0);
			this.getControls().target.copy(position);
			position.z = slice.getBoundingBoxDiagonalLength() * 0.6;
			this.setCameraZ(slice.getBoundingBoxDiagonalLength() * 0.6);

			this.__intersection = new THREE.Vector3();
			this.__2DCornersCoordinates = coordinates;
			this.__2DSpacing = slice.get2DSpacing();
			this.__2DDimensions = slice.get2DDimensions();
			this.__origin = slice.getOrigin();
			this.__spacing = slice.getSpacing();

			this.__createCrossMeshes(slice);

			if (this.__orientation == 1) {
				this.flip(1);
				this.rotate(1);
				this.flip(0);//
			}

			//this.flip(0);


			//if (this.__orientation == 0) this.flip(1);


			this.__position[0] = undefined; // to force cross position update

			//Set at the middle
			this.setCrossPosition(slice.getDimensions().map(function (dim) {
				return dim === 1 ? 0 : Math.round(dim / 2);
			}));

		},

		/** adds a volume to the view
		 * @param file {String} : file to add
		 * @param parameters {Object} : optional parameters
		 * @param callback {Function} : node.js-style callback when done
		 * @param context {Object} : optional callback context
		 * @return {desk.VolumeSlice} : displayed volume
		 */
		addVolume : function (file, parameters, callback, context) {
			if ( typeof parameters === "function" ) {
				callback = parameters;
				context = callback;
				parameters = {};
			}
			callback = callback || function () {};

			var isFirstSlice = this.__slices.every( function ( slice ) {
				return slice.getUserData( 'toDelete' ) === true;
			} );

			var slice = new desk.VolumeSlice(file,
				this.__orientation, parameters, function () {
					if ( slice.getUserData( 'toDelete' ) ) {
						this.__slices = _.without( this.__slices, slice );
						slice.dispose();
						return;
					}
					if ( isFirstSlice ) { this.__initFromVolume( slice ); }
					this.__addSlice( slice, callback, context );
			}, this );
			this.__slices.push( slice );
			return slice;
		},

		/**
		 * Sets the cross position given mouse event
		 * @param event {qx.event.type.Mouse} mouse event
		 */
		__setCrossPositionFromEvent : function (event) {
			var position = this.getPositionOnSlice(event);
			if (position.i === undefined) return;

			var v = [position.i, position.j].map(function (v, index) {
				return Math.max(0, Math.min(this.__2DDimensions[index] - 1, v));
			}, this);

			this.setCrossPosition([
				[v[0], this.getSlice(), v[0]][this.__orientation],
				[v[1], v[1], this.getSlice()][this.__orientation],
				[this.getSlice(), v[0], v[1]][this.__orientation]]);
		},

		__position : [],

		/**
		 * Return the cross position i.e. i,j,k coordinates
		 * @return {Array} ijk coordinates
		 */
		getCrossPosition : function () {
			return this.__position;
		},

		/**
		 * Return the cross position i.e. x, y, z float coordinates
		 * @return {THREE.Vector3} xyz coordinates
		 */
		getCrossFloatPosition : function () {
			return new THREE.Vector3().fromArray(this.__position.map(
				function (coord, index) {
					return this.__origin[index] + coord * this.__spacing[index];
			}, this));
		},

		/**
		 * Sets the cross position i.e. i,j,k coordinates
		 * @param pos {Array} ijk coordinates
		 */
		setCrossPosition : function (pos) {
			if ((this.__position[0] === pos[0]) &&
				(this.__position[1] === pos[1]) &&
				(this.__position[2] === pos[2])) {
					return;
			}
			this.__position = pos;

			if (!this.__2DDimensions) {return;}

			var x = pos[[0, 2, 0][this.__orientation]];
			var y = this.__2DDimensions[1] - 1 - pos[[1, 1, 2][this.__orientation]];

			x = this.__2DCornersCoordinates[0] + (0.5 + x) * this.__2DSpacing[0];
			y = this.__2DCornersCoordinates[5] - (0.5 + y) * this.__2DSpacing[1];

			this.__crossMeshes[0].position.setY(y);
			this.__crossMeshes[1].position.setX(x);
			this.setSlice(pos[[2, 0, 1][this.__orientation]]);
			this.render();

			this.fireEvent("changeCrossPosition");
			this.getLinks().forEach(function (link) {
				if (link === this) {return};
				link.setCrossPosition(pos);
			}, this);
		},

		/**
		* interactionMode :
		* -1 : nothing
		* 0 : left click
		* 1 : zoom
		* 2 : pan
		* 3 : paint
		* 4 : erase
		* */
		__interactionMode : -1,

		/**
		 * fired at each mouse down event
		 * @param e {qx.event.type.Mouse} mouse event
		 */
		 __onMouseDown : function (e) {
			var controls = this.getControls();
			this.__interactionMode = 0;
			var origin, position, width;
			if (e.isRightPressed() || e.isCtrlPressed()) {
				this.__interactionMode = 1;
				origin = this.getContentLocation();
				controls.mouseDown(this.__interactionMode,
					e.getDocumentLeft() - origin.left,
					e.getDocumentTop() - origin.top);
			} else if ((e.isMiddlePressed())||(e.isShiftPressed())) {
				this.__interactionMode = 2;
				origin = this.getContentLocation();
				controls.mouseDown(this.__interactionMode,
					e.getDocumentLeft()-origin.left,
					e.getDocumentTop()-origin.top);
			} else if (this.isPaintMode()) {
				this.__interactionMode = 3;
				this.__saveDrawingToUndoStack();
				position = this.getPositionOnSlice(e);
				var ctx = this.__drawingCanvas.getContext2d();
				var i = position.i + 0.5;
				var j = position.j + 0.5;
				var paintColor = this.__paintColor;
				width = this.__paintWidth;
				ctx.lineWidth = 0;
				ctx.strokeStyle = paintColor;
				ctx.fillStyle = paintColor;
				ctx.beginPath();
				ctx.arc(i, j, width/2, 0, 2*Math.PI, false);
				ctx.closePath();
				ctx.fill();
				ctx.lineJoin = "round";
				ctx.lineWidth = width;
				ctx.beginPath();
				ctx.moveTo(i, j);
				ctx.closePath();
				ctx.stroke();
				this.__drawingCanvasModified = true;
				this.updateDrawingCanvas();
			} else if (this.isEraseMode()) {
				this.__interactionMode = 4;
				this.__saveDrawingToUndoStack();
				position = this.getPositionOnSlice(e);
				var x = Math.round(position.i) + 0.5;
				var y = Math.round(position.j) + 0.5;
				width = this.__paintWidth;
				var radius = width / 2;
				this.__drawingCanvas.getContext2d().clearRect(
					x - radius, y - radius, width, width);
				this.__drawingCanvasModified = true;
				this.updateDrawingCanvas();
			} else {
				this.__setCrossPositionFromEvent(e);
			}
		},

		/**
		 * fired at each mouse out event
		 * @param event {qx.event.type.Mouse} mouse event
		 */
		__onMouseOut : function (event) {
			if (this.__sliderInUse) {return;}
			this.__viewOn = false;
			if (!this.__alwaysDisplaySlider) {
				this.__rightContainer.setVisibility("hidden");
			}
			
			//this.__directionOverlays[3].setLayoutProperties({right: 1, top:"45%"});
			
			if (this.__brushMesh) this.__brushMesh.visible = false;
			this.render();
		},

		/**
		 * fired at each mouse move event
		 * @param event {qx.event.type.Mouse} mouse event
		 */
		__onMouseMove : function (event) {
			this.__viewOn = true;
			var controls = this.getControls();
			if (this.__rightContainer.getVisibility() === "hidden") {
				this.__directionOverlays[3].setLayoutProperties({right: "8%", top: "45%"});
				this.__rightContainer.setVisibility("visible");
			}

			var brushMesh = this.__brushMesh;
			var position;
			switch (this.__interactionMode) {
			case -1:
				if (this.isPaintMode() || this.isEraseMode()) {
					position = this.getPositionOnSlice(event);
					brushMesh.visible = true;
					brushMesh.position.set(position.x, position.y, 0);
					this.render();
				}
				return;
			case 0 :
				this.__setCrossPositionFromEvent(event);
				break;
			case 1 :
				if (brushMesh) brushMesh.visible = false;
				var origin = this.getContentLocation();
				controls.mouseMove(event.getDocumentLeft() - origin.left,
					event.getDocumentTop() - origin.top);

				var z = this.getCamera().position.z;
				this.setCameraZ(z);
				this.propagateCameraToLinks();
				break;
			case 2 :
				if (brushMesh) brushMesh.visible = false;
				origin = this.getContentLocation();
				controls.mouseMove(event.getDocumentLeft() - origin.left,
						event.getDocumentTop() - origin.top);
				this.render();
				this.propagateCameraToLinks();
				break;
			case 3 :
				position = this.getPositionOnSlice(event);
				brushMesh.visible = true;
				brushMesh.position.set(position.x, position.y, 0);
				var ctx = this.__drawingCanvas.getContext2d();
				ctx.lineTo(position.i + 0.5, position.j + 0.5);
				ctx.stroke();
				this.updateDrawingCanvas();
				this.__drawingCanvasModified = true;
				break;
			case 4 :
			default :
				position = this.getPositionOnSlice(event);
				brushMesh.visible = true;
				brushMesh.position.set(position.x, position.y, 0);
				var x = Math.round(position.i) + 0.5;
				var y = Math.round(position.j) + 0.5;
				var width = this.__paintWidth;
				var radius = width / 2;
				this.__drawingCanvas.getContext2d().clearRect(
					x - radius, y - radius, width, width);
				this.__drawingCanvasModified = true;
				this.updateDrawingCanvas();
				break;
			}
			this.capture();
		},

		/**
		 * fired at each mouse up event
		 * @param event {qx.event.type.Mouse} mouse event
		 */
		__onMouseUp : function (event)	{
			this.releaseCapture();
			this.getControls().mouseUp();
			if ((this.isPaintMode()) && (this.__interactionMode == 3)) {
				var ctx = this.__drawingCanvas.getContext2d();
				var position = this.getPositionOnSlice(event);

				ctx.lineWidth = 0;
				ctx.strokeStyle = ctx.fillStyle = this.__paintColor;
				ctx.beginPath();
				ctx.arc(position.i + 0.5, position.j + 0.5,
					this.__paintWidth / 2, 0, 2 * Math.PI, false);
				ctx.closePath();
				ctx.fill();
				this.updateDrawingCanvas();
			}
			this.__interactionMode = -1;
		},

		/**
		 * fired at each mouse wheel event
		 * @param event {qx.event.type.MouseWheel} mouse event
		 */
		__onMouseWheel : function (event) {
			var delta = event.getWheelDelta() < 0 ? -1 : 1;

			if (this.__zoomOnWheel) {
				this.getControls().zoomFactor(delta*0.02);
				this.render();

				var z = this.getCamera().position.z;
				this.setCameraZ(z);

				this.propagateCameraToLinks();

			} else {
				var slider = this.__slider;

				slider.setValue(Math.min(slider.getMaximum(), Math.max(
					slider.getValue() + delta, slider.getMinimum())));
				}
		},

		__intersection : null,
		__2DCornersCoordinates : null,
		__2DDimensions : null,
		__2DSpacing : null,
		__origin : null,
		__spacing : null,

		/**
		 * returns the position from the mouse event
		 * @param event {qx.event.type.Mouse} mouse event
		 * @return {Object} coordinates  : ijk and xyz
		 */
		get3DPosition : function (event) {
			var coordinates = this.getPositionOnSlice(event);
			var slice = this.getSlice();
			switch (this.__orientation) {
			case 0 :
				return {
					i : coordinates.i,
					j : coordinates.j,
					k : slice,
					x : coordinates.x,
					y : coordinates.y,
					z : this.__origin[2] + this.__spacing[2] * slice
				};

			case 1 :
				return {
					i : slice,
					j : coordinates.j,
					k : coordinates.i,
					x : this.__origin[0] + this.__spacing[0] * slice,
					y : coordinates.y,
					z : coordinates.x
				};
			case 2 :
			default :
				return {
					i : coordinates.i,
					j : slice,
					k : coordinates.j,
					x : coordinates.x,
					y : this.__origin[1] + this.__spacing[1] * slice,
					z : coordinates.y
				};
			}
		},

		/**
		 * returns the 2D position on slice
		 * @param event {qx.event.type.Mouse} mouse event
		 * @return {Object} coordinates  : ij and xy
		 */
		getPositionOnSlice : function (event) {
			if (!this.__intersection) {return {};}
			var origin = this.getContentLocation();
			var x = event.getDocumentLeft() - origin.left;
			var y = event.getDocumentTop() - origin.top;

			var elementSize = this.getInnerSize();
			var x2 = ( x / elementSize.width ) * 2 - 1;
			var y2 = - ( y / elementSize.height ) * 2 + 1;

			var intersection = this.__intersection.set( x2, y2, 0);
			var coordinates = this.__2DCornersCoordinates;
			var dimensions = this.__2DDimensions;
			intersection.unproject(this.getCamera());

			var cameraPosition = this.getCamera().position;
			intersection.sub(cameraPosition).
				multiplyScalar(-cameraPosition.z/intersection.z).
				add( cameraPosition );
			var xinter = intersection.x;
			var yinter = intersection.y;

			var intxc=Math.floor((xinter-coordinates[0])*dimensions[0]/(coordinates[2]-coordinates[0]));
			var intyc=dimensions[1] - 1- Math.floor((yinter-coordinates[5])*dimensions[1]/(coordinates[1]-coordinates[5]));
			return {i :intxc, j :intyc, x:xinter, y:yinter};
		},

		/**
		 * creates the UI
		 */
		__createUI : function () {
			this.__drawingCanvas = new qx.ui.embed.Canvas().set({
				syncDimension: true
			});

			this.getRenderer().setClearColor( 0x000000, 1 );

			var font = new qx.bom.Font(16, ["Arial"]);
			font.setBold(true);
			var settings = {textColor : this.__textColor,
				font : font, opacity : 0.5};
			qx.util.DisposeUtil.disposeTriggeredBy(font, this);

			var labels = [
				["Ve", "Ga", "Do", "Dr"],
				["Av", "Ve", "Ar", "Do"],
				["Av", "Ga", "Ar", "Dr"]][this.__orientation];

		  var name = [
		    "Axial",
		    "Sagittal",
		    "Coronal"
		  ][this.__orientation];

			var directionOverlays = this.__directionOverlays = [
				{left: "50%", top:"1%"},
				{left: "1%", top:"45%"},
				{left: "50%", bottom:"1%"},
				{right: 45, top:"45%"}
			].map(function (position, index) {
				var label = new qx.ui.basic.Label(labels[index]).set(settings);
				this.add(label, position);
				return label;
			}, this);

			var nameLabel = new qx.ui.basic.Label(name);
			nameLabel.set({font : font, opacity : 0.75,
				textColor : this.__textColor});
			this.add(nameLabel, {bottom :5, left :10});


			var label = this.__sliceLabel = new qx.ui.form.TextField("0");
			
			
			label.set({textAlign: "center", width : 37, font : font,
				textColor : this.__textColor, backgroundColor:"transparent", filter:/[0-9]/});
		  
		  label.addListener("mousedown", function(event) {
		    event.stopPropagation();
		  });
		  
		  window.loopGuard = false;  
		  
		  label.addListener('changeValue', function () {
		    if (!qx.ui.core.FocusHandler.getInstance().isActive(label)) return;
		    
		    label.blur();
		    
				var slice = this.getFirstSlice();
				if (!slice) return;
				
				if (window.loopGuard !== true) {
				  window.loopGuard = true;
				  this.setSlice(slice.getNumberOfSlices() - 1 - parseInt(label.getValue()) );
				  window.loopGuard = false;
				}
		  }, this);

			var slider = this.__slider = new qx.ui.form.Slider().set (
				{minimum : 0, maximum : 100, value : 0,	width :30,
					opacity : 1, backgroundColor : desk.VolumeSlice.COLORS[this.__orientation],
					orientation : "vertical"
			});
			slider.addListener('mousedown', function () {
				this.__sliderInUse = true;
			}, this)
			slider.addListener('mouseup', function () {
				this.__sliderInUse = false;
			}, this)
			slider.addListener("changeValue",function(e){
				var slice = this.getFirstSlice();
				if (!slice) return;
				this.setSlice(slice.getNumberOfSlices() - 1 - e.getData());
			}, this);

			slider.addListener("mouseover",function(e){
				slider.focus();
			}, this);

			slider.addListener('mousewheel', function(e) { e.stopPropagation()});

			if (this.options.maxZoom)
			  this.getControls().setMaxZoom(this.options.maxZoom)
			if (this.options.minZoom)
			  this.getControls().setMinZoom(this.options.minZoom)

			this.addListener("keypress", function (evt) {
			  var delta = 0;
        if (evt.getKeyIdentifier() == "Down") {
          delta = -1;
        } else if (evt.getKeyIdentifier() == "Up") {
          delta = 1;
        }
        else
          return;
          
        var slice = this.getFirstSlice();
        
        if (!slice) return;
        this.setSlice(slice.getSlice()+delta);
      });

			var container = this.__rightContainer =
				new qx.ui.container.Composite(new qx.ui.layout.VBox());
			container.add(new qx.ui.core.Spacer(25, 25));
			container.add(slider, {flex : 1});

			if (!this.__alwaysDisplaySlider) {
				container.setVisibility("hidden");
			}

			container.addListener('mousedown', function (event) {
				event.stopPropagation();
			}, this);
			this.add(container, {right : 0, top : 0, height : "100%"});
			
			this.add(label, {top :0, right :0});
		},

		// this member is true only when user is manipulating the slider
		__sliderInUse : false,

		__sliceLabel : null,

		/**
		 * fired at each slice change
		 * @param sliceId {Integer} the new slice id
		 */
		__applyChangeSlice : function (sliceId) {
			// something fishy here : getNumberOfSlices should never be 0 but it is sometimes...
			var slice = this.getFirstSlice();
			if (!slice) {
				return;
			}

			var value = slice.getNumberOfSlices() - 1 - sliceId;

			this.__sliceLabel.setValue(value + "");

			this.__slider.setValue(Math.max(this.__slider.getMinimum(),
				Math.min(value, this.__slider.getMaximum())));

			var pos = this.__position.slice();
			pos[[2, 0, 1][this.__orientation]] = sliceId;
			this.setCrossPosition(pos);
			this.propagateCameraToLinks();
		},

		__undoData : null,
		__redoData : null,
		__doingIndex : null,

		/**
		 * fired each time ctrl-z is used
		 * @param event {qx.event.type.KeyInput} keyboard event
		 */
		__onCtrlZ : function (event) {
			if(!this.__viewOn) return;
			var undoData = this.__undoData;
			var doingIndex = this.__doingIndex;
			if (!undoData.length || (doingIndex < 0)) return;
			if(doingIndex === undoData.length - 1) {
				this.__saveDrawingToUndoStack();
			}
			var canvas = this.__drawingCanvas;
			var ctx = canvas.getContext2d();
			var image = canvas.getContext2d().getImageData(
				0, 0, canvas.getWidth(), canvas.getHeight());
			ctx.clearRect(0, 0, canvas.getCanvasWidth(),
				canvas.getCanvasHeight());
			var currData = undoData[doingIndex];
			ctx.putImageData(currData, 0, 0);
			this.__doingIndex = doingIndex - 1;
			this.updateDrawingCanvas();
		},

		/**
		 * fired each time ctrl-y is used
		 * @param event {qx.event.type.KeyInput} keyboard event
		 */
		__onCtrlY : function (event) {
			if(! this.__viewOn) return;
			var undoData = this.__undoData;
			if(!undoData.length) return;
			this.__doingIndex++;
			if (this.__doingIndex + 1 < undoData.length) {
				var canvas = this.__drawingCanvas;
				var ctx = canvas.getContext2d();
				ctx.clearRect(0, 0,
					canvas.getCanvasWidth(),canvas.getCanvasHeight());
				var currData = undoData[this.__doingIndex + 1];
				ctx.putImageData(currData, 0, 0);
				if(this.__doingIndex === undoData.length-1)
					undoData.pop();
				this.updateDrawingCanvas();
			}
			else {this.__doingIndex--;}
		},

		/**
		 * Setups undo framework
		 */
		__initUndo : function () {
			this.__undoData = [];
			this.__redoData = [];
			this.__doingIndex = 0;
			var undoCommand = new qx.ui.command.Command("Ctrl+Z");
			undoCommand.addListener("execute", this.__onCtrlZ, this);
			var redoCommand = new qx.ui.command.Command("Ctrl+Y");
			redoCommand.addListener("execute", this.__onCtrlY, this);
			this.addListener("changeSlice", function (event) {
				this.__undoData = [];
			}, this);
			qx.util.DisposeUtil.disposeTriggeredBy(undoCommand, this);
			qx.util.DisposeUtil.disposeTriggeredBy(redoCommand, this);
		},

		/**
		 * Saves current drawing image to the stack
		 */
		__saveDrawingToUndoStack : function () {
			var canvas = this.__drawingCanvas;
			var image = canvas.getContext2d().getImageData(
				0, 0, canvas.getWidth(), canvas.getHeight());
			var undoData = this.__undoData;
			if (undoData.length === 10) {undoData.shift();}
			undoData.push(image);
			var redos2Discard = undoData.length -2 - this.__doingIndex; // -1 because it is about indexes, -1 to have the length before the saving
			for(var i = 0; i < redos2Discard; i++) // discard unused redo data
				undoData.pop();
			this.__doingIndex = undoData.length - 1;
		}
	}
});

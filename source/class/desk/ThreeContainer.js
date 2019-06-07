/**
* A container which includes a THREE.js scene, camera, controls and renderer
 * @ignore(THREE.*)
 * @ignore(WEBGL.*)
 * @ignore(requestAnimationFrame)
 * @ignore(Blob)
 * @ignore(_.debounce)
 * @ignore(Uint8Array)
 * @lint ignoreDeprecated (alert)
*/
qx.Class.define("desk.ThreeContainer",
{
	extend : qx.ui.container.Composite,
	include : desk.LinkMixin,

	/**
	* Constructor
	* @param opts {Object} options
	*/
	construct : function( opts ) {
		if (typeof opts === "function") opts = {};
		opts = opts || {};
		this.base(arguments);
		this.setLayout(new qx.ui.layout.Canvas());
		this.__initialCameraFront = new THREE.Vector3().set( 0, 0, -1 );
		this.__initialCameraUp =  new THREE.Vector3().set( 0, 1, 0 );

		if ( opts.cameraFront ) {
			Array.isArray( opts.cameraFront ) ? this.__initialCameraFront.fromArray( opts.cameraFront ) : this.__initialCameraFront.copy( opts.cameraFront )
		}

		if ( opts.cameraUp ) {
			Array.isArray( opts.cameraUp ) ? this.__initialCameraUp.fromArray( opts.cameraUp ) : this.__initialCameraUp.copy( opts.cameraUp )
		}

		if ( !desk.ThreeContainer.__garbageContainer) {
			desk.ThreeContainer.__garbageContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox());
		}

		var threeCanvas = this.__threeCanvas = desk.ThreeContainer.__garbageContainer.getChildren()[0] 
			|| new qx.ui.embed.Canvas();

		threeCanvas.set({syncDimension : true, zIndex : 0});
		var canvas = threeCanvas.getContentElement().getCanvas();

		if (!WEBGL.isWebGLAvailable()) alert("Error! : webGL is not available! Check your configuration");

		var scene = this.__scene = new THREE.Scene();
		var camera = this.__camera = opts.orthographic ? new THREE.OrthographicCamera() : new THREE.PerspectiveCamera();
		var controls = this.__controls = new THREE.TrackballControls2(camera, canvas);
		controls.zoomSpeed = 6;
		scene.add(camera);

		if (opts.cameraFov) {
		  camera.fov = opts.cameraFov;
		}

		// lights
		var dirLight = new THREE.DirectionalLight( 0x888888 );
		dirLight.position.set(200, 200, 1000).normalize();
		camera.add(dirLight);
		camera.add(dirLight.target);
		scene.add(new THREE.AmbientLight(0x666666));

		// renderer
		var renderer = this.__renderer = new THREE.WebGLRenderer({
			canvas : canvas,
			antialias: true,
			alpha : true,
			premultipliedAlpha : false
		});
		renderer.setClearColor( 0xffffff, 1 );

		this.__listenerId = threeCanvas.addListener("resize", this.__resizeThreeCanvas, this);
		this.add(threeCanvas, {width : "100%", height : "100%"});
		this.__resizeThreeCanvas();
		this.__setupFullscreen();

		this.viewAllSync = this.viewAll;
		this.viewAll = _.debounce( this.viewAll, 20, { leading : true } );

		this.tempVector3 = new THREE.Vector3();
	},

	destruct : function(){
		this.__threeCanvas.removeListenerById(this.__listenerId);
		desk.ThreeContainer.__garbageContainer.add(this.__threeCanvas);

		var ctx = this.__threeCanvas.getContentElement().getCanvas().getContext("webgl");
		// clean webgl context;
		// from https://www.khronos.org/registry/webgl/sdk/debug/webgl-debug.js
		var numAttribs = ctx.getParameter(ctx.MAX_VERTEX_ATTRIBS);
		var tmp = ctx.createBuffer();
		ctx.bindBuffer(ctx.ARRAY_BUFFER, tmp);
		for (var ii = 0; ii < numAttribs; ++ii) {
			ctx.disableVertexAttribArray(ii);
			ctx.vertexAttribPointer(ii, 4, ctx.FLOAT, false, 0, 0);
			ctx.vertexAttrib1f(ii, 0);
		}
		ctx.deleteBuffer(tmp);

		var numTextureUnits = ctx.getParameter(ctx.MAX_TEXTURE_IMAGE_UNITS);
		for (var ii = 0; ii < numTextureUnits; ++ii) {
			ctx.activeTexture(ctx.TEXTURE0 + ii);
			ctx.bindTexture(ctx.TEXTURE_CUBE_MAP, null);
			ctx.bindTexture(ctx.TEXTURE_2D, null);
		}

		ctx.activeTexture(ctx.TEXTURE0);
		ctx.useProgram(null);
		ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, null);
		ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
		ctx.bindRenderbuffer(ctx.RENDERBUFFER, null);
		ctx.disable(ctx.BLEND);
		ctx.disable(ctx.CULL_FACE);
		ctx.disable(ctx.DEPTH_TEST);
		ctx.disable(ctx.DITHER);
		ctx.disable(ctx.SCISSOR_TEST);
		ctx.blendColor(0, 0, 0, 0);
		ctx.blendEquation(ctx.FUNC_ADD);
		ctx.blendFunc(ctx.ONE, ctx.ZERO);
		ctx.clearColor(0, 0, 0, 0);
		ctx.clearDepth(1);
		ctx.clearStencil(-1);
		ctx.colorMask(true, true, true, true);
		ctx.cullFace(ctx.BACK);
		ctx.depthFunc(ctx.LESS);
		ctx.depthMask(true);
		ctx.depthRange(0, 1);
		ctx.frontFace(ctx.CCW);
		ctx.hint(ctx.GENERATE_MIPMAP_HINT, ctx.DONT_CARE);
		ctx.lineWidth(1);
		ctx.pixelStorei(ctx.PACK_ALIGNMENT, 4);
		ctx.pixelStorei(ctx.UNPACK_ALIGNMENT, 4);
		ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, false);
		ctx.pixelStorei(ctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		// TODO: Delete this IF.
		if (ctx.UNPACK_COLORSPACE_CONVERSION_WEBGL) {
			ctx.pixelStorei(ctx.UNPACK_COLORSPACE_CONVERSION_WEBGL, ctx.BROWSER_DEFAULT_WEBGL);
		}
		ctx.polygonOffset(0, 0);
		ctx.sampleCoverage(1, false);
		ctx.scissor(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.stencilFunc(ctx.ALWAYS, 0, 0xFFFFFFFF);
		ctx.stencilMask(0xFFFFFFFF);
		ctx.stencilOp(ctx.KEEP, ctx.KEEP, ctx.KEEP);
		ctx.viewport(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT | ctx.STENCIL_BUFFER_BIT);

		// TODO: This should NOT be needed but Firefox fails with 'hint'
		while(ctx.getError());

		//clean the scene
		this.__scene = null;
		this.__renderer.dispose();
		this.__renderer = null;
		this.__threeCanvas = null;
		this.__camera = null;
		this._deleteMembers(this.__controls);
		this.__controls = null;
	},

	properties : {
		/**
		* in fullscreen mode, the container covers the entire browser window
		*/
		fullscreen : {init : false, check: "Boolean", event : "changeFullscreen"}
	},

	events : {
		/**
		 * fired before each render
		 */
		"beforeRender" : "qx.event.type.Event",

		/**
		 * fired after each render
		 */
		"render" : "qx.event.type.Event"
	},

	statics : {

		__garbageContainer : null

	},

	members : {

		__initialCameraFront : null,
		__initialCameraUp : null,

		/**
		 * removes membersin the object
		 * @param object {Object} object to clean
		 */
		_deleteMembers : function (object) {
			if (!object) return;
			Object.keys(object).forEach(function (key) {
			    delete object[key];
			});
		},

		/**
		 * updates all links
		 */
		 _propagateLinks : function () {
			this.getLinks().forEach(function (link) {
				if (this === link) {return;}
				link.getControls().copy(this.getControls());
				link.render();
			}, this);
		},

		__listenerId : null,

		/**
		 * configures widget for fullscreen
		 */
		 __setupFullscreen : function () {
			var parent, width, height, color, alpha, props;
			this.addListener('changeFullscreen', function (e) {
				if (!e.getData()) {
					this.set({height : height, width : width});
					this.__renderer.setClearColor(color, alpha);
					parent.add(this, props);
				} else {
					height = this.getHeight();
					width = this.getWidth();
					parent = this.getLayoutParent();
					props = this.getLayoutProperties();
					this.set ({width : window.innerWidth,
							height : window.innerHeight,
							zIndex : 500000});
					qx.core.Init.getApplication().getRoot().add(this);
					alpha = this.__renderer.getClearAlpha();
					color = this.__renderer.getClearColor();
					this.__renderer.setClearColor(color, 1);
				}
			}, this);
			this.addListener('keydown', function (event) {
				if ((event.getTarget() == this.getCanvas()) &&
                    (event.getKeyIdentifier() === 'F')) {
					this.toggleFullscreen();
				}
			}, this);
		},

		/**
		 * rotates current view
		 * @param thetaX {Number} : angle on the X axis
		 * @param thetaY {Number} : angle on the Y axis
		 * @param thetaZ {Number} : angle on the Z axis
		 */
		rotateView : function ( thetaX, thetaY, thetaZ ) {
			this.viewAll.flush();
			var controls = this.getControls();
			var backup = controls.enabled;
			controls.enabled = true;
			controls.mouseDown( 0, 0, 0 );
			controls.mouseMove( thetaX * controls.width / controls.rotateSpeed,
				thetaY * controls.height / controls.rotateSpeed );
			controls.mouseUp( );
			controls.mouseDown( 3, controls.width, 0 );
			controls.mouseMove( controls.width, controls.width * Math.sin( thetaZ ) );
			controls.mouseUp( );
			controls.enabled = backup;
			this.getCamera().rotateZ( thetaZ );
			controls.update( );
			this.render();
		},

		/**
		* Renders the scene
		* @param immediate {Boolean} triggers immediate rendering (without requestAnimationFrame)
		* @param callback {Function} optional callback when rendering is done
		*/
		render : function ( immediate, callback ) {

			if ( typeof immediate === 'function' ) {
				callback = immediate;
				immediate = false;
			}

			if ( callback ) {
				this.addListenerOnce( 'render', function () {
					callback();
				} );
			}

			if (immediate) {
				this.__render();
				return;
			}

			if ( this.__renderingTriggered ) return;
			this.__renderingTriggered = true;
			requestAnimationFrame( this.__render.bind( this ) );

		},

		__renderingTriggered : null,

		/**
		 * renders the scene
		 */
		__render : function () {
			this.__renderingTriggered = false;
			this.fireEvent("beforeRender");
			if (!this.__renderer) return;
			this.__renderer.render(this.__scene, this.__camera);
			this.fireEvent('render');
		},

		/**
		 * resize canvas
		 */
		__resizeThreeCanvas : function () {
			var width = this.__threeCanvas.getCanvasWidth();
			var height = this.__threeCanvas.getCanvasHeight();
			this.__renderer.setSize ( width, height, false );

			if (this.__camera instanceof THREE.PerspectiveCamera) {
				this.__camera.aspect = width / height;
			} else {
				this.__camera.left = - 0.5 * width;
				this.__camera.right = 0.5 * width;
				this.__camera.bottom = - 0.5 * height;
				this.__camera.top = 0.5 * height;
			}
			this.__camera.updateProjectionMatrix();
			this.__controls.setSize(width, height);
			this.__controls.update();
			this.render();
		},

		/**
		* Returns the canvas containing the output
		* @return {qx.ui.embed.Canvas} canvas containing the scene
		*/
		getCanvas : function() {
			return this.__threeCanvas;
		},

		/**
		* Returns the scene
		* @return {THREE.Scene} scene
		*/
		getScene : function() {
			return this.__scene;
		},

		/**
		* Returns the camera
		* @return {THREE.Camera} the camera
		*/
		getCamera : function() {
			return this.__camera;
		},

		/**
		* Returns the controls
		* @return {THREE.TrackballControls2} the controls
		*/
		getControls : function() {
			return this.__controls;
		},

		/**
		* Returns the renderer
		* @return {THREE.WebGLRenderer} the controls
		*/
		getRenderer : function () {
			return this.__renderer;
		},

		/**
		* Returns the viewpoint
		* @return {Object} the viewpoint
		*/
		getViewpoint : function () {
			return {
				controls : this.__controls.getState(),
				camera : this.__camera,
				bbdl : this.__boudingBoxDiagonalLength
			};
		},

		/**
		* sets viewpoint
		* @param viewpoint {Object} the viewpoint
		*/
		setViewpoint : function (viewpoint) {
			this.__camera.near = viewpoint.camera.near;
			this.__camera.far = viewpoint.camera.far;
			this.__controls.setState(viewpoint.controls);
			this.__boudingBoxDiagonalLength = viewpoint.bbdl;
		},

		// stores the scene bounding box diagonal length, usefull for updating
		__boudingBoxDiagonalLength : 0,

		/**
		* resets the camera to view all objects in the scene
		*/
		resetView : function () {
			this.__boudingBoxDiagonalLength = 0;
			this.viewAll();
			this.viewAll.flush();
		},

		tempVector3 : null,

		/**
		* Sets the camera to view all objects in the scene
		*/
		viewAll : function () {
			var bbox = new THREE.Box3().setFromObject( this.__scene );

			if ( bbox.isEmpty() ) {
				return;
			}

			var bbdl = bbox.getSize( this.tempVector3 ).length();
			var camera = this.__camera;
			var fovFactor = Math.tan(50 * Math.PI/180)/Math.tan(camera.fov * Math.PI/180);

			var controls = this.__controls;

			if (this.__boudingBoxDiagonalLength === 0) {
				var center = bbox.getCenter( this.tempVector3 );
				this.__boudingBoxDiagonalLength = bbdl;
				camera.position.copy( center );
				camera.position.sub(
					this.__initialCameraFront.clone().multiplyScalar( bbdl ) );
				camera.up.copy( this.__initialCameraUp );
				controls.target.copy( center );
			} else {
				var ratio = bbdl / this.__boudingBoxDiagonalLength;
				this.__boudingBoxDiagonalLength = bbdl;
				camera.position.sub(controls.target)
					.multiplyScalar(ratio)
					.add(controls.target);
			}

			if (camera instanceof THREE.PerspectiveCamera) {
				camera.near = bbdl / 1000;
				camera.far = bbdl * 1000;
				camera.zoom = 1;
			} else {
				camera.near = - bbdl * 10;
				camera.far = bbdl * 10;
				camera.zoom = ( camera.top + camera.right ) / bbdl;
			}

			camera.updateProjectionMatrix();
			controls.update();
			this.render();
			this._propagateLinks();
		},

		/**
		 * multiply canvas dimensions
		 * @param ratio {Float} ratio
		 */
		__multiplyDimensions : function (ratio) {
			var uuids = {};
			this.__scene.traverse(function (object) {
				var material = object.material;
				if (!material || uuids[material.uuid]) return;
				uuids[material.uuid] = material;

				if (material && material.linewidth) {
//					console.log("old linewidth : ", material.linewidth);
					material.linewidth *= ratio
//					console.log(material)
//					console.log("new linewidth : ", material.linewidth);
				} else if (material && material.wireframeLinewidth) {
//					console.log("old wireframelinewidth : ", material.wireframeLinewidth);
					material.wireframeLinewidth *= ratio;
//					console.log(material)
//					console.log("new wireframelinewidth : ", material.wireframeLinewidth);
				}
				material.needsUpdate = true;
			});
			if (ratio < 1) {ratio = 1};
			var size = this.__threeCanvas.getInnerSize();
			this.__renderer.setSize(Math.round(size.width * ratio), Math.round(size.height * ratio));
			this.__camera.aspect = size.width / size.height;
			this.__camera.updateProjectionMatrix();
		},

		/**
		* Triggers a snapshot of the scene which will be downloaded by the browser
		* @param opts {Object} options such as 'ratio' to multiplpy image dimensions,
		* 'file' to choose file name or 'path' to write to server
		*/
		snapshot : function (opts) {
			opts = opts || {};
			var ratio = opts.ratio || 1;

			this.__threeCanvas.setSyncDimension(false);
			this.__multiplyDimensions(ratio);

			this.render(true);
			var dataURL = this.__renderer.domElement.toDataURL("image/png");
			if (opts.path) {
				var saveData = dataURL.replace("image/png", "image/octet-stream");
				var commaIndex = dataURL.lastIndexOf(",");

				desk.Actions.execute({
					action : "write_binary",
					file_name : desk.FileSystem.getFileName(opts.path),
					base64data : dataURL.substring(commaIndex + 1, dataURL.length),
					output_directory : desk.FileSystem.getFileDirectory(opts.path)
				}, opts.callback);
			} else {
				var binary = atob(dataURL.split(',')[1]);
				var array = [];
				for(var i = 0; i < binary.length; i++) {
					array.push(binary.charCodeAt(i));
				}
				var blob =  new Blob([new Uint8Array(array)], {type: 'image/png'});
				var a = document.createElement('a');
				a.href = window.URL.createObjectURL(blob);
				var date = new Date();
				a.download = opts.file || "snapshot-"+ date.getFullYear() + "-" +
					(date.getMonth() + 1) + "-"+ date.getDate() + "_" +
					date.getHours() + "h" + date.getMinutes() + "mn" +
					date.getSeconds() + "s" +  ".png";
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			}

			// restore wireframe width
			this.__multiplyDimensions(1.0 / ratio);
			this.__threeCanvas.setSyncDimension(true);
			this.render();
		},

		__threeCanvas : null,
		__scene : null,
		__camera : null,
		__controls : null,
		__renderer : null
	}

});

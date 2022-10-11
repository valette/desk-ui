/**
* @ignore(THREE.*)
* @ignore(Uint8Array)
* @ignore (_.*)
* @ignore (MHD.parse)
* @lint ignoreDeprecated(alert)
*/

qx.Class.define("desk.MPR.Volume", 
{
	extend : qx.ui.container.Composite,

	/**
	 * Constructor
	 * @param file {String} input volume file
	 * @param viewer {desk.MPR.Container} MPR container to add volume to
	 * @param opts {Object} optional additional options
	 * @param callback {Function} callback when slicing is finished
	 * @param context {Objext} optional context for the callback
	 */
	construct : function(file, viewer, options, callback, context) {
		this.base(arguments);
		this.__MPRContainer = viewer;
		this.__file = file;

		if (typeof options === "function") {
			callback = options;
			options = {};
			context = callback;
		}

		this.__options = options = options || {};
		callback = callback || function () {};
		this.__slices = new Map();
		if ( options.opacity != null ) this.setVolumeOpacity ( options.opacity );
		if ( options.format != null ) this.setImageFormat( options.format );
		if ( options.visible != null ) this.setVisible( options.visible );
		this.setLayout( new qx.ui.layout.VBox() );
		this.setDecorator("main");
		this.set({toolTipText : file});

		this.add( this.getLabelContainer() );
		const cont = new qx.ui.container.Composite();
		cont.setLayout( new qx.ui.layout.HBox() );
		cont.add( this.getBrightnessContrastButton() );
		cont.add( this.getOptionsButton() );
		cont.add( this.getOpacitySlider(), {flex : 1} );
		cont.add( this.getHideShowCheckBox() );
		this.add( cont );

		// drag and drop support
		this.setDraggable(true);
		this.addListener("dragstart", function(e) {
			e.addAction("alias");
			e.addType("volumeSlices");
			e.addType("VolumeViewer");
			e.addType("file");
		});

		this.addListener("droprequest", e => {
			const type = e.getCurrentType();
			switch (type) {
				case "volumeSlices":
					e.addData(type, this.__slices);
					break;
				case "VolumeViewer":
					e.addData(type, viewer);
					break;
				case "file":
					e.addData(type, file);
					break;
				default :
					alert ("type "+type+"not supported for drag and drop");
					break;
			}
		} );

		this.__addVolumeToViewers().then( () => callback.call( context, null, this ) )
			.catch( e => callback.call( context, e, this ) ); 

	},

	destruct : function () {
		for ( let slice of this.__slices.values() ) slice.dispose();
		this.__slices.clear();
	},

	properties : {

		/**
		 * current Image format
		 */
		imageFormat : { init : 1, check: "Number", event : "changeImageFormat"},

		/**
		 * current opacity
		 */
		volumeOpacity : { init : 1, check: "Number", event : "changeVolumeOpacity", apply : "__applyVolumeOpacity" },

		/**
		 * current brightness
		 */
		brightness : { init : 0, check: "Number", event : "changeBrightness", apply : "_applyBrightness" },

		/**
		 * current contrast
		 */
		contrast : { init : 1, check: "Number", event : "changeContrast"},

		/**
		 * tells whether the volume is loaded or not
		 */
		ready : { init : false, check: "Boolean", event : "changeReady"},

		/**
		 * visibility
		 */
		visible : { init : true, check: "Boolean", event : "changeVisible", apply : "__applyVisible" }

	},

	events : {
		/**
		 * fired whenever the image changes
		 */
		"changeImage" : "qx.event.type.Event"
	},

	members : {
		__file : null,
		__fileObject : null,
		__options : null,
		__slices : null,
		__MPRContainer : null,
		__labelContainer : null,
		__hideShowCheckBox : null,
		__brightnessContrastButton : null,
		__opacitySlider : null,
		__optionsButton : null,

		
		/**
		 * waits for the volume to be ready
		 */
		ready : async function () {
			if ( this.isReady() ) return;
			await new Promise ( res => this.addListenerOnce( "changeReady", res ) );
		},

		/**
		 * gets the volume label container
		 * @return {qx.ui.container.Composite} the label container
		 */
		getLabelContainer : function() {

			if ( this.__labelContainer ) return this.__labelContainer;
			let baseName = desk.FileSystem.getFileName(this.__file);
			const baseLength = baseName.length;
			if ( baseLength > 25 ) {
				baseName = baseName.substring(0, 10) + '...' +
					baseName.substring(baseLength - 10);
			}

			const labelcontainer = this.__labelContainer = new qx.ui.container.Composite();
			labelcontainer.setLayout( new qx.ui.layout.HBox() );
			const label = new qx.ui.basic.Label( baseName );
			if (this.__options.label) label.setValue(this.__options.label);
			label.setTextAlign("left");
			labelcontainer.add(label, {flex : 1});		
			return labelcontainer;

		},

		/**
		 * sets a specific Lookup Table of a loaded volume
		 * @param LUT {Array} an array of 4 lookuup tables [red, green blue, alpha]
		 */
		setLUT : function ( LUT ) {

			this.getSlices().forEach( s => s.setLookupTables( LUT ) );

		},

		/**
		 * returns the Lookup Table of the
		 * @return {Array} an array of 4 lookuup tables [red, green blue, alpha]
		 */
		getLUT : function (volume) {

			return this.getSlices()[ 0 ].getLookupTables();

		},

		/** Returns the file corresponding to the given volume
		 * @return {String} file corresponding to the volume
		 */
		getFile : function (volume) {

			return this.__file;

		},

		/**
		 * returns an array containing volumes slices
		 * @return {Array} array of desk.MPR.Slice
		 */
		getSlices : function () {
			return Array.from( this.__slices.values() );
		},

		/**
		 * returns an array containing meshes
		 * @return {Array} array of THREE.Mesh
		 */
		getMeshes : function () {
			return this.__slices.entries().map( entry =>
				entry[ 0 ].getMesh( entry[ 1 ] ) ).filter( m => m );
		},

		/**
		 * Reloads the volume
		 */
		update : function () {
			this.getSlices().forEach( slice => slice.update() );
		},

		/**
		 * sets brightness for a given volume
		 * @param brightness {Number} brightness
		 */
		_applyBrightness : function ( b ) {

			this.getSlices().forEach( slice => slice.setBrightness( b ) );

		},

		/**
		 * sets contrast for a given volume
		 * @param contrast {Number} contrast
		 */
		_applyContrast : function ( c ) {

			this.getSlices().forEach( slice => slice.setContrast( c ) );

		},

		/**
		 * gets the hide/show checkbox
		 * @return {qx.ui.form.CheckBox} the checkbox
		 */
		getHideShowCheckBox : function() {

			if ( this.__hideShowCheckBox ) return this.__hideShowCheckBox;
			const box = this.__hideShowCheckBox = new qx.ui.form.CheckBox();
			box.set( {value : this.getVisible(),toolTipText : "visible/hidden" } );
			box.bind( "value", this, "visible" );
			return box;

		},

		__applyVisible : function ( visible ) {
			for ( let slice of this.getSlices() )
				slice.getUserData("mesh").visible = visible;
			this.__MPRContainer.render();
		},

		/**
		 * gets the brightness/contrast button
		 * @return {qx.ui.form.Button} the button
		 */
		getBrightnessContrastButton : function () {
			if ( this.__brightnessContrastButton ) return this.__brightnessContrastButton;
			const button = this.__brightnessContrastButton = new desk.MPR.BrightnessContrastButton(null, "desk/contrast.png");
			
			button.set({toolTipText : "Click and drag to change brightnes, right-click to reset brightness"});

			let x, y;

			button.addListener( "pointerdown", event => {
				if (event.isRightPressed()) {
					for ( let slice of this.getSlices() )
						slice.setBrightnessAndContrast(0, 1);
				} else {
					x = event.getScreenLeft();
					y = event.getScreenTop();
				}
			} );

			button.addListener( "pointermove", event => {
				if (!button.isCapturing()) return;
				const newX = event.getScreenLeft();
				const newY = event.getScreenTop();
				const deltaX = newX - x;
				const deltaY = newY - y;
				const slices = this.getSlices();
				let contrast = slices[0].getContrast();
				let brightness = slices[0].getBrightness();
				brightness -= deltaY / 300;
				contrast *= 1 + deltaX / 300;
				x = newX;
				y = newY;
				for ( let slice of slices )
					slice.setBrightnessAndContrast(brightness,contrast);

			} );
			return button;
		},

		/**
		 * gets the opacity slider
		 * @return {qx.ui.form.Slider} the slider
		 */
		getOpacitySlider : function () {

			if ( this.__opacitySlider ) return this.__opacitySlider;
			const slider = this.__opacitySlider = new qx.ui.form.Slider( "horizontal");
			slider.set({value : this.getVolumeOpacity() * 100, toolTipText : "change opacity", minimum : 0, maximum : 100 } );

			slider.addListener("changeValue", event => {
				this.setVolumeOpacity(event.getData() / 100);
			} );

			this.addListener("changeVolumeOpacity", e => {
				slider.setValue( Math.round( e.getData() * 100 ) );
			} );

			return slider;

		},

		/**
		 * sets opacity of a volume
		 * @param opacity {Number} opacity
		 */
		__applyVolumeOpacity : function ( opacity ) {

			this.getSlices().forEach( s => s.setOpacity( opacity ) );

		},


		/**
		 * returns the options button
		 * @return {qx.ui.form.MenuButton} the button
		 */
		 getOptionsButton : function () {
			if ( this.__optionsButton ) return this.__optionsButton;

			const menu = new qx.ui.menu.Menu();
			const propertiesButton = new qx.ui.menu.Button("properties");
			propertiesButton.addListener("execute", () => {
				function formatArray(array) {
					var result="[";
					for (var i=0;i<array.length;i++) {
						result+=array[i];
						if (i<array.length-1){
							result+=", ";
						}
					}
					result+="]";
					return result;
				}

				const slice = this.getSlices()[0];
				const window = new qx.ui.window.Window().set({
					caption : slice.getFileName(),
					layout : new qx.ui.layout.VBox(),
					showMinimize : false});
				window.setResizable(false,false,false,false);
				window.add(new qx.ui.basic.Label("volume : "+slice.getFileName()));
				window.add(new qx.ui.basic.Label("dimensions : "+formatArray(slice.getDimensions())));
				window.add(new qx.ui.basic.Label("extent : "+formatArray(slice.getExtent())));
				window.add(new qx.ui.basic.Label("origin : "+formatArray(slice.getOrigin())));
				window.add(new qx.ui.basic.Label("spacing : "+formatArray(slice.getSpacing())));
				window.add(new qx.ui.basic.Label("scalarType : "+slice.getScalarType()+" ("+slice.getScalarTypeAsString()+")"));
				window.add(new qx.ui.basic.Label("scalar bounds : "+formatArray(slice.getScalarBounds())));
				window.open();
				window.center();
			} );

			menu.add(propertiesButton);

			if( desk.Actions.getInstance().getSettings().permissions ) {

				const formatMenu = new qx.ui.menu.Menu();
				menu.add(new qx.ui.menu.Button( "image format", null, null, formatMenu ) );

				const formats = [ 'png', 'jpg' ];
				const buttons = formats.map( format =>
					new qx.ui.menu.RadioButton( format ) );

				buttons[ this.getImageFormat() ].setValue( true );

				buttons.forEach( ( button, format ) => {

					formatMenu.add( button );

					button.addListener( "changeValue", e => {

						if ( !e.getData() ) return;
						buttons[ 1 - format ].setValue( false );

						for ( let slice of this.getSlices() )
							slice.setImageFormat( format );

					} );

				} );

				for ( let slice of this.getSlices() )
					slice.addListener( "changeImageFormat", e => {
						buttons[ e.getData() ].setValue( true );
					} );

			}

			var appearanceMenu = new qx.ui.menu.Menu();
			menu.add(new qx.ui.menu.Button("appearance", null, null, appearanceMenu));

			var colormapButton = new qx.ui.menu.Button("color map");
			colormapButton.addListener("execute", function () {
				this.__createColormapWindow();
				},this);
			appearanceMenu.add(colormapButton);

			var brightnessButton = new qx.ui.menu.Button("set brightness");
			brightnessButton.addListener("execute", () => {
				this.setBrightness( parseFloat( prompt( "brightness?" ) ) );
			} );
			appearanceMenu.add(brightnessButton);

			var contrastButton = new qx.ui.menu.Button("set contrast");
			contrastButton.addListener("execute", () => {
				this.setContrast( parseFloat( prompt( "contrast?" ) ) );
			} );
			appearanceMenu.add(contrastButton);

			qx.util.DisposeUtil.disposeTriggeredBy(menu, this);
			this.__optionsButton = new qx.ui.form.MenuButton( null, "icon/16/categories/system.png", menu );
			return this.__optionsButton;

		},

		/**
		 * creates the 'colors' window
		 * @param volume {qx.ui.container.Composite} the volume to modify
		 */
		__createColormapWindow : function() {
			var win = new qx.ui.window.Window().set ({
				caption : "colors for " + this.__file,
				layout : new qx.ui.layout.HBox(),
				showClose : true,
				showMinimize : false
			});

			var ramp = new Uint8Array(256);
			var zeros = new Uint8Array(256);
			var randomRed = new Uint8Array(256);
			var randomGreen = new Uint8Array(256);
			var randomBlue = new Uint8Array(256);

			for (var i = 0; i < 256; i++) {
				ramp[i] = i;
				zeros[i] = 0;
				randomRed[i] = Math.floor(Math.random()*255);
				randomGreen[i] = Math.floor(Math.random()*255);
				randomBlue[i] = Math.floor(Math.random()*255);
			}

			var group = new qx.ui.form.RadioButtonGroup().set({layout : new qx.ui.layout.VBox()});
			win.add(group);

			[{name : "reds", lut : [ramp, zeros, zeros]},
				{name : "greens", lut : [zeros, ramp, zeros]},
				{name : "blues", lut : [zeros, zeros, ramp]},
				{name : "random reds", lut : [randomRed, zeros, zeros]},
				{name : "random greens", lut : [zeros, randomGreen, zeros]},
				{name : "random blues", lut : [zeros, zeros, randomBlue]},
				{name : "random colors", lut : [randomRed, randomGreen, randomBlue]},
				{name : "grey levels", lut : null},
				{name : "other colors", lut : this.getLUT()}
			].forEach(function (colors, index) {
				if (!colors.lut && (index > 7)) return;
				var button = new qx.ui.form.RadioButton(colors.name);
				button.setUserData('lut', colors.lut);
				group.add(button);
				group.setSelection([button]);
			});

			group.addListener("changeSelection", function (e) {
				this.setLUT( e.getData()[0].getUserData('lut') );
			}, this);
			win.open();
			win.center();
		},

		__addVolumeToViewers : async function () {

			if (typeof this.__file == "string") this.__fileObject = this.__file;
			else if ( this.__file.constructor == File) {

				this.__fileObject = this.__file;
				this.__file = this.__file.name;

			}

			if ( this.__options.slicer ) {

				const promise = new Promise( res => {

					const slicerOpts = {

						onprogress : function (text) {
						//$('#progress').text(text);
						//console.log(text);
						},

						onload : function (properties) {
							console.log("Load finished ! properties : ", properties);
							res( slicer );
						},

						local: fileObject.constructor == File || typeof fileObject == "string" ,
						worker : this.__options.worker
					};

					const slicer = new desk.MPR.Slicer( fileObject, slicerOpts );

				} );

				const slicer = await promise;
				// Change options.slicer from "true" to reference to worker slicerWorker,
				// allow to pass it to viewers
				this.__options.slicer = slicer;
//				volume.setUserData("slicer", slicer);

			}

			for ( let viewer of this.__MPRContainer.getViewers() ) {
				await new Promise( ( res, err ) => {

					function cb( e ) {
						if ( e ) return err( e );
						res();
					}

					const slice = viewer.addSlice( this.__file, this.__options, cb );
					this.__slices.set( viewer, slice );

				} )

			}

			if ( this.__options.visible !== undefined) {
				this.__hideShowCheckBox.setValue( this.__options.visible );
			}
			this.setReady( true );
		}

	}
});

/**
* @ignore(THREE.*)
* @ignore(Uint8Array)
* @ignore (_.*)
* @ignore (MHD.parse)
* @lint ignoreDeprecated(alert)
*/

/*
 3 possible orientations :
	0 : XY Z
	1 : ZY X
	2 : XZ Y
*/

qx.Class.define("desk.MPR.Slice",
{
	extend : qx.core.Object,

	/**
	 * Constructor
	 * @param file {String} volume to slice
	 * @param orientation {Number} orientation, equals to 0, 1 or 2
	 * @param opts {Object} optional additional options
	 * @param callback {Function} callback when slicing is finished
	 * @param context {Objext} optional context for the callback
	 */
	construct : function(file, orientation, opts, callback, context) {
		this.base(arguments);

		this.__oldGetUserData = this.getUserData; // deprecate getUserData( "mesh" )
		this.getUserData = this.__newGetUserData; // deprecate getUserData( "mesh" )

		if ( !desk.Actions.getAction('slice_volume' ) && !opts.slicer ) {
			var message = "Error : action volume_slice is not installed. Please install binary addons to slice volumes."
			alert(message);
			throw new Error(message);
		}

		if (typeof(opts) == "function") {
			context = callback;
			callback = opts;
			opts = {};
		}

		if (opts.slicer) {
			opts.format = 0;
			this.__slicer = opts.slicer;
		}

		this.setOrientation(orientation);
		this.__materials = [];

		this.__opts = opts = opts || {};
		if (opts.format != null) {
			this.setImageFormat(opts.format);
		}
		if (opts.imageFormat != null) {
			this.setImageFormat(opts.imageFormat);
			console.error('desk.MPR.Slice : option "imageFormat" is deprecated. Use option "format"');
		}

		if (opts.opacity != null) {
			this.__opacity = opts.opacity;
		}

		if (opts.LUTFactor) {
			this.__LUTFactor = opts.LUTFactor;
		}

		if (opts.contrast) {
			this.__contrast = opts.contrast;
		}

		if (opts.brightness !== undefined) {
			this.__brightness = opts.brightness;
		}

		this.__file = file;

		if ( !opts.slicer)  {

			var image = this.__image = new Image();
			image.onload = () => {
				clearTimeout(this.__timeout);
				for ( let material of this.__materials )
					material.uniforms.imageType.value = this.__availableImageFormat;

				this.__texture.needsUpdate = true;

				if (this.__numberOfScalarComponents === 1) {
					this.__contrastMultiplier = 1 / Math.abs(this.__scalarMax - this.__scalarMin);
					this.__brightnessOffset = - this.__scalarMin * this.__contrastMultiplier;
				}
				this.setBrightnessAndContrast(this.__brightness, this.__contrast);
			};
			image.onerror = image.onabort = this.update.bind(this);
			this.__texture = new THREE.Texture(image);

		} else
			this.__texture = new THREE.DataTexture();

		var filter = opts.linearFilter ? THREE.LinearFilter : THREE.NearestFilter;
		this.__texture.onUpdate = () => {
			this.__texture.uploadedVersion = this.__texture.version;
			this.__texture.source.uploadedVersion = this.__texture.source.version;
		};
		this.__texture.uploadedVersion = 0;
		this.__texture.source.uploadedVersion = 0;

		this.__lookupTable = new THREE.DataTexture(new Uint8Array(8), 2, 1, THREE.RGBAFormat);

		if ( !opts.slicer)  {

			[this.__lookupTable, this.__texture].forEach( texture => {
				texture.generateMipmaps = false;
				texture.magFilter = texture.minFilter =
					this.getImageFormat() ? filter : THREE.NearestFilter;
			});

		} else {

			this.__texture.generateMipmaps = false;
			this.__texture.magFilter = this.__texture.minFilter = filter;
			this.__texture.type = THREE.FloatType;
			this.__texture.format = THREE.LuminanceFormat;
			this.__texture.flipY = true;
			this.__lookupTable.generateMipmaps = false;
			this.__lookupTable.magFilter = this.__lookupTable.minFilter = filter;

		}

		this.addListener("changeImageFormat", this.update, this);
		this.addListener("changePosition", this.__onChangePosition, this);

		if (opts.colors) {
			this.setLookupTables(opts.colors);
		}

		this.update(callback, context);
	},

	properties : {
		/**
		 * current slice index
		 */
		slice : { init : -1, check: "Number", event : "changeSlice", apply : "__updateImage"},

		/**
		 * current position in object coordinates
		 */
		position : { init : 1e30, check: "Number", event : "changePosition"},

		/**
		 * current orientation
		 */
		orientation : { init : 0, check: "Number", event : "changeOrientation"},

		/**
		 * current Image format
		 */
		imageFormat : { init : 1, check: "Number", event : "changeImageFormat"}
	},

	events : {
		/**
		 * fired whenever the image changes
		 */
		"changeImage" : "qx.event.type.Event"
	},

	statics : {
//		COLORS : ["blue", "red", "yellow"],
		COLORS : ["#009FE3", "#CD1719", "#FFED00"],

		VERTEXSHADER : [
			"varying vec2 vUv;",
			"varying vec3 vPosition;",
			"void main( void ) {",
			"	vUv = uv;",
			"	vPosition = position;",
			"	gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1);",
			"}"
		].join("\n"),

		FRAGMENTSHADERBEGIN : [
			"precision highp float;",
			"uniform sampler2D imageTexture;",
			"uniform sampler2D lookupTable;",
			"uniform float lutRatio;",
			"uniform float useLookupTable;",
			"uniform float contrast;",
			"uniform float brightness;",
			"uniform float opacity;",
			"uniform float imageType;",
			"uniform float scalarMin;",
			"uniform float scalarMax;",
			"uniform float dimX;",
			"uniform float dimY;",
			"varying vec2 vUv;",

			"highp float easeInOutQuad(highp float t) {",
			"    return t<.5 ? 2.0*t*t : -1.0+(4.0-2.0*t)*t;",
			"}",

			"highp float decode32(highp vec4 rgba) {",
			"    highp float Sign = 1.0 - step(128.0,rgba[0])*2.0;",
			"    highp float Exponent = 2.0 * mod(rgba[0],128.0) + step(128.0,rgba[1]) - 127.0; ",
			"    highp float Mantissa = mod(rgba[1],128.0)*65536.0 + rgba[2]*256.0 +rgba[3] + float(0x800000);",
			"    highp float Result =  Sign * exp2(Exponent) * (Mantissa * exp2(-23.0 )); ",
			"    return Result;",
			"}",

            "float getValueFloat( sampler2D imageTexture, highp vec2 vUv ) {",
			"vec4 rawData = texture2D( imageTexture, vUv );",
			"vec4 rawBytes = floor(rawData*vec4(255.0)+vec4(0.5));",
			"float Sign = 1.0 - step(128.0,rawBytes[3])*2.0 ;",
			"float Exponent = 2.0 * mod(rawBytes[3],128.0) + step(128.0,rawBytes[2]) - 127.0;",
			"float Mantissa = mod(rawBytes[2],128.0)*65536.0 + rawBytes[1]*256.0 +rawBytes[0]+ 8388608.0;",
			"return Sign * Mantissa * pow(2.0,Exponent - 23.0);",
			"}",

            "float getValueUShort( sampler2D imageTexture, highp vec2 vUv ) {",
			"vec4 rawData = texture2D( imageTexture, vUv );",
			"vec4 rawBytes = floor(rawData*vec4(255.0)+vec4(0.5));",
			"return rawBytes[0] + 256.0 * rawBytes[3];",
			"}",

            "float getValueShort( sampler2D imageTexture, highp vec2 vUv ) {",
			"vec4 rawData = texture2D( imageTexture, vUv );",
			"vec4 rawBytes = floor(rawData*vec4(255.0)+vec4(0.5));",
			"return rawBytes[0]+ 256.0 * rawBytes[3] - 65536.0 * step ( 128.0, rawBytes[3] );",
			"}",

            "float getValueChar( sampler2D imageTexture, highp vec2 vUv ) {",
			"vec4 rawData = texture2D( imageTexture, vUv );",
			"vec4 rawBytes = floor(rawData*vec4(255.0)+vec4(0.5));",
			"return rawBytes[0] - 256.0 * step ( 128.0, rawBytes[0] );",
			"}",

			"void main() {",
				"vec4 rawData = texture2D( imageTexture, vUv );",
				"vec4 rawBytes = floor(rawData*vec4(255.0)+vec4(0.5));"
		].join("\n"),

		FRAGMENTSHADERCHARNEAREST : [
			"// for char",
			"float value = rawBytes[0] - 256.0 * step ( 128.0, rawBytes[0] );"
		].join("\n"),

		FRAGMENTSHADERCHARLINEAR : [
			"// for float",
			"highp vec2 vUv2 = vec2( vUv[ 0 ] * dimX , vUv[ 1 ] * dimY );",
			"highp vec2 vUvFloor = floor( vUv2 );",
			"highp vec2 vUvCeil = vec2( vUvFloor[ 0 ] + 1.0, vUvFloor[ 1 ] + 1.0 );",
			"highp vec2 vUvOffset = vUv2 - vUvFloor;",
			"vUvFloor[ 0 ] /= dimX;",
			"vUvFloor[ 1 ] /= dimY;",
			"vUvCeil[ 0 ] /= dimX;",
			"vUvCeil[ 1 ] /= dimY;",
			"highp vec2 vUvTopLeft = vec2( vUvFloor[ 0 ], vUvCeil[ 1 ] );",
			"highp vec2 vUvBottomRight = vec2( vUvCeil[ 0 ], vUvFloor[ 1 ] );",
			"vec4 rawData2 = texture2D( imageTexture, vUv );",
            "float valueBottomLeft = getValueChar( imageTexture, vUvFloor );",
            "float valueTopRight = getValueChar( imageTexture, vUvCeil );",
            "float valueTopLeft = getValueChar( imageTexture, vUvTopLeft );",
            "float valueBottomRight = getValueChar( imageTexture, vUvBottomRight );",
            "float value1 = mix( valueBottomLeft, valueBottomRight, vUvOffset[ 0 ] );",
            "float value2 = mix( valueTopLeft, valueTopRight, vUvOffset[ 0 ] );",
            "float value = mix( value1, value2, vUvOffset[ 1 ] );"
		].join("\n"),

		FRAGMENTSHADERUCHAR : [
			"// for uchar",
			"float value = rawBytes[0];"
		].join("\n"),

		FRAGMENTSHADERSHORTNEAREST : [
			"// for short",
			"float value = rawBytes[0]+ 256.0 * rawBytes[3] - 65536.0 * step ( 128.0, rawBytes[3] );"
		].join("\n"),

		FRAGMENTSHADERSHORTLINEAR : [
			"// for float",
			"highp vec2 vUv2 = vec2( vUv[ 0 ] * dimX , vUv[ 1 ] * dimY );",
			"highp vec2 vUvFloor = floor( vUv2 );",
			"highp vec2 vUvCeil = vec2( vUvFloor[ 0 ] + 1.0, vUvFloor[ 1 ] + 1.0 );",
			"highp vec2 vUvOffset = vUv2 - vUvFloor;",
			"vUvFloor[ 0 ] /= dimX;",
			"vUvFloor[ 1 ] /= dimY;",
			"vUvCeil[ 0 ] /= dimX;",
			"vUvCeil[ 1 ] /= dimY;",
			"highp vec2 vUvTopLeft = vec2( vUvFloor[ 0 ], vUvCeil[ 1 ] );",
			"highp vec2 vUvBottomRight = vec2( vUvCeil[ 0 ], vUvFloor[ 1 ] );",
			"vec4 rawData2 = texture2D( imageTexture, vUv );",
            "float valueBottomLeft = getValueShort( imageTexture, vUvFloor );",
            "float valueTopRight = getValueShort( imageTexture, vUvCeil );",
            "float valueTopLeft = getValueShort( imageTexture, vUvTopLeft );",
            "float valueBottomRight = getValueShort( imageTexture, vUvBottomRight );",
            "float value1 = mix( valueBottomLeft, valueBottomRight, vUvOffset[ 0 ] );",
            "float value2 = mix( valueTopLeft, valueTopRight, vUvOffset[ 0 ] );",
            "float value = mix( value1, value2, vUvOffset[ 1 ] );"
		].join("\n"),


		FRAGMENTSHADERUSHORTNEAREST : [
			"// for ushort",
			"float value = rawBytes[0] + 256.0 * rawBytes[3];"
		].join("\n"),

		FRAGMENTSHADERUSHORTLINEAR : [
			"// for float",
			"highp vec2 vUv2 = vec2( vUv[ 0 ] * dimX , vUv[ 1 ] * dimY );",
			"highp vec2 vUvFloor = floor( vUv2 );",
			"highp vec2 vUvCeil = vec2( vUvFloor[ 0 ] + 1.0, vUvFloor[ 1 ] + 1.0 );",
			"highp vec2 vUvOffset = vUv2 - vUvFloor;",
			"vUvFloor[ 0 ] /= dimX;",
			"vUvFloor[ 1 ] /= dimY;",
			"vUvCeil[ 0 ] /= dimX;",
			"vUvCeil[ 1 ] /= dimY;",
			"highp vec2 vUvTopLeft = vec2( vUvFloor[ 0 ], vUvCeil[ 1 ] );",
			"highp vec2 vUvBottomRight = vec2( vUvCeil[ 0 ], vUvFloor[ 1 ] );",
			"vec4 rawData2 = texture2D( imageTexture, vUv );",
            "float valueBottomLeft = getValueUShort( imageTexture, vUvFloor );",
            "float valueTopRight = getValueUShort( imageTexture, vUvCeil );",
            "float valueTopLeft = getValueUShort( imageTexture, vUvTopLeft );",
            "float valueBottomRight = getValueUShort( imageTexture, vUvBottomRight );",
            "float value1 = mix( valueBottomLeft, valueBottomRight, vUvOffset[ 0 ] );",
            "float value2 = mix( valueTopLeft, valueTopRight, vUvOffset[ 0 ] );",
            "float value = mix( value1, value2, vUvOffset[ 1 ] );"
		].join("\n"),

		FRAGMENTSHADERFLOATLINEAR : [
			"// for float",
			"highp vec2 vUv2 = vec2( vUv[ 0 ] * dimX , vUv[ 1 ] * dimY );",
			"highp vec2 vUvFloor = floor( vUv2 );",
			"highp vec2 vUvCeil = vec2( vUvFloor[ 0 ] + 1.0, vUvFloor[ 1 ] + 1.0 );",
			"highp vec2 vUvOffset = vUv2 - vUvFloor;",
			"vUvFloor[ 0 ] /= dimX;",
			"vUvFloor[ 1 ] /= dimY;",
			"vUvCeil[ 0 ] /= dimX;",
			"vUvCeil[ 1 ] /= dimY;",
			"highp vec2 vUvTopLeft = vec2( vUvFloor[ 0 ], vUvCeil[ 1 ] );",
			"highp vec2 vUvBottomRight = vec2( vUvCeil[ 0 ], vUvFloor[ 1 ] );",
			"vec4 rawData2 = texture2D( imageTexture, vUv );",
            "float valueBottomLeft = getValueFloat( imageTexture, vUvFloor );",
            "float valueTopRight = getValueFloat( imageTexture, vUvCeil );",
            "float valueTopLeft = getValueFloat( imageTexture, vUvTopLeft );",
            "float valueBottomRight = getValueFloat( imageTexture, vUvBottomRight );",
            "float value1 = mix( valueBottomLeft, valueBottomRight, vUvOffset[ 0 ] );",
            "float value2 = mix( valueTopLeft, valueTopRight, vUvOffset[ 0 ] );",
            "float value = mix( value1, value2, vUvOffset[ 1 ] );"
		].join("\n"),

		FRAGMENTSHADERFLOATNEAREST : [
			"// for float",
			"float Sign = 1.0 - step(128.0,rawBytes[3])*2.0 ;",
			"float Exponent = 2.0 * mod(rawBytes[3],128.0) + step(128.0,rawBytes[2]) - 127.0;",
			"float Mantissa = mod(rawBytes[2],128.0)*65536.0 + rawBytes[1]*256.0 +rawBytes[0]+ 8388608.0;",
			"float value = Sign * Mantissa * pow(2.0,Exponent - 23.0);"
		].join("\n"),

		FRAGMENTSHADERFLOATSLICER : [
			"// for float with local slicer",
			"vec4 rawFloats = texture2D( imageTexture, vUv );",
			"float value = rawFloats.x;"
		].join("\n"),


		FRAGMENTSHADEREND : [
			"if (imageType == 1.0) {",
			"	value = scalarMin +  ( rawData[0] * ( scalarMax - scalarMin ));",
			"}",

			"float correctedValue = value * contrast + brightness;",

			"vec4 correctedColor = vec4(correctedValue);",
			"correctedColor[3] = opacity;",

			"float clampedValue=clamp(correctedValue * lutRatio, 0.0, 1.0);",
			"vec2 colorIndex=vec2(clampedValue,0.0);",
			"vec4 colorFromLookupTable = texture2D( lookupTable,colorIndex  );",
			"colorFromLookupTable[3] *= opacity;",
			"gl_FragColor=mix (correctedColor, colorFromLookupTable, useLookupTable);",
		].join("\n"),

		FRAGMENTSHADERENDOOC : [
			"//ooc",
			"float color = mix(value, rawBytes[0], imageType);",
			"float correctedPixelValue = color * contrast + brightness;",
			"vec4 correctedColor=vec4(correctedPixelValue);",
			"correctedColor[3]=opacity;",
			"float clampedValue=clamp(correctedPixelValue * lutRatio, 0.0, 1.0);",
			"vec2 colorIndex=vec2(clampedValue,0.0);",
			"vec4 colorFromLookupTable = texture2D( lookupTable,colorIndex  );",
			"colorFromLookupTable[3] *= opacity;",
			"gl_FragColor=mix (correctedColor, colorFromLookupTable, useLookupTable);",
		].join("\n"),

		FRAGMENTSHADERFINISH : "\n }",

		FRAGMENTSHADERENDMULTICHANNEL : [
			"uniform sampler2D imageTexture;",
			"uniform sampler2D lookupTable;",
			"uniform float lutRatio;",
			"uniform float useLookupTable;",
			"uniform float contrast;",
			"uniform float brightness;",
			"uniform float opacity;",
			"uniform float imageType;",
			"uniform float scalarMin;",
			"uniform float scalarMax;",

			"varying vec2 vUv;",
			"void main() {",
				"gl_FragColor=(texture2D( imageTexture, vUv )+brightness)*contrast;",
				"gl_FragColor[3]=opacity;",
			"}"
		].join("\n"),

		// indices of x, y and z according to orientation
		indices : {
			x: [0, 2, 0], y : [1, 1, 2], z: [2, 0, 1]
		}
	},

	members : {
		__opts : null,
		__slicer : null,
		__orientationNames : ['XY', 'ZY', 'XZ'],

		__availableImageFormat : 1,

		__file : null,

		__path : null,
		__offset : null,
		__prefix : null,
		__image : null,
		__texture : null,
		__lookupTable : null,

		__timestamp : null,

		__extent : null,
		__origin : null,
		__spacing : null,
		__dimensions: null,

		__numberOfScalarComponents : null,
		__scalarTypeString : null,
		__scalarType : null,
		__scalarSize : null,
		__scalarMin : undefined,
		__scalarMax : null,
		__LUTFactor : 1,

		__lookupTables : null,

		__materials : null,

		__brightness : 0,
		__brightnessOffset : 0,
		__contrast : 1,
		__contrastMultiplier : 1,
		__opacity : 1,

		__ready : false,

		__oldGetUserData : null,

		__newGetUserData : function ( key ) {
			if ( key == "mesh" )
				console.warn( 'slice.getUserData( "mesh" ) is deprecated. Use MPR.SliceView.getMesh( slice ) instead ' );
			return this.__oldGetUserData( key );
		},

		/**
		 * returns only when the slice is ready
		 */
		ready : async function () {

			if ( this.__ready ) return;
			await new Promise( r => this.addListenerOnce( "changeImage", r ) );

		},

		/**
		 * informs whether the slice is ready (i.e. loaded);
		 * @return {Boolean} ready/not ready
		 */
		isReady : function () {
			return this.__ready;
		},

		/**
		 * returns the loaded file
		 * @return {String} the loaded file
		 */
		getFileName : function () {
			return this.__file;
		},

		/**
		 * returns the Image element used to load slices
		 * @return {Image} the image
		 */
		getImage : function () {
			return this.__image;
		},

		/**
		 * returns the volume dimensions
		 * @return {Array} array of 3D dimensions
		 */
		getDimensions : function () {
			return this.__dimensions;
		},

		/**
		 * returns the volume extent
		 * @return {Array} array of 3D extent
		 */
		getExtent : function () {
			return this.__extent;
		},

		/**
		 * returns the volume origin
		 * @return {Array} array of origin coordinates
		 */
		getOrigin : function () {
			return this.__origin;
		},

		/**
		 * returns the volume spacing
		 * @return {Array} array of spacings
		 */
		getSpacing : function () {
			return this.__spacing;
		},

		/**
		 * returns the volume 2D spacing i.e. the spacing in the projected view
		 * @return {Array} array of spacings
		 */
		 get2DSpacing : function () {
			var o = this.getOrientation();
			return [this.__spacing[desk.MPR.Slice.indices.x[o]],
				this.__spacing[desk.MPR.Slice.indices.y[o]]];
		},

		/**
		 * returns the volume scalar type
		 * @return {Int} scalar type (according to VTK definition)
		 */
		getScalarType : function () {
			return this.__scalarType;
		},

		/**
		 * returns the volume scalar type as a string
		 * @return {String} scalar type (according to VTK definition)
		 */
		getScalarTypeAsString : function () {
			return this.__scalarTypeString;
		},

		/**
		 * returns the volume scalar size (in bytes)
		 * @return {Int} scalar size
		 */
		getScalarSize : function () {
			return this.__scalarSize;
		},

		/**
		 * returns the volume scalar bounds [min, max]
		 * @return {Array} bounds
		 */
		getScalarBounds : function () {
			return [this.__scalarMin, this.__scalarMax];
		},

		__mhd : null,

		/**
		 * reloads the volume (OOC version)
		 * @param callback {Function} callback when done
		 * @param context {Object} optional callback context
		 */
		 __updateOOC : function (callback, context) {
			if (this.__mhd) {
				this.__finalizeUpdate();
				setTimeout(callback.bind(context), 10);
				return;
			} else {
				desk.FileSystem.readFile(this.__file, function (err, res) {
					var mhd = this.__mhd = MHD.parse(res);
					if (mhd.CompressedData === true) {
						alert ("cannot read compressed data out of core!");
						return;
					}
					var dims = this.__dimensions = mhd.DimSize;
					this.__origin = mhd.Offset;
					this.__spacing = mhd.ElementSpacing;
					this.__extent = [0, dims[0] - 1, 0, dims[1] - 1, 0, dims[2] - 1];
					this.__scalarTypeString = mhd.scalarTypeAsString;
					this.__scalarType = mhd.scalarType;
					this.__numberOfScalarComponents = mhd.ElementNumberOfChannels || 1;
					this.__finalizeUpdate();

					if (callback) callback.call(context);
				}, this);
			}
		},

		/**
		* reloads the volume (slicer version)
		* @param callback {Function} callback when done
		* @param context {Object} optional callback context
		*/
		__updateslicer : function ( callback, context ) {

			//Todo : get Image parameters
			var prop = this.__opts.slicer.properties;
			this.__dimensions = prop.dimensions;
			this.__origin = [0, 0, 0]; //prop.origin;
			this.__spacing = prop.spacing;
			this.__extent = prop.extent;
			this.__scalarTypeString = prop.scalarTypeAsString;
			this.__scalarType = prop.scalarType;
			this.__numberOfScalarComponents = prop.numberOfScalarComponents;
			this.__scalarMin = prop.scalarBounds[0];
			this.__scalarMax = prop.scalarBounds[1];
			this.__finalizeUpdate();
			setTimeout( function () { callback.call(context); }, 0 );

		},


		/**
		 * reloads the volume
		 * @param callback {Function} callback when done
		 * @param context {Object} optional callback context
		 */
		update : function (callback, context) {
			callback = typeof callback === "function" ? callback : function () {};
			if (this.__opts.ooc) {
				this.__updateOOC(callback, context);
				return;
			}

            var params = _.extend({
			    input_volume : this.__file,
			    slice_orientation : this.getOrientation()
			}, this.__opts.sliceWith || {});

			if ((desk.Actions.getInstance().getAction("vol_slice") != null)
				&& (desk.FileSystem.getFileExtension(this.__file) == "vol")) {
				params.action = "vol_slice";
			} else {
				params.action = "slice_volume";
			    params.format = this.getImageFormat();
			}

			if ( this.__opts.slicer ) {

				this.__updateslicer( callback, context );
				return;

			}

		    desk.Actions.execute(params,
				function (err, response) {
					if (err) {
						callback("Error while slicing volume : " + err);
						return;
					}
					this.openXMLURL( desk.FileSystem.getFileURL( response.outputDirectory + "volume.xml" ),
						callback, context);
			}, this);

		},

		/**
		 * returns current brightness
		 * @return {Float} current brightness
		 */
		getBrightness : function () {
			return this.__brightness;
		},

		/**
		 * returns current contrast
		 * @return {Float} current contrast
		 */
		getContrast : function () {
			return this.__contrast;
		},

		/**
		 * sets brightness and contrast for all generated materials
		 * @param brightness {Number} brightness
		 * @param contrast {Number} contrast
		 */
		setBrightnessAndContrast : function (brightness, contrast) {
			this.__setBrightnessAndContrast(brightness, contrast);
			this.fireEvent("changeImage");
		},

		/**
		 * sets brightness all generated materials
		 * @param brightness {Number} brightness
		 */
		setBrightness : function ( brightness ) {
			this.__setBrightnessAndContrast(brightness, this.getContrast() );
			this.fireEvent("changeImage");
		},

		/**
		 * sets contrast for all generated materials
		 * @param contrast {Number} contrast
		 */
		setContrast : function ( contrast ) {
			this.__setBrightnessAndContrast( this.getBrightness(), contrast);
			this.fireEvent("changeImage");
		},


		/**
		 * sets brightness and contrast for all generated materials
		 * @param brightness {Number} brightness
		 * @param contrast {Number} contrast
		 */
		__setBrightnessAndContrast : function (brightness, contrast) {
			this.__brightness = brightness;
			this.__contrast = contrast;
			brightness += this.__brightnessOffset;
			contrast *= this.__contrastMultiplier;

			this.__materials.forEach(function (material) {
				material.uniforms.brightness.value = brightness;
				material.uniforms.contrast.value = contrast;
			}, this);
		},

		/**
		 * sets opacity for all generated materials
		 * @param opacity {Number} opacity in the [0, 1] range
		 */
		 setOpacity : function (opacity) {
			this.__materials.forEach(function (material) {
				material.uniforms.opacity.value = opacity;
			});
			this.fireEvent("changeImage");
		},

		/**
		 * gets the slices file names offset
		 * @return {Int} offset
		 */
		getSlicesIdOffset : function () {
			return this.__offset;
		},

		/**
		 * attach lookup tables to material
		 * @param luts {Array} array of luts
		 * @param material {THREE.Material} material
		 */
		 __setLookupTablesToMaterial : function ( luts , material ) {
			var lut = material.uniforms.lookupTable.value;
			var numberOfColors = luts[0].length;
			material.uniforms.lutRatio.value = 1;//this.__LUTFactor / numberOfColors;
			material.uniforms.useLookupTable.value = 1;
			lut.needsUpdate = true;
			var image = lut.image;
			if (image.width != numberOfColors) {
				image.data = new Uint8Array(numberOfColors * 4);
				image.width = numberOfColors;
			}

			for (var j = 0, p = 0; j < numberOfColors; j++) {
				for (var k = 0; k < 4; k++) {
					image.data[p++] = luts[k] ? luts[k][j] : 255;
				}
			}
		},

		/**
		 * set lookup tables
		 * @param luts {Array} array of luts
		 */
		setLookupTables : function (luts) {
			if (!luts) {
				this.removeLookupTables();
				return;
			}
			this.__lookupTables = luts;

			this.__materials.forEach(function (material) {
				this.__setLookupTablesToMaterial ( luts , material );
			}, this);
			this.fireEvent("changeImage");
		},

		/**
		 * get lookup tables
		 * @return {Array} array of luts
		 */
		getLookupTables : function () {
			return this.__lookupTables;
		},

		/**
		 * remove all lookup tables
		 */
		removeLookupTables : function () {
			this.__lookupTables = null;

			this.__materials.forEach(function (material) {
				material.uniforms.useLookupTable.value = 0;
			});
			this.fireEvent("changeImage");
		},

		/**
		 * updates a material
		 * @param material {THREE.Material} the material to update
		 */
		updateMaterial : function (material) {
			material.uniforms = {};
			Object.keys(material.baseShader.baseUniforms).forEach(function (key) {
				material.uniforms[key] = material.baseShader.baseUniforms[key];
			});

			material.fragmentShader = "";
			material.baseShader.extraUniforms.forEach(function (uniform) {
				material.fragmentShader += "\n uniform float " + uniform.name + ";";
				material.uniforms[uniform.name] = uniform;
			});

			material.fragmentShader += "\n" + material.baseShader.baseShaderBegin;
			material.baseShader.extraShaders.forEach(function (shader) {
				material.fragmentShader += "\n" + shader;
			});

			material.fragmentShader += "\n" + material.baseShader.baseShaderEnd;
			material.uniformsNeedUpdate = true;
			material.needsUpdate = true;
		},

		/**
		 * returns a three.js material fit for rendering
		 * @return {THREE.ShaderMaterial} material
		 */
		 getMaterial : function () {
			let middleShader;
			switch (this.__scalarType) {
			case 2 :
			case 15:
				//char / signed char
                middleShader = this.__opts.linearFilter ?
                    desk.MPR.Slice.FRAGMENTSHADERCHARLINEAR
                     : desk.MPR.Slice.FRAGMENTSHADERCHARNEAREST;
				break;
			case 3:
				middleShader = desk.MPR.Slice.FRAGMENTSHADERUCHAR;
				break;
			case 4:
                middleShader = this.__opts.linearFilter ?
                    desk.MPR.Slice.FRAGMENTSHADERSHORTLINEAR
                     : desk.MPR.Slice.FRAGMENTSHADERSHORTNEAREST;
				break;
			case 5:
                middleShader = this.__opts.linearFilter ?
                    desk.MPR.Slice.FRAGMENTSHADERUSHORTLINEAR
                     : desk.MPR.Slice.FRAGMENTSHADERUSHORTNEAREST;
				break;
			default:

                middleShader = this.__opts.linearFilter ?
                    desk.MPR.Slice.FRAGMENTSHADERFLOATLINEAR
                     : desk.MPR.Slice.FRAGMENTSHADERFLOATNEAREST;
				break;
			}

			if ( this.__opts.slicer ) {
				middleShader = desk.MPR.Slice.FRAGMENTSHADERFLOATSLICER;
			}

			var endShader = this.__opts.ooc ? desk.MPR.Slice.FRAGMENTSHADERENDOOC
				: desk.MPR.Slice.FRAGMENTSHADEREND;

			if (this.__numberOfScalarComponents == 1) {
				var shader = [desk.MPR.Slice.FRAGMENTSHADERBEGIN,
						middleShader,
						endShader,
						desk.MPR.Slice.FRAGMENTSHADERFINISH].join("\n");
			} else {
				shader = desk.MPR.Slice.FRAGMENTSHADERENDMULTICHANNEL;
			}

            const [ dimX, dimY ] = this.get2DDimensions();

			var baseUniforms = {
					imageTexture : {type : "t", slot: 0, value: this.__texture },
					lookupTable : {type : "t", slot: 1, value: this.__lookupTable },
					lutRatio : {type: "f", value: 2 },
					useLookupTable : {type: "f", value: 0 },
					contrast : {type: "f", value: 0},
					brightness : {type: "f", value: 0},
					opacity : {type: "f", value: this.__opacity},
					scalarMin : {type: "f", value: this.__scalarMin},
					scalarMax : {type: "f", value: this.__scalarMax},
					imageType : {type: "f", value: this.__availableImageFormat},
					dimX : {type: "f", value: dimX},
					dimY : {type: "f", value: dimY}
				};

			var baseShaderBegin = [desk.MPR.Slice.FRAGMENTSHADERBEGIN,
				middleShader,
				endShader].join("\n");

			var baseShaderEnd = desk.MPR.Slice.FRAGMENTSHADERFINISH;

			var material = new THREE.ShaderMaterial({
				uniforms: baseUniforms,
				vertexShader: desk.MPR.Slice.VERTEXSHADER,
				fragmentShader: shader,
				transparent : true
			});

			material.baseShader = {
				baseUniforms : baseUniforms,
				baseShaderBegin : baseShaderBegin,
				baseShaderEnd : baseShaderEnd,
				extraUniforms : [],
				extraShaders : []
			};

			if (this.__lookupTables) {
				this.__setLookupTablesToMaterial (this.__lookupTables , material);
			}

			this.__materials.push(material);
//			material.baseShader.extraShaders.push("valueJPG=0.5;\n valueJPG=0.5;");
//			material.baseShader.extraShaders.push("if (color < thresholdlow) \n color=0.0;");
//			var thresholdValue=200.0;
//			material.baseShader.extraUniforms.push({name : "thresholdlow", type: "f", value: thresholdValue });
//			this.updateMaterial(material);
			material.addEventListener('dispose', function () {
				this.__materials = _.without(this.__materials, material);
			}, this);

			this.__setBrightnessAndContrast(this.__brightness, this.__contrast);
			if ( !this.__image || this.__image.complete ) {
				this.__texture.needsUpdate = true;
			}
			material.side = THREE.DoubleSide;
			return material;
		},

		/**
		 * returns the volume bounding box in the form [xmin, xmax, ymin, ymax, zmin, zmax]
		 * @return {Array} array of bounds
		 */
		getBounds : function () {
			return [this.__origin[0] + this.__extent[0] * this.__spacing[0],
				this.__origin[0] + (this.__extent[1] + 1) * this.__spacing[0],
				this.__origin[1] + this.__extent[2] * this.__spacing[1],
				this.__origin[1] + (this.__extent[3] + 1) * this.__spacing[1],
				this.__origin[2] + this.__extent[4] * this.__spacing[2],
				this.__origin[2] + (this.__extent[5] + 1) * this.__spacing[2]];
		},

		/**
		 * returns the slice 3D coordinates the form [x0, y0, z0, ... , x3, y3, z3]
		 * @param slice {Integer} optional slice index, current slice is used if not provided
		 * @return {Array} array of coordinates
		 */
		getCornersCoordinates : function ( slice ) {
			var custom = true;
			if (slice === undefined) {
				custom = false;
				slice = this.getSlice();
			}

			var bounds = this.getBounds(),
				coords = [],
				indices = desk.MPR.Slice.indices,
				orientation = this.getOrientation();

			var xi = indices.x[orientation];
			var yi = indices.y[orientation];
			var zi = indices.z[orientation];

			for (var i = 0; i < 4; i++) {
				coords[3 * i + xi] =  this.__origin[xi] +
					this.__extent[2 * xi + (i % 2)] * this.__spacing[xi];

				coords[3 * i + yi] =  this.__origin[yi] +
					this.__extent[2 * yi + (i > 1 ? 1 : 0)] * this.__spacing[yi];

				if ( custom ) {
					coords[3 * i + zi] =  this.__origin[zi] +
						(slice + this.__extent[2 * zi]) * this.__spacing[zi];
				} else {
					coords[3 * i + zi] =  this.getPosition();
				}
			}

			return coords;
		},

		/**
		 * returns the volume bounding box diagonal length
		 * @return {Number} diagonal length
		 */
		 getBoundingBoxDiagonalLength : function () {
			var bounds = this.getBounds();
			return Math.sqrt(Math.pow(bounds[1] - bounds[0], 2) +
							Math.pow(bounds[3] - bounds[2], 2) +
							Math.pow(bounds[5] - bounds[4], 2));
		},

		/**
		 * returns the index of the z axis in the orientation
		 * @return {Int} index of the z axis
		 */
		getZIndex : function () {
			return desk.MPR.Slice.indices.z[this.getOrientation()];
		},

		/**
		 * returns the dimensions of the slice in the form [dimx, dimy]
		 * @return {Array} array of dimensions
		 */
		 get2DDimensions: function () {
			var o = this.getOrientation();
			return [this.__dimensions[desk.MPR.Slice.indices.x[o]],
				this.__dimensions[desk.MPR.Slice.indices.y[o]]];
		},

		/**
		 * returns the slice 2D coordinates the form [x0, y0, ... , x3, y3]
		 * @return {Array} array of coordinates
		 */
		 get2DCornersCoordinates : function () {
			var bounds = this.getBounds();
			var xi = 2 * desk.MPR.Slice.indices.x[this.getOrientation()];
			var yi = 2 * desk.MPR.Slice.indices.y[this.getOrientation()];

			return [bounds[xi], bounds[yi],
					bounds[xi + 1], bounds[yi],
					bounds[xi], bounds[yi + 1],
					bounds[xi + 1], bounds[yi + 1]];
		},

		/**
		 * returns the 2D origin [x, y]
		 * @return {Array} array of coordinates
		 */
		 get2DOrigin : function () {
			 return this.get2DCornersCoordinates().slice(0,2);
		},

		/**
		 * returns the total number of slices
		 * @return {Number} number of slices
		 */
		getNumberOfSlices : function () {
			return this.__dimensions[this.getZIndex()];
		},

		/**
		 * loads slices pointed by an xml file
		 * @param url {String} file url
		 * @param callback {Function} callback when done
		 * @param context {Object} optional callback context
		 */
		openXMLURL : function (url, callback, context) {
			var req = new qx.io.request.Xhr(url + "?nocache=" + Math.random());
			qx.util.DisposeUtil.disposeTriggeredBy(req, this);
			req.set({async : true, parser : 'xml'});
			this.__path = desk.FileSystem.getFileDirectory(url);

			req.addListener("success", (e) => {
				if ( this.isDisposed() ) return;
				try {
					this.__parseXMLresponse(e.getTarget().getResponse());
					req.dispose();
				} catch (err) {
					console.log(err);
					setTimeout(this.update.bind(this), 1000, callback, context);
					return;
				}
				if (typeof callback === 'function') {
					callback.call(context);
				}
				req.dispose();
			} );
			req.addListener("fail", (e) => {
				this.update(callback, context);
				req.dispose();
			} );
			req.send();
		},

		/**
		 * callback when the volume xml file is loaded
		 * @param xmlDoc {Element} xml content
		 */
		__parseXMLresponse : function (xmlDoc) {
			var volume = xmlDoc.getElementsByTagName("volume")[0];
			if (!volume)
				return;

			// parse extent, dimensions, origin, spacing
			this.__extent = ["x1", "x2", "y1", "y2", "z1", "z2"].map(function (field) {
				return parseInt(volume.getElementsByTagName("extent")[0].getAttribute(field), 10);
			});

			this.__dimensions = ["x", "y", "z"].map(function (field) {
				return parseInt(volume.getElementsByTagName("dimensions")[0].getAttribute(field), 10);
			});

			this.__spacing = ["x", "y", "z"].map(function (field) {
				return parseFloat(volume.getElementsByTagName("spacing")[0].getAttribute(field));
			});

			this.__origin = ["x", "y", "z"].map(function (field) {
				return parseFloat(volume.getElementsByTagName("origin")[0].getAttribute(field));
			});

			if ( this.__opts.center ) {

				// define custom origin to match center
				for ( let i = 0; i < 3; i++ ) {

					this.__origin[ i ] = this.__opts.center[ i ] -
						0.5 * this.__spacing[ i ] * this.__dimensions[ i ];

				}


			}

			var XMLscalars = volume.getElementsByTagName("scalars")[0];
			this.__numberOfScalarComponents = parseInt(XMLscalars.getAttribute(	"numberOfScalarComponents"),10);
			this.__scalarType = parseInt(XMLscalars.getAttribute("type"),10);
			this.__scalarSize = parseInt(XMLscalars.getAttribute("size"),10);
			this.__scalarMin = parseFloat(XMLscalars.getAttribute("min"),10);
			this.__scalarMax = parseFloat(XMLscalars.getAttribute("max"),10);
			this.__scalarTypeString = XMLscalars.childNodes[0].nodeValue;

			var slices = volume.getElementsByTagName("slicesprefix")[0];
			this.__offset = parseInt(slices.getAttribute("offset"), 10);
			this.__timestamp = slices.getAttribute("timestamp") || Math.random();
			this.__prefix = slices.childNodes[0].nodeValue;

			this.__finalizeUpdate();
		},

		/**
		 * function to finalize update, common to update() and uptateOOC()
		 */
		__finalizeUpdate : function () {
			this.__availableImageFormat = this.getImageFormat();

			if (this.__ready) {
				this.__updateImage();
			}
			this.__ready = true;
		},

		__timeout : null,

		__lastHandle : null,

		__isChangePositionInProgress : false,

		/**
		 * changes the image url, sets timeouts
		 */
		__onChangePosition : function () {
			var zi = this.getZIndex();
			var slice = Math.round( ( this.getPosition() -  this.__origin[ zi ] )
				/ this.__spacing[ zi ] );

			slice = Math.max( 0, Math.min( slice, this.getNumberOfSlices() - 1 ) );
			this.__isChangePositionInProgress = true;
			this.setSlice( slice );
			this.__isChangePositionInProgress = false;
		},

		/**
		 * changes the image url, sets timeouts
		 */
		__updateImage : function () {
			clearTimeout(this.__timeout);
			if ( !this.__opts.slicer)
				this.__timeout = setTimeout(this.__updateImage.bind(this), 10000);
			this.__texture.version = this.__texture.uploadedVersion;
			this.__texture.source.version = this.__texture.source.uploadedVersion;

			var slice = this.getSlice();

			if ( !this.__isChangePositionInProgress ) {
				var zi = this.getZIndex();
				this.setPosition( slice * this.__spacing[ zi ] + this.__origin[ zi ] );
			}

			if (this.__opts.slicer) {

				if (!this.__waitingForSlicer) {

					window.setImmediate( () => {
						this.__slicer.getSlice(this.getOrientation(), this.getSlice(), (err, imageData, imgFloatArray) => {
							if (err) {
							console.warn(err);
							}

							this.__waitingForSlicer = false;
							//that.__texture.image = imageData;
							var tmp = { data: imgFloatArray, width: imageData.width, height: imageData.height };
							if (typeof this.__opts.postProcessFunction === 'function') {
								this.__opts.postProcessFunction(tmp, this.__slicer);
							}

							this.__texture.image = tmp;
							this.__texture.unpackAlignment = 1;

							this.__materials.forEach( material => {
								material.uniforms.imageType.value = this.__availableImageFormat;
							} );
							this.__texture.needsUpdate = true;
							if (this.__numberOfScalarComponents == 3) {
								this.__texture.format = THREE.RGBAFormat;
								this.__texture.type = THREE.UnsignedByteType;
							}

							if (this.__numberOfScalarComponents === 1) {
								this.__contrastMultiplier = 1 / Math.abs(this.__scalarMax - this.__scalarMin);
								this.__brightnessOffset = - this.__scalarMin * this.__contrastMultiplier;
							}
							this.setBrightnessAndContrast(this.__brightness, this.__contrast);
						} );
					} );
				}

				this.__waitingForSlicer = [ this.getOrientation(), this.getSlice() ];
				return;
			}


			if (!this.__opts.ooc) {
				this.__image.src = this.getSliceURL(this.getSlice()) + "?nocache=" + this.__timestamp;
				return;
			}

			var handle = desk.Actions.execute({
					action : "VolumeOOCSlice",
					input_file : this.__file,
					slice : slice,
					format : this.getImageFormat(),
					stdout : true
				},
				function (err, response) {
					if (this.__lastHandle === handle) this.__lastHandle = 0;
					if (response.status === "killed") return;

					if (this.__scalarMin === undefined && this.__numberOfScalarComponents === 1) {
						desk.FileSystem.readFile(response.outputDirectory + 'range.txt', function (err, result) {
							var range = result.split(" ").map(function (value) {
								return parseFloat(value);
							});
							this.__scalarMin = Math.min(range[0], 0);
							this.__scalarMax = range[1];
						}, this);
					}
					if (this.getSlice() !== slice) return;
					this.__image.src = desk.FileSystem.getFileURL(
						response.outputDirectory + 'slice.'
							+ (this.getImageFormat()? 'jpg' : 'png')
							+'?nocache='
							+ response.timeStamp
					);
				},
			this);

			if (this.__lastHandle) {
				desk.Actions.getInstance().killAction(this.__lastHandle);
			}
			this.__lastHandle = handle

		},

		/**
		 * returns the full file name for a given slice
		 * @param slice {Number} slice number
		 * @return {String} full file name
		 */
		getSliceURL : function (slice) {
			return this.__path + this.__prefix +
				this.__orientationNames[this.getOrientation()] +
				(this.__offset + slice) +
				(this.__availableImageFormat ? '.jpg' : '.png');
		}
	}
});

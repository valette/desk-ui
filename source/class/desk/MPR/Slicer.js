
/**
* @ignore (Worker)
* @ignore (PapayaSlicer)
* @ignore (require)
*/


qx.Class.define("desk.MPR.Slicer", {

	extend : qx.core.Object,

    /**
     * constructor
     */
    construct: function( volume, opts ) {

		this.__volume = volume;
		this.opts = opts;
		this.loaded = false;
		this.callbacks = {};
		window.bowser = require( 'bowser' );
		require( "three/../../source/ext/workerSlicer.worker.js" );

		if ( opts.worker ) {

			// TODO!!!
			const scriptFile = "desk-ui/workerSlicer.worker.js";
			this.worker = new Worker(scriptFile);
			var self = this;

			this.worker.onmessage = function(e) {

				var type = e.data.shift();
				var data = e.data.shift();

				if (type == "progress") {

					if (typeof opts.onprogress === 'function')
					opts.onprogress(data);

				} else if (type == "slice") {
					var uniqueId = data[0];
					var imgData = data[1];

					if (typeof self.callbacks[uniqueId] === 'function') {

						self.callbacks[uniqueId](null, imgData);
						self.callbacks[uniqueId] = undefined;

					}

				} else if (type == "imageLoaded") {

					self.properties = data;
					self.loaded = true;
					if (typeof opts.onload === 'function')
					opts.onload(self.properties);

				}
			}

			if (opts.local)
				this.worker.postMessage(["loadLocalImage", volume]);
			else this.worker.postMessage(["loadImage", volume]);

			return;

		}

		var root = qx.core.Init.getApplication().getRoot();
		var win = new qx.ui.window.Window("Chargement de l'image");

		win.set({
			width : 300,
			height : 100,
			alwaysOnTop : true,
			showMinimize : false,
			showMaximize : false,
			centerOnAppear : true,
			modal : true,
			movable : false,
			allowMaximize : false,
			allowMinimize : false,
			resizable : false,
			showClose : false,
			layout : new qx.ui.layout.VBox( 10 )
		});

		var progressText = new qx.ui.basic.Label("Initialisation...");
		win.add(progressText);

		const progressBar = new qx.ui.indicator.ProgressBar();
		win.add( progressBar );
		root.add( win );
		win.open();

		var progressFunc = function (frac, text) {

			if (text == "Unpacking") text = "Décompression";
			var txt = text+" "+ Math.min( 100, (frac*100).toFixed(1) )+"%";
			progressText.setValue(txt);
			progressBar.setValue(frac*100);

		};

		this.slicer = new PapayaSlicer(progressFunc);

		if ( opts.local ) {

			if (typeof volume == "string") {

				var str = 'fs';
				var fs = require( str )
				const buffer = fs.readFileSync( volume );
				this.slicer.vol.fileName = require("path").basename(volume);
				this.slicer.vol.rawData[0] = buffer;//fileBuffer.buffer;
				//const b = Buffer.from(fileBuffer);
				//var arrayBuffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
				this.slicer.vol.decompress( this.slicer.vol);

				this.slicer.vol.onFinishedRead = () => {

					this.properties = this.slicer.initProperties();
					this.loaded = true;
					opts.onload(this.properties);
					win.close();

				}

			} else {

				this.slicer.vol.readFiles( [ volume ], () => {

					this.properties = this.slicer.initProperties();
					this.loaded = true;
					opts.onload( this.properties );
					win.close();

				} );

			}

		}

    },

    destruct: function() {

		if ( this.worker ) this.worker.terminate();

    },

    events: {

    },

    properties: {

    },

    members: {

		__volume : null,
		__worker : null,

		getSlice : function( orientation, number, cb ) {

		  var DIRECTION_AXIAL = 0;
		  var DIRECTION_CORONAL = 1;
		  var DIRECTION_SAGITTAL = 2;

		  var normales = [
		   2, //DIRECTION_AXIAL     XY Z
		   0, //DIRECTION_CORONAL   ZY X
		   1 //DIRECTION_SAGITTAL   XZ Y
		  ];

		  var self = this;
		  if (this.loaded && number < this.properties.dimensions[normales[orientation]]) {
			if ( !this.opts.worker) {
				this.slicer.generateSlice([number, orientation], cb);
			}
			else
			{
				var uniqueId = Math.floor((1 + Math.random()) * 0x10000000000000).toString(16);
				this.callbacks[uniqueId] = cb;
				setTimeout(function () {
				  self.worker.postMessage(["getSlice", [number, orientation, uniqueId]]);
				}, 0);
			}
		  }
		  else if (!this.loaded) {
			cb("Error : image not loaded");
		  }
		  else if (number >= this.properties.dimensions[normales[orientation]] ) {
			cb("Error : out of image, slice "+number+" ask, dimension for orientation "+orientation+" is "+this.properties.dimensions[normales[orientation]]);
		  }

		}

    }

});

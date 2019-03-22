var WorkerSlicer = function (volume, opts) {
  this.volume = volume;

  var scriptFile = "script/workerSlicer.worker.min.js";

  if (!opts.noworker) {
    console.log("Noworker ! ");
    this.worker = new Worker(scriptFile);

      var self = this;

      this.worker.onmessage = function(e) {
        var type = e.data.shift();
        var data = e.data.shift();

        if (type == "progress") {
          if (typeof opts.onprogress === 'function')
            opts.onprogress(data);
        }
        else if (type == "slice") {
          console.log("Slice available", data);
          var uniqueId = data[0];
          var imgData = data[1];

          if (typeof self.callbacks[uniqueId] === 'function') {
            console.log("call ; ", uniqueId)
            self.callbacks[uniqueId](null, imgData);

	    self.callbacks[uniqueId] = undefined;
          }
        }
        else if (type == "imageLoaded") {
          self.properties = data;
          self.loaded = true;
          if (typeof opts.onload === 'function')
            opts.onload(self.properties);
        }
      }

      if (opts.local) {
	    this.worker.postMessage(["loadLocalImage", volume]);
	    console.log("LoadLocalFile");
      }
      else
      	this.worker.postMessage(["loadImage", volume]);
  }
  else
  {
    function loadScript(uri, callback) {
      var elem = document.createElement("script");
      elem.charset = "utf-8";
      elem.src = uri;
      elem.onreadystatechange = elem.onload = function() {
        if (!this.readyState || readyStateValue[this.readyState]) {
          elem.onreadystatechange = elem.onload = null;
          if (typeof callback === "function") {
            callback();
          }
        }
      };

      var head = document.getElementsByTagName("head")[0];
      head.appendChild(elem);
    }

    var that = this;

    loadScript(scriptFile, function () {
	    var progressFunc = function (frac, text) {
	      var txt = text+" "+(frac*100).toFixed(1)+"%";
	      console.log("progress", txt);
	    };

        that.slicer = new PapayaSlicer(progressFunc);

        if (opts.local) {
            that.slicer.vol.readFiles([volume], function () {
                that.properties = that.slicer.initProperties();
                that.loaded = true;
                opts.onload(that.properties);
            });
        }
    });
  }

  this.opts = opts;
  this.loaded = false;

  this.callbacks = {};

  /*
    opts.onload
    opts.onprogress
  */

};

WorkerSlicer.prototype.getSlice = function(orientation, number, cb) {

  var DIRECTION_AXIAL = 0;
  var DIRECTION_CORONAL = 1;
  var DIRECTION_SAGITTAL = 2;

  var normales = [
   2, //DIRECTION_AXIAL     XY Z
   0, //DIRECTION_CORONAL   ZY X
   1 //DIRECTION_SAGITTAL   XZ Y
  ];


  console.log("getSlice called");
  var self = this;
  if (this.loaded && number < this.properties.dimensions[normales[orientation]]) {
    if (this.opts.noworker) {
        console.log("Direct generate Slice");
        this.slicer.generateSlice([number, orientation], cb);
    }
    else
    {
	    var uniqueId = Math.floor((1 + Math.random()) * 0x10000000000000).toString(16);
	    this.callbacks[uniqueId] = cb;
	    setTimeout(function () {
	      console.log("worker asked for a slice");
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
};

WorkerSlicer.prototype.destroy = function () {
  if (this.worker)
    this.worker.terminate();

  this.callbacks = undefined;
}

var WorkerSlicer = function (volume, opts) {
  this.volume = volume;

  var scriptFile = "script/workerSlicer.worker.js";

  if (!opts.noworker) {
    console.log("Worker ! ");
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
    console.log("NoWorker ! ");
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
    
      
      var pb = new qx.ui.indicator.ProgressBar();
      this.getRoot().add(pb, { left : 20, top: 20});


	    var progressFunc = function (frac, text) {
	      var txt = text+" "+(frac*100).toFixed(1)+"%";
	      console.log("progress", txt);
	      pb.setValue(frac*100);

	    };

        that.slicer = new PapayaSlicer(progressFunc);

        if (opts.local) {
            console.log(volume);
            if (typeof volume == "string") {
              //fs = require("fs");
              var fs = require('fs')
              var concat = require('concat-stream')
              
              console.log("readfileSync : ", volume);
              
              
              //var fileBuffer = fs.readFileSync(volume);
              //console.log(fileBuffer.buffer);
              

               
              var readStream = fs.createReadStream(volume)
              var concatStream = concat(gotPicture)
               
               
               
               
              readStream.on('error', handleError)
              
              // Get the size of the file
              var stats = fs.statSync(volume);
              var fileSize         = stats.size;
              var readSize    = 0; // Incremented by on('data') to keep track of the amount of data we've uploaded


                  readStream.on('data', function(buffer) {
                      var segmentLength   = buffer.length;
                      // Increment the uploaded data counter
                      readSize        += segmentLength;
                      progressFunc(readSize/fileSize, "Reading");
                  });
              
              readStream.pipe(concatStream)
               
              function gotPicture(buffer) {
                console.log(buffer);
                that.slicer.vol.fileName = require("path").basename(volume);
                console.log( that.slicer.vol.fileName);
                that.slicer.vol.rawData[0] = buffer;//fileBuffer.buffer;
                //const b = Buffer.from(fileBuffer);
                //var arrayBuffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
                console.log("Vol Read");
                that.slicer.vol.decompress( that.slicer.vol);
                    
                
                that.slicer.vol.onFinishedRead = function () {
                  
                  that.properties = that.slicer.initProperties();
                  that.loaded = true;
                  opts.onload(that.properties);
               }
              }
               
              function handleError(err) {
                // handle your error appropriately here, e.g.:
                console.error(err) // print the error to STDERR
                process.exit(1) // exit program with non-zero exit code
              }
               

            }
            else
            {
              that.slicer.vol.readFiles([volume], function () {
                  that.properties = that.slicer.initProperties();
                  that.loaded = true;
                  opts.onload(that.properties);
              });
            }
            
           
            
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


  var self = this;
  if (this.loaded && number < this.properties.dimensions[normales[orientation]]) {
    if (this.opts.noworker) {
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
};

WorkerSlicer.prototype.destroy = function () {
  if (this.worker)
    this.worker.terminate();

  this.callbacks = undefined;
}


/**
 * @ignore (ImageData)<
 * @ignore (THREE*)
 * @ignore (chroma*)
 * @ignore (require*)
 * @ignore (performance*)
 * @ignore (imgArray*)

 */


qx.Class.define("desk.FuncLayer", {
    extend: qx.ui.container.Composite,

    /**
     * constructor
     */
    construct: function(MPR, meshViewer) {
	    this.base(arguments);

	    this.__MPR = MPR;
	    this.__meshViewer = meshViewer;

	    var layout = new qx.ui.layout.VBox();
      this.setLayout(layout);

      this.createUI();

      this.exclude();
    },

    destruct: function() {

    },

    events: {

    },

    properties: {

    },

    members: {
      __MPR : null,
      __meshViewer : null,
      __funcButtonMeta : null,
      __volumeFunc : null,
      __IRMFuncName : null,
      __seuilSlider : null,
      __meshesFunc : null,
      __colors : null,
      __widthMenu : 220,

      /**
       * create UI
       */
      createUI: function() {
          var that = this;

          var titleContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox());

              titleContainer.add(new qx.ui.basic.Label().set({
                  value: "<b>" + this.tr("Calque fonctionnelle") + " : </b>",
                  rich: true
              }));

              titleContainer.add(new qx.ui.core.Spacer(), {flex: 1});


              var button_meta = this.__funcButtonMeta = new qx.ui.form.Button(null, 'resource/ife/info_small.png').set({
                  decorator: null
              });
              titleContainer.add(button_meta);
              button_meta.addListener("execute", function() {
                  that.showMeta(that.__volumeFunc);
              });

              var button_close = new qx.ui.form.Button(null, 'resource/ife/close_small_small.png').set({
                  decorator: null
              });
              titleContainer.add(button_close);
              button_close.addListener("execute", this.removeFunc.bind(this));

          this.add(titleContainer);

          this.__IRMFuncName = new qx.ui.basic.Label().set({
              rich: true,
              wrap : true
          });

          this.__IRMFuncName.setAllowGrowX(false);

          this.add(this.__IRMFuncName);

          var seuilLabel = new qx.ui.basic.Label(this.tr("Seuil") + " :");
          this.add(seuilLabel);
          var seuilSlider = this.__seuilSlider = new qx.ui.form.Slider();

          seuilSlider.addListener("changeValue", function(e) {
		          var val = (seuilSlider.getValue()-seuilSlider.getMinimum())/(seuilSlider.getMaximum()-seuilSlider.getMinimum())*100;
              seuilLabel.setValue(this.tr("Seuil") + " :" +  Math.floor(val) );
              function updateSlice(slice) {
                  slice.material.uniforms.thresholdMin.value = seuilSlider.getValue() / 100;
              }
              that.__MPR.getVolumeMeshes(that.__volumeFunc).forEach(updateSlice);
              that.__meshesFunc.forEach(updateSlice);
              that.__meshViewer.render();
              that.__MPR.render();
          });

          this.add(seuilSlider);
          this.add(new qx.ui.basic.Label(this.tr("Echelle de couleur : ")));

          var lutArray = [
              generateChroma( chroma.scale( ["#00f", "#0ff", "#0f0", "#ff0","#f00"] ).domain([0,0.333, 0.5, 0.666, 1]) ),
              generateChroma( chroma.scale("Spectral").domain([1,0]) ),
              generateChroma( chroma.scale( ["blue", "#eee", "red"] ).mode('lrgb') ),
              generateChroma( chroma.scale( ["black", "white"] ).gamma(1/2) ),
          ];

          function generateChroma(scale) {
            return function(imgData) {
              return that.generateChromaLut.apply( undefined, [imgData, scale]);
            }
          };

          var selectBox = new qx.ui.form.SelectBox();

          lutArray.forEach(function(generator) {
              selectBox.add(new qx.ui.form.ListItem("", that.lutImage(generator)));
          });

          selectBox.addListener("changeSelection", function(e) {
              var index = selectBox.getSelectables().indexOf(e.getData()[0]);
              console.log(index);
              that.__colors = lutArray[index]();
              console.log(that.__colors);
              if (that.__volumeFunc)
                  that.__MPR.setVolumeLUT(that.__volumeFunc, that.__colors);
          });
          this.add(selectBox);

          this.__colors = this.generateLut();


      },

      showMeta : function (volume) {
          var metadonnees = volume.getUserData("metadonnees");
          var that = this;

          if (!metadonnees) {
              var dialog = require('electron').remote.dialog;
              dialog.showMessageBox({
                type : "error",
                title : "Erreur",
                message : "Métadonnées indisponibles",
                buttons : ['Ok']
              });
          }

          this.alert(metadonnees, "Métadonnées");
      },

      addFuncFile: function(cbBefore, cbAfter) {
          var dialog = require('electron').remote.dialog;
          var filesList = dialog.showOpenDialog({
            filters : [
              {name: 'Anat Nifti Image', extensions: ['fonc.nii.gz']},
              {name: 'Nifti Image', extensions: ['nii.gz']},
              {name: 'All Files', extensions: ['*']}

            ],
            properties: ['openFile']
          });

          if (!filesList || !filesList.length) return;
          var name = require("path").basename(filesList[0]);

          if (name.substr(name.length -7) !== ".nii.gz") {
              dialog.showMessageBox({
                type : "error",
                title : "Erreur : type de fichier",
                message : "Ne sont acceptés que les fichiers Nifti compressés (.nii.gz).",
                buttons : ['Ok']
              });

              return;
          }


          var that = this;
          cbBefore();
          this.removeFunc();

          var properties = {
              workerSlicer: true,
              noworker: true,
              colors: that.__colors,
              linearFilter : false,
              opacity: 0.7,
              postProcessFunction : function (texture, workerSlicer) {
                var prop = workerSlicer.properties;
                var v = prop.scalarBounds[0];
                imgArray = texture.data;
						    for (var i=imgArray.length; i-->0;)
						        if (imgArray[i] === 0.0)
						            imgArray[i] = v;
              }
          };

          this.__MPR.addVolume(filesList[0], properties, function(err, volume) {
              var prop = volume.getUserData("workerSlicer").properties;
              that.__volumeFunc = volume;
              volume.setUserData("path", filesList[0]);

              that.__funcButtonMeta.exclude();
              that.loadMeta(volume, function (err, meta) {
                if (err === null) { //show info button
                  that.__funcButtonMeta.show();
                }
                else { //show info button
                  that.__funcButtonMeta.exclude();
                }
              });

              that.__meshesFunc = that.__meshViewer.attachVolumeSlices(that.__MPR.getVolumeSlices(volume));
              that.__IRMFuncName.setValue(name);

              that.show();


              var volumeSlice = that.__MPR.getVolumeSlices(volume)[0];

              var slices = that.__MPR.getVolumeMeshes(volume);
              that.hackShaders(volumeSlice, slices);
              that.hackShaders(volumeSlice, that.__meshesFunc);
              that.__seuilSlider.set({
                  minimum: Math.floor(prop.scalarBounds[0] * 100),
                  maximum: Math.floor(prop.scalarBounds[1] * 100),
                  singleStep: 1,
                  value: Math.floor((prop.scalarBounds[0] + prop.scalarBounds[1]) * 50)
              })

              slices.forEach(setMaxThreshold);
              that.__meshesFunc.forEach(setMaxThreshold);

              function setMaxThreshold(target) {
                  target.material.uniforms.thresholdMax.value = prop.scalarBounds[1];
              }

              function updateSlice(slice) {
                  slice.material.uniforms.thresholdMin.value = that.__seuilSlider.getValue() / 100;
              }
              that.__MPR.getVolumeMeshes(that.__volumeFunc).forEach(updateSlice);
              that.__meshesFunc.forEach(updateSlice);
              that.__meshViewer.render();
              that.__MPR.render();

              cbAfter();
          });
      },

      loadMeta : function (volume, callback) {
          var path = volume.getUserData("path");
          path = path.substr(0, path.length-7) + ".xml";

          var oReq = new XMLHttpRequest();
          oReq.onload = function (res) {
             volume.setUserData(this.responseText);
             callback(null, this.responseText);
          };

          oReq.onerror = function () {
              callback("error");
          };

          oReq.open("get", path, true);
          oReq.send();
      },

      alert : function (message, title) {
          // create the window instance
          var root = qx.core.Init.getApplication().getRoot();

          if (title === undefined) title = this.tr("Erreur : type de fichier");

          var win = new qx.ui.window.Window( title );
          win.setLayout(new qx.ui.layout.VBox(10));

          win.set({
              width : 400,
              alwaysOnTop : true,
              showMinimize : false,
              showMaximize : false,
              centerOnAppear : true,
              modal : true,
              movable : false,
              resizable : false,
              allowMaximize : false,
              allowMinimize : false
          });

          var label = new qx.ui.basic.Label(message);

          label.set({rich: true, wrap : true});

          // label to show the e.g. the alert message
          win.add(label);

          // "ok" button to close the window
          var alertBtn = new qx.ui.form.Button("OK");

          root.add(win);

          alertBtn.addListener("execute", win.close.bind(win));

          win.add(alertBtn);

          alertBtn.setMarginLeft(100);
          alertBtn.setMarginRight(100);

          win.open();

      },


      hackShaders: function(volumeSlice, meshes) {
          meshes.forEach(function(slice) {
              var shader = slice.material.baseShader;
              shader.extraUniforms.push({
                  name: 'thresholdMin',
                  type: "f",
                  value: 128
              });
              shader.extraUniforms.push({
                  name: 'thresholdMax',
                  type: "f",
                  value: 200
              });
              shader.extraShaders.push([
                  'if ( ( value > thresholdMax ) || ( value < thresholdMin ) || ( value == 0.0 ) ) {',
                  'discard;',
                  '} else {',
                  'float range = thresholdMax - thresholdMin;',
                  'correctedValue = ( value - thresholdMin ) / range;',
                  'float blendingOpacity = correctedValue<0.2?easeInOutQuad(correctedValue*5.0):1.0;',
                  'colorIndex = vec2( correctedValue, 0.0 );',
                  'gl_FragColor = texture2D( lookupTable,colorIndex  );',
                  'gl_FragColor.a = opacity*blendingOpacity;',
                  '}'
              ].join('\n'));
              volumeSlice.updateMaterial(slice.material);
          });
      },

      removeFunc: function() {
          if (!this.__volumeFunc) return;

          this.__MPR.removeVolume(this.__volumeFunc);
          this.__meshViewer.removeMeshes(this.__meshesFunc);
          this.__volumeFunc = undefined;
          this.exclude();
      },

      generateChromaLut : function (imgData, scale) {
          var paletteSize = 2000;
          var red = [];
          var green = [];
          var blue = [];
          var alpha = [];
          var args = Array.prototype.slice.call(arguments, 1);

          var genImg = !!imgData && (imgData instanceof ImageData);


          if (genImg)
              paletteSize = imgData.width;

          for (var i = 0; i < paletteSize; i++) {
              var rgba = scale(i/paletteSize).rgba();

              if (genImg) {
                  imgData.data[4 * i] = rgba[0];
                  imgData.data[4 * i + 1] = rgba[1];
                  imgData.data[4 * i + 2] = rgba[2];
                  imgData.data[4 * i + 3] = 255*rgba[3];
              } else {
                  red[i] = rgba[0];
                  green[i] = rgba[1];
                  blue[i] = rgba[2];
                  alpha[i] = 255*rgba[3];
              }
          }

          if (!genImg)
              return [red, green, blue, alpha];
      },

      lutImage: function(generator /*, arguments pass to chroma.scale */) {
          var canvas = document.createElement('canvas');
          canvas.width = this.__widthMenu;
          canvas.height = 16;
          var ctx = canvas.getContext("2d");
          var imgData = new ImageData(this.__widthMenu, 1);
          generator(imgData, Array.prototype.slice.call(arguments, 1));
          for (var i = 1; i < 16; i++) {
              ctx.putImageData(imgData, 0, i);
          }
          return canvas.toDataURL();
      },

      generateLut: function(imgData) {
          var paletteSize = 2000;
          var red = [];
          var green = [];
          var blue = [];
          var alpha = [];
          var colorConverter = new THREE.Color();

          function sigmoid(t, delta) {
            return 1/(1+Math.exp( -t*delta));
          }


          if (imgData)
              paletteSize = imgData.width;

          for (var i = 0; i < paletteSize; i++) {
              colorConverter.setHSL((1 - i / paletteSize) * 230 / 360, 1, 0.5);

              //colorConverter.setHSL((1-sigmoid(2 * i / paletteSize - 1, 2.8))* 230 / 360, 1, 0.5);

              if (imgData) {
                  imgData.data[4 * i] = 255 * colorConverter.r;
                  imgData.data[4 * i + 1] = 255 * colorConverter.g;
                  imgData.data[4 * i + 2] = 255 * colorConverter.b;
                  imgData.data[4 * i + 3] = 255;
              } else {
                  red[i] = 255 * colorConverter.r;
                  green[i] = 255 * colorConverter.g;
                  blue[i] = 255 * colorConverter.b;
                  alpha[i] = 255;
              }
          }
          if (!imgData)
              return [red, green, blue, alpha];
      },
    }
});

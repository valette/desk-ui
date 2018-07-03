
/**
 * @ignore (ImageData)<
 * @ignore (THREE*)
 * @ignore (chroma*)
 */


qx.Class.define("desk.IfeContainer", {
    extend: qx.ui.container.Composite,

    /**
     * constructor
     */
    construct: function(sideViewer) {
	    this.base(arguments);
	    
	    //hack to include
	    new desk.ProgressBar();

	    this.__sideViewer = sideViewer;

	    var layout = new qx.ui.layout.HBox();
        layout.setSpacing(1);

        this.setLayout(layout);

        this.createUI();
        this.removeAll();
    },

    destruct: function() {

    },

    events: {

    },

    properties: {

    },

    members: {
        __MPR: null,
        __meshViewer: null,

        __volumeAnat: null,
        __volumeFunc: null,
        __mesh3DModel : null,

        __buttonOpenAnat: null,
        __buttonOpenFunc: null,
        __buttonOpen3Dmodel: null,
        __buttonCloseAll : null,

        __menu : null,
        __subMenuAnat: null,
        __subMenuFunc: null,
        __subMenuButtons : null,
        
        __collapseButton : null,

        __IRMAnatName : null,
        __IRMFuncName : null,
        
        __funcButtonMeta : null,
        __anatButtonMeta : null,
        
        __contrastSlider : null,
        __brightnessSlider : null,

        __colors : null,

        __seuilSlider : null,
        
        __widthMenu : 220,

        __meshesFunc : [],

        __sideViewer : null,

        /**
         * create UI
         */
        createUI: function() {
            var menu = this.__menu = this.createMenu();
            this.add(menu, {
                flex:0
            });
            
            this.__collapseButton = this.createCollapseButton();
            this.add(this.__collapseButton, {
                flex: 0
            });

            this.add(this.createMPR(), {
                flex: 6
            });

            this.__colors = this.generateLut();
        },

        createMenu: function() {

            var that = this;
            //Menu container
            var layout = new qx.ui.layout.VBox();
            layout.setSpacing(10);
            var container = new qx.ui.container.Composite(layout);
            container.set({
                width: this.__widthMenu
            })
            container.setPadding(10);
            container.setPaddingRight(0);


            container.add(new qx.ui.core.Spacer(), {flex: 1});
            
            this.__subMenuButtons = this.createSubMenuButtons();
            container.add(this.__subMenuButtons);
            
            container.add(new qx.ui.core.Spacer(), {flex: 1});

            this.__subMenuAnat = this.createSubMenuAnat();
            container.add(this.__subMenuAnat);

            container.add(new qx.ui.core.Spacer(), {flex: 1});

            this.__subMenuFunc = this.createSubMenuFunc();
            container.add(this.__subMenuFunc);

            container.add(new qx.ui.core.Spacer(), {flex: 1});

            if (that.__sideViewer) {
                container.add(this.createAbout());
            }

            return container;
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


        createAbout : function () {
            var button = new qx.ui.form.Button(this.tr("A propos de ")+" EduAnat2 v0.1.0").set({decorator: null});

            var win = new qx.ui.window.Window(this.tr("A propos de ")+" EduAnat2 v0.1.0");
            win.set({
                width : 500,
                height : 600,
                alwaysOnTop : true,
                showMinimize : false,
                showMaximize : false,
                centerOnAppear : true,
                modal : true,
                movable : false,
                allowMaximize : false,
                allowMinimize : false,
                resizable : false
            });

            win.setLayout(new qx.ui.layout.VBox(10));

            var logos = new qx.ui.container.Composite(new qx.ui.layout.HBox());

            //logos.add(new qx.ui.core.Spacer(), {flex: 1});
            logos.add(new qx.ui.basic.Image("resource/ife/logo_ife.jpg") );
            //logos.add(new qx.ui.core.Spacer(), {flex: 1});
            logos.add(new qx.ui.basic.Image("resource/ife/logo_ens.jpg") );
            //logos.add(new qx.ui.core.Spacer(), {flex: 1});

            win.add(logos);

            win.add( new qx.ui.basic.Label([
                "Mentions légales :",
                ""
              ].join('<br>') ).set({
                rich : true,
                width: 460
            }) );

            qx.core.Init.getApplication().getRoot().add(win, {left:20, top:20});

            button.addListener("execute", win.open.bind(win));

            return button;
        },




        addAnatFile: function(evt) {

            var dialog = require('electron').remote.dialog;
            var filesList = dialog.showOpenDialog({
              filters : [
                {name: 'Anat Nifti Image', extensions: ['anat.nii.gz']},
                {name: 'Nifti Image', extensions: ['nii.gz']},
                {name: 'All Files', extensions: ['*']}
              
              ],
              properties: ['openFile']
            });
            
            //var name = file.getBrowserObject().name;
            
            if (!filesList || !filesList.length) return;
            
            var name = require("path").basename(filesList[0]);
            
            console.log(filesList);
            if (filesList == null) return;


            var that = this;
            //var file = evt.getData();




            if (name.substr(name.length -7) !== ".nii.gz") {
                this.alert(this.tr("Ne sont acceptés que les fichiers Nifti compressés (.nii.gz)."));
                return;
            }

            this.removeAll();

            window.setTimeout(function() {
                that.__buttonOpenAnat.setEnabled(false);
            }, 1);

            this.__MPR.addVolume(filesList[0], {
                workerSlicer: true,
                noworker: true
            }, function(err, volume) {
            
                var slicer = volume.getUserData("workerSlicer").slicer;
                var prop = volume.getUserData("workerSlicer").properties;
                console.log(prop);
                var dir = 0;
                var slice = 0;
                
                
                var t0 = performance.now();

            
              function profiling(dir) {
                slicer.generateSlice([slice, dir], function () {
                  slice++;
                  //console.log(slice);
                  if (slice < prop.dimensions[dir])
                    profiling(dir, slice);
                  else {
                    var t1 = performance.now() - t0;
                    slice = 0;
                    t0 = performance.now();
                    console.log("PERFORMANCE " + dir + " (ns) : ", 1000*1000*t1/prop.dimensions[dir]/ prop.dimensions[(dir+1)%3]/ prop.dimensions[(dir+2)%3]);
                    
                    console.log("PERFORMANCE " + dir + " (ms) : ", t1/prop.dimensions[dir]);
                    if (dir < 2) profiling(dir+1);
                  }
                    
                });
              }
              /*
              setTimeout(function () {
                profiling(0)
              }, 5000);
              */
            
            
            
            
                that.__volumeAnat = volume;
                volume.setUserData("path", filesList[0]);
                
                that.__anatButtonMeta.exclude();
                that.loadMeta(volume, function (err, meta) {
                  if (err === null) { //show info button
                    that.__anatButtonMeta.show();
                  }
                  else { //show info button
                    that.__anatButtonMeta.exclude();
                  }
                }); 
                
                
                var volSlice = that.__MPR.getVolumeSlices(volume);
                var meshes = that.__meshViewer.attachVolumeSlices(volSlice);

                that.__IRMAnatName.setValue(name);
                that.__buttonOpenFunc.setEnabled(true);
                that.__buttonOpen3Dmodel.setEnabled(true);
                that.__buttonOpenAnat.setEnabled(true);
                that.__subMenuAnat.show();

                that.__buttonCloseAll.setEnabled(true);

                var bbox = new THREE.Box3();
                meshes.forEach( function (obj) {
                    //obj.scale.set(-1, 1, 1);
                    bbox.union( new THREE.Box3().setFromObject(obj) );
                });

                that.resetMeshView();

                var group = new THREE.Group();

                that.__meshViewer.addMesh(group);

                var center = bbox.max.add(bbox.min).divideScalar ( 2 ) ;
                
              
                var l = new THREE.Vector3().copy(bbox.max).sub(bbox.min);
                var maxSize = Math.max(l.x, l.y, l.z);
                
                //var size = 25;
                var size = 0.2*maxSize;
                console.log("Size : ", size);

                group.add( that.createSprite("droite", size, new THREE.Vector3(2*bbox.max.x-bbox.min.x+size*1.5, center.y, center.z)) );
                group.add( that.createSprite("gauche", size, new THREE.Vector3(bbox.min.x-size*1.85, center.y, center.z)) );

                group.add( that.createSprite("ventre", size, new THREE.Vector3(center.x, bbox.max.y*2+size*1.5, center.z)) );
                group.add( that.createSprite("dos", size, new THREE.Vector3(center.x, bbox.min.y-size*1.25, center.z)) );


                group.add( that.createSprite("avant", size, new THREE.Vector3(center.x, center.y, bbox.max.z*2+size*1.25)) );
                group.add( that.createSprite("arrière", size, new THREE.Vector3(center.x, center.y, bbox.min.z-size*1.25)) );


                //Update Zoom Limite
                that.__MPR.getViewers().concat(that.__meshViewer).forEach(function (viewer) {
                  viewer.getControls().setMinZoom(0.3*maxSize);
                  viewer.getControls().setMaxZoom(20*maxSize);
                });
                
                
                //console.log("file path? : ", file.getBrowserObject());
                //var path = file.getBrowserObject().path;
                var path = filesList[0];
                if (path) {
                    console.warn("On Electron ! Load Mesh !");
                    var meshPath;
                    if (name.substr(name.length -12) == ".anat.nii.gz") {
                        meshPath = path.substr(0, path.length-12) + ".stl";
                    }
                    else if (name.substr(name.length -7) == ".nii.gz") {
                      var meshPath = path.substr(0, path.length-7) + ".stl";
                    }
                    
                    console.warn(meshPath);
                    var oReq = new XMLHttpRequest();
                    oReq.responseType = "arraybuffer";
                    oReq.onload = function (res) {
                       console.warn("STL loaded, try to display");
                       that.addMesh(oReq.response);
                       console.log(that.__mesh3DModel);
                       
                       //that.__mesh3DModel.position.setX( volume.__userData.workerSlicer.properties.origin[0] );
                    };
                    oReq.open("get", meshPath, true);
                    oReq.send();
                }



            });

            
        },

        addFuncFile: function(evt) {
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
            
            //var name = file.getBrowserObject().name;
            var name = require("path").basename(filesList[0]);
            
            console.log(filesList);
            if (filesList == null) return;


            var that = this;
            //var file = evt.getData();


            this.removeFunc();

            window.setTimeout(function() {
                that.__buttonOpenAnat.setEnabled(false);
                that.__buttonOpenFunc.setEnabled(false);
            }, 1);

            this.__MPR.addVolume(filesList[0], {
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
            }, function(err, volume) {
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
                that.__buttonOpenFunc.setEnabled(true);
                that.__buttonOpen3Dmodel.setEnabled(true);
                that.__buttonOpenAnat.setEnabled(true);
                that.__subMenuFunc.show();
                
                that.__buttonCloseAll.setEnabled(true);
                /*
                that.__meshesFunc.forEach( function (obj) {
                                obj.scale.set(-1, 1, 1);
                });
                */
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
                

            });
        },

        addMeshFile: function(evt) {
            var file = evt.getData();
            var that = this;


            var name = file.getBrowserObject().name;


            if (name.substr(name.length -4) !== ".stl") {
                this.alert(this.tr("Ne sont acceptés que les maillages au format .stl"));
                return;
            }


            this.removeMesh();

            //Disable button while loading
            window.setTimeout(function() {
                that.__buttonOpen3Dmodel.setEnabled(false);
            }, 1);

            console.log(file);

            var reader = new FileReader();
            reader.onload = function(e) {
                that.addMesh(e.target.result);
            }

            reader.readAsArrayBuffer(file.getBrowserObject());
        },

        addMesh : function (arrayBuffer) {
            var loader = new THREE.STLLoader();

            var geometry = loader.parse( arrayBuffer );

            //https://stackoverflow.com/questions/35843167/three-js-smoothing-normals-using-mergevertices
            var tempGeo = new THREE.Geometry().fromBufferGeometry(geometry);
            tempGeo.mergeVertices();
            // after only mergeVertices my textrues were turning black so this fixed normals issues
            tempGeo.computeVertexNormals();
            tempGeo.computeFaceNormals();
            geometry = new THREE.BufferGeometry().fromGeometry(tempGeo);





            //Rendering BackSide & Scale -1 pour être raccord avec les vues (hack : inversion des normales)
            var material = new THREE.MeshPhongMaterial( { color: 0xff5533, specular: 0x111111, shininess: 50, transparent : true, opacity : 0.7, side: THREE.BackSide } );
            
            console.log(material);
            
            
            var mesh = new THREE.Mesh( geometry, material );
            mesh.renderOrder = 4;
            
            
            mesh.scale.set(-1, 1, 1);
            
            var prop = this.__volumeAnat.getUserData('workerSlicer').properties;
            console.log(prop);
            var offsetX = prop.dimensions[0] * prop.spacing[0];
            mesh.position.set(offsetX, 0, 0);
            

            mesh.flipSided = true;
            //flip every vertex normal in mesh by multiplying normal by -1
            for(var i = 0; i<mesh.geometry.attributes.normal.array.length; i++) {
                mesh.geometry.attributes.normal.array[i] = -mesh.geometry.attributes.normal.array[i];
            }
            
            mesh.material.needsUpdate = true;
            
            mesh.geometry.attributes.normal.needsUpdate = true; // required after the first render
            mesh.geometry.normalsNeedUpdate = true;
            
            console.log(mesh);
            this.__meshViewer.addMesh( mesh );
            this.__mesh3DModel = mesh;
            this.resetMeshView();
            this.__buttonOpen3Dmodel.setEnabled(true);
            
            this.__buttonCloseAll.setEnabled(true);
        },

        removeMesh : function () {
            /* TODO : remove mesh from viewer and dispose memory */
            if (this.__mesh3DModel) {
                this.__meshViewer.removeMesh(this.__mesh3DModel);
                this.__mesh3DModel = undefined;
            }
        },

        createCollapseButton: function() {
            var button = new qx.ui.basic.Image("resource/ife/left.png");
            button.set({
                width: 16,
                scale:true
            });
            var layout = new qx.ui.layout.VBox();
            layout.setAlignY("middle");
            var container = new qx.ui.container.Composite(layout);
            container.add(button);
            var that = this;
            button.addListener("click", function() {
                target = that.getChildren()[0];
                if (target.isVisible()) {
                    target.exclude();
                    button.setSource("resource/ife/right.png");
                } else {
                    target.show();
                    button.setSource("resource/ife/left.png");
                }
            });
            return container;
        },

        createMPR: function() {
            //MPR container
            var options = {
                workerSlicer: true,
                alwaysDisplaySlider: true,
                zoomOnWheel: true,
                maxZoom:2000,
                minZoom:30
            };

            var MPR = new desk.MPRContainer(null, options);

            var meshViewer = this.__meshViewer = new desk.SceneContainer({noOpts:true, sliceOnWheel:false, maxZoom:2000, minZoom:30, cameraFov : 35});
            
            var button = new qx.ui.form.Button("R").set({opacity : 0.5, width : 30});
      		  meshViewer.add (button, {right : 0, bottom : 0});
      		  button.addListener("execute", this.resetMeshView.bind(this));
            
            console.log(meshViewer.getScene());

            MPR.setCustomContainer(meshViewer);
               

            this.__MPR = MPR;

            return MPR;

        },

        link : function (target) {
            this.__MPR.link(target.__MPR);
            this.__meshViewer.link(target.__meshViewer);
        },

        unlink : function () {
            this.__MPR.__viewers.forEach (function (viewer) {
			    viewer.unlink();
			});
			this.__meshViewer.unlink();
        },

               
        createSubMenuButtons: function() {
            var that = this;

            var layout = new qx.ui.layout.VBox();
            var container = new qx.ui.container.Composite(layout);
            
            layout.setSpacing(10);
            container.setPadding(10);
            container.setPaddingRight(0);
            

            /* Button Open Anat */
            
            var buttonOpenAnat = this.__buttonOpenAnat = new qx.ui.form.Button(this.tr("Ouvrir une image anatomique"), 'resource/ife/open_A_small.png');
            
            buttonOpenAnat.getChildControl("label").setAllowGrowX(true);
            buttonOpenAnat.getChildControl("label").setTextAlign("left");
            
            buttonOpenAnat.addListener("execute", this.addAnatFile.bind(this));
            
            container.add(buttonOpenAnat);
        
            var buttonOpenFunc = this.__buttonOpenFunc = new qx.ui.form.Button(this.tr("Ouvrir un calque fonctionnel"), 'resource/ife/open_F_small.png');
            
            
            buttonOpenFunc.getChildControl("label").setAllowGrowX(true);
            buttonOpenFunc.getChildControl("label").setTextAlign("left");

            buttonOpenFunc.addListener("execute", this.addFuncFile.bind(this));

            container.add(buttonOpenFunc);

            var buttonOpen3Dmodel = this.__buttonOpen3Dmodel = new com.zenesis.qx.upload.UploadButton(this.tr("Ouvrir un modèle 3D"), 'resource/ife/open_3D_small.png');

            /* Button Close all */
            var buttonCloseAll = this.__buttonCloseAll = new qx.ui.form.Button(this.tr("Tout fermer"), 'resource/ife/close_small.png');
            buttonCloseAll.getChildControl("label").setAllowGrowX(true);
            buttonCloseAll.getChildControl("label").setTextAlign("left");
            buttonCloseAll.addListener("execute", this.removeAll.bind(this));
            buttonCloseAll.setEnabled(false);
            container.add(buttonCloseAll);

            /* Button compare */
            if (that.__sideViewer) {
                var buttonCompare = new qx.ui.form.Button(this.tr("Comparer deux IRM"));

                buttonCompare.addListener("execute", function () {
                    if (that.__sideViewer.isVisible()) {
                        that.__sideViewer.exclude();
                        buttonCompare.setLabel(that.tr("Comparer deux IRM"));
                        //that.unlink();
                        
                        that.switchMenu(true);
                        that.__sideViewer.switchMenu(true);
                        
                    } else {
                        that.__sideViewer.show();
                        buttonCompare.setLabel(that.tr("Fermer la comparaison"));
                        //that.link(that.__sideViewer);
                        
                        that.switchMenu(false);
                        that.__sideViewer.switchMenu(false);
                        
                    }
                });

                container.add(buttonCompare);
            }
            
            return container;
            
        },
        
        switchMenu : function (vertical) {
            console.warn("vertical", vertical);
            var layout = vertical ? new qx.ui.layout.HBox() : new qx.ui.layout.VBox();
            this.setLayout(layout);
            
            this.remove(this.__menu);
            
            if (!vertical) this.remove(this.__collapseButton); //remove collapse
                
                
            var menu = this.__menu = new qx.ui.container.Composite(vertical ? new qx.ui.layout.VBox() : new qx.ui.layout.HBox());
            
            menu.add(new qx.ui.core.Spacer(), {flex: 1});
            menu.add(this.__subMenuButtons);
            
            var target;
            if (vertical) {
                target = menu;
            }
            else {
                target = new qx.ui.container.Composite(new qx.ui.layout.VBox());
            }

            target.add(this.__subMenuAnat);
            target.add(this.__subMenuFunc);

            menu.add(new qx.ui.core.Spacer(), {flex: 1});
            
            if (target !== menu) menu.add(target);
            
            menu.add(new qx.ui.core.Spacer(), {flex: 1});
            
            this.addAt(menu, vertical?0:1);
            
            if (vertical) this.addAt(this.__collapseButton, 1);
            
        },


        createSubMenuAnat: function() {
            var that = this;

            var layout = new qx.ui.layout.VBox();
            var container = new qx.ui.container.Composite(layout);
            
            var titleContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox());
            
                titleContainer.add(new qx.ui.basic.Label().set({
                    value: "<b>" + this.tr("Image anatomique") + " : </b>",
                    rich: true
                }));
                
                titleContainer.add(new qx.ui.core.Spacer(), {flex: 1});
                
                
                var button_meta = this.__anatButtonMeta = new qx.ui.form.Button(null, 'resource/ife/info_small.png').set({
                    decorator: null
                });
                titleContainer.add(button_meta);
                button_meta.addListener("execute", function() {
                    that.showMeta(that.__volumeAnat);
                });
                
                
            container.add(titleContainer);
            
            this.__IRMAnatName = new qx.ui.basic.Label().set({
                rich: true,
                wrap : true
            });

            this.__IRMAnatName.setAllowGrowX(false);

            container.add(this.__IRMAnatName);


            /* Gestion du contraste */
            var contrastLabel = new qx.ui.basic.Label(this.tr("Contraste") + " : 1.00");
            container.add(contrastLabel);
            var contrastSlider = this.contrastSlider = new qx.ui.form.Slider();
            contrastSlider.set({
                minimum: -28,
                maximum: 28,
                singleStep: 1
            });
            contrastSlider.addListener("changeValue", function(e) {
                var value = Math.pow(10, e.getData() / 40);
                contrastLabel.setValue(that.tr("Contraste") + " : " + value.toFixed(2));
                if (that.__volumeAnat) {
                  that.__volumeAnat.getUserData('slices').forEach(function(volumeSlice) {
                      volumeSlice.setContrast(value);
                  });
                }
            });
            container.add(contrastSlider);


            /* Gestion de la luminosité */
            var brightnessLabel = new qx.ui.basic.Label(this.tr("Luminosité") + " : 0.5");
            container.add(brightnessLabel);
            var brightnessSlider = this.brightnessSlider = new qx.ui.form.Slider();
            brightnessSlider.set({
                minimum: 0,
                maximum: 100,
                singleStep: 1,
                value : 50
            });
            brightnessSlider.addListener("changeValue", function(e) {
                var value = e.getData() / 100;
                brightnessLabel.setValue(that.tr("Luminosité") + " : " + value.toFixed(2));
                if (that.__volumeAnat) {
                  that.__volumeAnat.getUserData('slices').forEach(function(volumeSlice) {
                      volumeSlice.setBrightness((value-0.5)*2 );
                  });
                }
            });
            container.add(brightnessSlider);




            container.add(new qx.ui.core.Spacer(), {
                flex: 1
            });
            container.hide();

            return container;
        },

        createSubMenuFunc: function() {
            var that = this;
            var layout = new qx.ui.layout.VBox();
            var container = new qx.ui.container.Composite(layout);


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
                    that.showMeta(that.__volumeAnat);
                });
                
                var button_close = new qx.ui.form.Button(null, 'resource/ife/close_small_small.png').set({
                    decorator: null
                });
                titleContainer.add(button_close);
                button_close.addListener("execute", this.removeFunc.bind(this));
                
            container.add(titleContainer);
            
            this.__IRMFuncName = new qx.ui.basic.Label().set({
                rich: true,
                wrap : true
            });

            this.__IRMFuncName.setAllowGrowX(false);

            container.add(this.__IRMFuncName);
            

            var seuilLabel = new qx.ui.basic.Label(this.tr("Seuil") + " :");
            container.add(seuilLabel);
            var seuilSlider = this.__seuilSlider = new qx.ui.form.Slider();

            seuilSlider.addListener("changeValue", function(e) {
				        //var prop = that.__volumeFunc.getUserData("workerSlicer").properties;
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

            container.add(seuilSlider);
            container.add(new qx.ui.basic.Label(this.tr("Echelle de couleur : ")));

            var lutArray = [
                //this.generateLut,
                //this.generateLutRB,
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
            container.add(selectBox);

            return container;
        },
        
        showMeta : function (volume) {
            var metadonnees = volume.getUserData("metadonnees");
            var that = this;
            
            if (!metadonnees) {
                this.alert("Métadonnées indisponibles", "Erreur");
            }
            
            this.alert(metadonnees, "Métadonnées");
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

        removeAll: function() {
            this.__MPR.removeAllVolumes();
            this.__meshViewer.removeAllMeshes();

            this.__IRMAnatName.setValue("");

            this.__buttonOpenFunc.setEnabled(false);
            this.__buttonOpen3Dmodel.setEnabled(false);

            this.__subMenuAnat.hide();
            this.__subMenuFunc.hide();

            this.__volumeFunc = undefined;
            this.__volumeAnat = undefined;

            this.__buttonCloseAll.setEnabled(false);
            
            this.contrastSlider.set({value : 0});
            this.brightnessSlider.set({value : 50});


        },

        resetMeshView : function () {
            this.__meshViewer.resetView()
            this.__meshViewer.rotateView(0, -0.5 * Math.PI, 0);
            this.__meshViewer.rotateView(0.75 * Math.PI, 0, 0);
            this.__meshViewer.rotateView(0, 0.1 * Math.PI, 0);
        },

        removeFunc: function() {
            if (!this.__volumeFunc) return;

            this.__MPR.removeVolume(this.__volumeFunc);
            this.__meshViewer.removeMeshes(this.__meshesFunc);
            this.__volumeFunc = undefined;
            this.__subMenuFunc.hide();
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

        generateLutRB: function(imgData) {
            var paletteSize = 2000;
            var red = [];
            var green = [];
            var blue = [];
            var alpha = [];
            var colorConverter = new THREE.Color();

            if (imgData)
                paletteSize = imgData.width;

            for (var i = 0; i < paletteSize; i++) {
                if (imgData) {
                    imgData.data[4 * i] = 255;
                    imgData.data[4 * i + 1] = 255 * i / paletteSize;
                    imgData.data[4 * i + 2] = 255 * i / paletteSize;
                    imgData.data[4 * i + 3] = 255;
                } else {
                    red[i] = 255;
                    green[i] = 255 - 255 * i / paletteSize;
                    blue[i] = 255 - 255 * i / paletteSize;
                    alpha[i] = 255;
                }
            }
            if (!imgData)
                return [red, green, blue, alpha];
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

        createSprite : function (text, size, position) {
            if (!size) size = 100;

            var height = 128;

            var canvas = document.createElement('canvas');
            canvas.height = height;


            var context = canvas.getContext("2d");

            context.font = Math.floor(height*0.6) + 'px Helvetica Arial';

            var width = context.measureText(text).width //* height / 10;

            canvas.width = Math.pow(2, Math.ceil(Math.log(width+100) / Math.log(2)));

            var texture = new THREE.Texture(canvas);

            context.clearRect(0, 0, canvas.width, canvas.height);

            context.font = Math.floor(height*0.6) + 'px Helvetica';

            context.fillStyle = "red";
            context.fillText(text, (canvas.width-width)/2, height*0.8);
            texture.needsUpdate = true;
            
            var material = new THREE.SpriteMaterial({map :texture});
            var mesh = new THREE.Sprite(material);

            mesh.position.copy(position); //.add( new THREE.Vector3(size * width/ height /2, size/2, 0 ) );
            mesh.scale.x = size * canvas.width/ height;
            mesh.scale.y = size;

            return mesh;
        }




    }
});

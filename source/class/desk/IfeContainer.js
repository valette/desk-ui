
/**
 * @ignore (ImageData)<
 * @ignore (THREE*)
 */


qx.Class.define("desk.IfeContainer", {
    extend: qx.ui.container.Composite,

    /**
     * constructor
     */
    construct: function(sideViewer) {
	    this.base(arguments);

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

        __subMenuAnat: null,
        __subMenuFunc: null,

        __IRMAnatName : null,
        __IRMFuncName : null,

        __colors : null,

        __seuilSlider : null,
        
        __widthMenu : 220,

        __meshes : [],

        __sideViewer : null,

        /**
         * create UI
         */
        createUI: function() {
            var menu = this.createMenu();
            this.add(menu, {
                flex: 0
            });

            this.add(this.createCollapseButton(menu), {
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

            /* Button Open Anat */
            var buttonOpenAnat = this.__buttonOpenAnat = new com.zenesis.qx.upload.UploadButton(this.tr("Ouvrir une IRM anatomique"), 'resource/ife/open_A_small.png');
            buttonOpenAnat.getChildControl("label").setAllowGrowX(true);
            buttonOpenAnat.getChildControl("label").setTextAlign("left");

            buttonOpenAnat.setAcceptUpload(".nii.gz");
            var uploader = new com.zenesis.qx.upload.UploadMgr(buttonOpenAnat, "/anat");
            uploader.setAutoUpload(false);
            uploader.addListener("addFile", this.addAnatFile.bind(this));
            container.add(buttonOpenAnat);

            /* Button Open Func */
            var buttonOpenFunc = this.__buttonOpenFunc = new com.zenesis.qx.upload.UploadButton(this.tr("Ouvrir un calque fonctionnel"), 'resource/ife/open_F_small.png');
            buttonOpenFunc.getChildControl("label").setAllowGrowX(true);
            buttonOpenFunc.getChildControl("label").setTextAlign("left");

            buttonOpenFunc.setAcceptUpload(".nii.gz");
            buttonOpenFunc.setEnabled(false);
            var uploader = new com.zenesis.qx.upload.UploadMgr(buttonOpenFunc, "/fonc");
            uploader.setAutoUpload(false);
            uploader.addListener("addFile", this.addFuncFile.bind(this));
            container.add(buttonOpenFunc);

            /* Button Open Mesh */
            var buttonOpen3Dmodel = this.__buttonOpen3Dmodel = new com.zenesis.qx.upload.UploadButton(this.tr("Ouvrir un modèle 3D"), 'resource/ife/open_3D_small.png');
            buttonOpen3Dmodel.getChildControl("label").setAllowGrowX(true);
            buttonOpen3Dmodel.getChildControl("label").setTextAlign("left");

            buttonOpen3Dmodel.setAcceptUpload(".stl");
            buttonOpen3Dmodel.setEnabled(false);
            var uploader = new com.zenesis.qx.upload.UploadMgr(buttonOpen3Dmodel, "/mesh");
            uploader.setAutoUpload(false);
            uploader.addListener("addFile", this.addMeshFile.bind(this));

            container.add(buttonOpen3Dmodel);

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
                    } else {
                        that.__sideViewer.show();
                        buttonCompare.setLabel(that.tr("Fermer la comparaison"));
                        //that.link(that.__sideViewer);
                    }
                });

                container.add(buttonCompare);
            }

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


        alert : function (message) {
            // create the window instance
            var root = qx.core.Init.getApplication().getRoot();
            var win = new qx.ui.window.Window( this.tr("Erreur : type de fichier") );
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

            // label to show the e.g. the alert message

            win.add(new qx.ui.basic.Label(message));

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
            var button = new qx.ui.form.Button(this.tr("A propos") + "...").set({decorator: null});

            var win = new qx.ui.window.Window(this.tr("A propos"));
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
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin mattis erat cursus tristique semper. In pharetra leo ut elementum luctus. Quisque lobortis mi et erat tincidunt eleifend. Morbi molestie commodo venenatis. In et ligula cursus, porta est at, pretium sapien. Vivamus placerat, ligula non molestie finibus, libero metus consectetur leo, sed blandit turpis dolor ac magna. Aenean ac lacus magna. Pellentesque tempor, dui sed efficitur gravida, urna nisi aliquam mi, vel condimentum purus nulla sed libero. Nunc id feugiat justo, vel posuere augue. Curabitur ut dui congue, sollicitudin lectus a, bibendum ligula. Suspendisse iaculis purus eu velit tincidunt, quis consequat lacus ultrices.",
                "Nam dignissim pulvinar sem elementum ornare. Nunc ullamcorper euismod purus vel suscipit. Proin quis luctus nibh. Maecenas luctus urna at iaculis bibendum. Proin placerat nunc cursus lectus luctus semper. Nam volutpat semper magna, id blandit nisl porta vitae. Praesent placerat justo vitae viverra commodo. Etiam ornare odio eget ligula imperdiet semper. Proin imperdiet lorem bibendum eros volutpat commodo vitae vitae nulla. Vivamus sagittis facilisis elit, a tempor nulla luctus et. Etiam feugiat elit tellus, quis euismod nisi eleifend sed. Cras semper purus ut lacinia sollicitudin. Aliquam a consectetur nulla, non maximus lacus.",
                "Vivamus maximus lacus elementum mauris cursus dignissim. Phasellus aliquam, tortor sit amet tempor feugiat, ipsum libero condimentum risus, a pharetra nulla eros id neque. Praesent ac nisl lorem. Curabitur et consectetur mi. Etiam sollicitudin sapien vitae fringilla imperdiet. Suspendisse in ullamcorper diam, id dictum ante. Nam eleifend arcu tincidunt nulla tincidunt, nec faucibus diam cursus. Suspendisse tristique et nibh ut dapibus. Donec magna enim, lacinia ac ultricies quis, dapibus ut odio. Morbi vulputate sit amet mauris at placerat. Fusce vel faucibus tortor. Donec venenatis arcu nec laoreet aliquet. Morbi mattis a justo eget efficitur. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Maecenas fringilla sem vitae viverra hendrerit. In in erat bibendum, dapibus ligula vel, eleifend libero."
              ].join('<br>') ).set({
                rich : true,
                width: 460
            }) );

            qx.core.Init.getApplication().getRoot().add(win, {left:20, top:20});

            button.addListener("execute", win.open.bind(win));

            return button;
        },




        addAnatFile: function(evt) {


            var that = this;
            var file = evt.getData();


            var name = file.getBrowserObject().name;

            if (name.substr(name.length -7) !== ".nii.gz") {
                this.alert(this.tr("Ne sont acceptés que les fichiers Nifti compressés (.nii.gz)."));
                return;
            }

            this.removeAll();

            window.setTimeout(function() {
                that.__buttonOpenAnat.setEnabled(false);
            }, 1);

            this.__MPR.addVolume(file.getBrowserObject(), {
                workerSlicer: true,
                noworker: true
            }, function(err, volume) {
                that.__volumeAnat = volume;
                var volSlice = that.__MPR.getVolumeSlices(volume);
                var meshes = that.__meshViewer.attachVolumeSlices(volSlice);

                that.__IRMAnatName.setValue("<b>" + that.tr("IRM anatomique") + " : </b>" + file.getFilename());
                that.__buttonOpenFunc.setEnabled(true);
                that.__buttonOpen3Dmodel.setEnabled(true);
                that.__buttonOpenAnat.setEnabled(true);
                that.__subMenuAnat.show();

                that.__buttonCloseAll.setEnabled(true);

                var bbox = new THREE.Box3();
                meshes.forEach( function (obj) {
                                obj.scale.set(-1, 1, 1);
                    bbox.union( new THREE.Box3().setFromObject(obj) );
                });

                that.resetMeshView();

                var size = 25;

                var group = new THREE.Group();
                //group.scale.set(1, -1, 1);
                that.__meshViewer.addMesh(group);

                var center = bbox.max.add(bbox.min).divideScalar ( 2 ) ;
                console.log(bbox);

                group.add( that.createSprite("droite", size, new THREE.Vector3(2*bbox.max.x-bbox.min.x+30, center.y, center.z)) ); //
                group.add( that.createSprite("gauche", size, new THREE.Vector3(bbox.min.x-37, center.y, center.z)) ); //

                group.add( that.createSprite("avant", size, new THREE.Vector3(center.x, bbox.max.y*2+30, center.z)) ); //
                group.add( that.createSprite("arrière", size, new THREE.Vector3(center.x, bbox.min.y-25, center.z)) ); //


                group.add( that.createSprite("haut", size, new THREE.Vector3(center.x, center.y, bbox.max.z*2+25)) ); //
                group.add( that.createSprite("bas", size, new THREE.Vector3(center.x, center.y, bbox.min.z-25)) ); //



            });
            console.log("file path? : ", file.getBrowserObject());
            var path = file.getBrowserObject().path;
            if (path) {
                console.warn("On Electron ! Load Mesh !");
                var meshPath = path.substr(0, path.length-7) + ".stl";
                console.warn(meshPath);
                var oReq = new XMLHttpRequest();
                oReq.responseType = "arraybuffer";
                oReq.onload = function (res) {
                   console.warn("STL loaded, try to display");
                   that.addMesh(oReq.response);
                };
                oReq.open("get", meshPath, true);
                oReq.send();
            }
            
        },

        addFuncFile: function(evt) {
            var file = evt.getData();
            var that = this;
            var name = file.getBrowserObject().name;
            if (name.substr(name.length -7) !== ".nii.gz") {
                this.alert(this.tr("Ne sont acceptés que les fichiers Nifti compressés (.nii.gz)."));
                return;
            }



            this.removeFunc();

            window.setTimeout(function() {
                that.__buttonOpenAnat.setEnabled(false);
                that.__buttonOpenFunc.setEnabled(false);
            }, 1);

            this.__MPR.addVolume(file.getBrowserObject(), {
                workerSlicer: true,
                noworker: true,
                colors: that.__colors,
                linearFilter : false,
                opacity: 0.4
            }, function(err, volume) {
                var prop = volume.getUserData("workerSlicer").properties;
                that.__volumeFunc = volume;
                that.__meshes = that.__meshViewer.attachVolumeSlices(that.__MPR.getVolumeSlices(volume));
                that.__IRMFuncName.setValue("<b>" + that.tr("IRM fonctionnelle") + " : </b>" + file.getFilename());
                that.__buttonOpenFunc.setEnabled(true);
                that.__buttonOpen3Dmodel.setEnabled(true);
                that.__buttonOpenAnat.setEnabled(true);
                that.__subMenuFunc.show();
                
                that.__buttonCloseAll.setEnabled(true);
                
                that.__meshes.forEach( function (obj) {
                                obj.scale.set(-1, 1, 1);
                });
                
                var volumeSlice = that.__MPR.getVolumeSlices(volume)[0];

                var slices = that.__MPR.getVolumeMeshes(volume);
                that.hackShaders(volumeSlice, slices);
                that.hackShaders(volumeSlice, that.__meshes);
                that.__seuilSlider.set({
                    minimum: Math.floor(prop.scalarBounds[0] * 100),
                    maximum: Math.floor(prop.scalarBounds[1] * 100),
                    singleStep: 1,
                    value: Math.floor((prop.scalarBounds[0] + prop.scalarBounds[1]) * 50)
                })

                slices.forEach(setMaxThreshold);
                that.__meshes.forEach(setMaxThreshold);

                function setMaxThreshold(target) {
                    target.material.uniforms.thresholdMax.value = prop.scalarBounds[1];
                }

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

            //Rendering BackSide & Scale -1 pour être raccord avec les vues (hack : inversion des normales)
            var material = new THREE.MeshPhongMaterial( { color: 0xff5533, specular: 0x111111, shininess: 50, transparent : true, opacity : 0.7, side: THREE.BackSide } );
            
            var mesh = new THREE.Mesh( geometry, material );
            mesh.renderOrder = 4;
            mesh.scale.set(-1, 1, 1);
            
            mesh.geometry.attributes.normal.needsUpdate = true; // required after the first render
            mesh.flipSided = true;
            //flip every vertex normal in mesh by multiplying normal by -1
            for(var i = 0; i<mesh.geometry.attributes.normal.array.length; i++) {
                mesh.geometry.attributes.normal.array[i] = -mesh.geometry.attributes.normal.array[i];
            }
          
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

        createCollapseButton: function(target) {
            var button = new qx.ui.basic.Image("resource/ife/left.png");
            button.set({
                width: 16,
                scale:true
            });
            var layout = new qx.ui.layout.VBox();
            layout.setAlignY("middle");
            var container = new qx.ui.container.Composite(layout);
            container.add(button);

            button.addListener("dblclick", function() {
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
                zoomOnWheel: true
            };

            var MPR = new desk.MPRContainer(null, options);

            var meshViewer = this.__meshViewer = new desk.SceneContainer({noOpts:true});
            
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

        createSubMenuAnat: function() {
            var that = this;

            var layout = new qx.ui.layout.VBox();
            var container = new qx.ui.container.Composite(layout);
            
            this.__IRMAnatName = new qx.ui.basic.Label().set({
                value: "<b>" + this.tr("IRM anatomique") + " : </b>",
                rich: true,
                //width : this.__widthMenu,
                wrap : true
            });

            this.__IRMAnatName.setAllowGrowX(false);

            container.add(this.__IRMAnatName);



            /* Gestion du contraste */
            var contrastLabel = new qx.ui.basic.Label(this.tr("Contraste") + " : 1.00");
            container.add(contrastLabel);
            var contrastSlider = new qx.ui.form.Slider();
            contrastSlider.set({
                minimum: -28,
                maximum: 28,
                singleStep: 1
            });
            contrastSlider.addListener("changeValue", function(e) {
                var value = Math.pow(10, e.getData() / 40);
                contrastLabel.setValue(that.tr("Contraste") + " : " + value.toFixed(2));

                that.__volumeAnat.getUserData('slices').forEach(function(volumeSlice) {
                    volumeSlice.setContrast(value);
                });
            });
            container.add(contrastSlider);


            /* Gestion de la luminosité */
            var brightnessLabel = new qx.ui.basic.Label(this.tr("Luminosité") + " : 0.5");
            container.add(brightnessLabel);
            var brightnessSlider = new qx.ui.form.Slider();
            brightnessSlider.set({
                minimum: 0,
                maximum: 100,
                singleStep: 1,
                value : 50
            });
            brightnessSlider.addListener("changeValue", function(e) {
                var value = e.getData() / 100;
                brightnessLabel.setValue(that.tr("Luminosité") + " : " + value.toFixed(2));

                that.__volumeAnat.getUserData('slices').forEach(function(volumeSlice) {
                    volumeSlice.setBrightness((value-0.5)*2 );
                });
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

            this.__IRMFuncName = new qx.ui.basic.Label().set({
                value: "<b>" + this.tr("IRM fonctionnelle") + " : </b>",
                rich: true,
                width : this.__widthMenu,
                wrap : true
            })

            var labelFuncContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox());
            labelFuncContainer.setAllowGrowX(false);
            container.add(labelFuncContainer);
            labelFuncContainer.add(this.__IRMFuncName);
            var button_close_func = new qx.ui.form.Button(null, 'resource/ife/close_small_small.png').set({
                decorator: null
            });
            labelFuncContainer.add(new qx.ui.core.Spacer(), {
                flex: 1
            });
            labelFuncContainer.add(button_close_func);
            button_close_func.addListener("execute", this.removeFunc.bind(this));

            var seuilLabel = new qx.ui.basic.Label(this.tr("Seuil") + " :");
            container.add(seuilLabel);
            var seuilSlider = this.__seuilSlider = new qx.ui.form.Slider();

            seuilSlider.addListener("changeValue", function(e) {
				//var prop = that.__volumeFunc.getUserData("workerSlicer").properties;
				var val = (seuilSlider.getValue()-seuilSlider.getMinimum())/(seuilSlider.getMaximum()-seuilSlider.getMinimum())*100;
                seuilLabel.setValue(this.tr("Seuil") + " :" +  Math.floor(val) );
                that.__MPR.getVolumeMeshes(that.__volumeFunc).forEach(updateSlice);
                that.__meshes.forEach(updateSlice);
                that.__meshViewer.render();
                that.__MPR.render();
            });

            function updateSlice(slice) {
                slice.material.uniforms.thresholdMin.value = seuilSlider.getValue() / 100;
            }

            container.add(seuilSlider);
            container.add(new qx.ui.basic.Label(this.tr("Echelle de couleur : ")));

            var lutArray = [
                this.generateLut,
                this.generateLutRB
            ];

            var selectBox = new qx.ui.form.SelectBox();

            lutArray.forEach(function(generator) {
                selectBox.add(new qx.ui.form.ListItem("", that.lutImage(generator)));
            });

            selectBox.addListener("changeSelection", function(e) {
                var index = selectBox.getSelectables().indexOf(e.getData()[0]);
                console.log(index);
                that.__colors = lutArray[index]();
                if (that.__volumeFunc)
                    that.__MPR.setVolumeLUT(that.__volumeFunc, that.__colors);
            });
            container.add(selectBox);

            return container;
        },

        removeAll: function() {
            this.__MPR.removeAllVolumes();
            this.__meshViewer.removeAllMeshes();

            this.__IRMAnatName.setValue("<b>" + this.tr("IRM anatomique") + " : </b>");

            this.__buttonOpenFunc.setEnabled(false);
            this.__buttonOpen3Dmodel.setEnabled(false);

            this.__subMenuAnat.hide();
            this.__subMenuFunc.hide();

            this.__volumeFunc = undefined;
            this.__volumeAnat = undefined;

            this.__buttonCloseAll.setEnabled(false);


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
            this.__volumeFunc = undefined;
            this.__subMenuFunc.hide();
        },

        lutImage: function(generator) {
            var canvas = document.createElement('canvas');
            canvas.width = this.__widthMenu;
            canvas.height = 16;
            var ctx = canvas.getContext("2d");
            var imgData = new ImageData(this.__widthMenu, 1);
            generator(imgData);
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

            if (imgData)
                paletteSize = imgData.width;

            for (var i = 0; i < paletteSize; i++) {
                colorConverter.setHSL((1 - i / paletteSize) * 230 / 360, 1, 0.5);
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
                    'colorIndex = vec2( correctedValue, 0.0 );',
                    'gl_FragColor = texture2D( lookupTable,colorIndex  );',
                    'gl_FragColor.a = opacity;',
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

            console.log(canvas);
            context.font = Math.floor(height*0.6) + 'px Helvetica';

            //context.fillStyle = 'rgba(0, 0, 0, 0.5)';
            //context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = "red";
            context.fillText(text, (canvas.width-width)/2, height*0.8);
            texture.needsUpdate = true;
            
            console.log(text, width, canvas.width);


            var material = new THREE.SpriteMaterial({map :texture});//, depthTest : false});
            var mesh = new THREE.Sprite(material);

            mesh.position.copy(position); //.add( new THREE.Vector3(size * width/ height /2, size/2, 0 ) );
            mesh.scale.x = size * canvas.width/ height;
            mesh.scale.y = size;

            console.log(mesh);

            return mesh;
        }




    }
});

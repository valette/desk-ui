/**
 * Singleton helper class for raytracing
 */

qx.Class.define("desk.THREE.Raytracer",
    {
        // extend: qx.core.Object,

        type: "static",

        // construct: function () {

        // },

        statics: {

            // createDisposableResource: function (objConstructor, params) {
            //     if (typeof objConstructor !== 'function') {
            //         throw new Error("Arg is not a constructor")
            //     }
            //     const obj = new objConstructor(params)
            //     objToDispose.push(obj)
            //     return obj
            // },
            
            // disposeResources: function () {
            //     objToDispose.forEach(obj => {
            //         if (obj.dispose === undefined) {
            //             console.error(`Cannot dispose ${obj.constructor.name}`)
            //             return
            //         }
            //         obj.dispose()
            //     })
            //     objToDispose.length = 0
            // },

            /**
            * Setup raytracer and run rendering in a new Qx window
            * 
            */
            setupAndRun: function (sourceQxScene) {
                const { FullScreenQuad } = THREE;
                const {
                    DynamicPathTracingSceneGenerator,
                    PathTracingRenderer,
                    PhysicalPathTracingMaterial,
                    DenoiseMaterial
                } = THREE.pathtracer;

                const pixelRatio = window.devicePixelRatio
                let resolutionScale = 1 / pixelRatio
                const tilesCount = 11
                let doRaytracing = true
                let samplesPerFrame = 1
                let renderSpeedFactor = 5
            
                const sourceScene = sourceQxScene.getScene();
            
                const qxCanvas = new qx.ui.embed.Canvas();
                qxCanvas.set({ syncDimension: true, zIndex: 0 });
                const htmlCanvas = qxCanvas.getContentElement().getCanvas();
                const tracingWindow = new qx.ui.window.Window();
                tracingWindow.set({ layout: new qx.ui.layout.Canvas(), resizable: false });
                tracingWindow.add(qxCanvas, { width: "100%", height: "100%" });
                tracingWindow.open();
                tracingWindow.center();
                tracingWindow.setAllowMaximize(false)
                tracingWindow.setAllowMinimize(false)
            
                // Init renderer
                const renderer = new THREE.WebGLRenderer({
                    canvas: htmlCanvas,
                    antialias: true,
                    alpha: true,
                    premultipliedAlpha: false
                });
            
                // Raytracer configuration
            
                renderer.autoClear = false
                const w = qxCanvas.getCanvasWidth(), h = qxCanvas.getCanvasHeight();
                renderer.setSize(w, h);
                renderer.setPixelRatio(pixelRatio * resolutionScale);
                tracingWindow.addListener("resize", onResize);
                sourceQxScene.addListener("resize", onResize);
            
                // initialize the path tracing material and renderer
                const ptMaterial = new PhysicalPathTracingMaterial();
                const ptRenderer = new PathTracingRenderer(renderer);
                ptRenderer.setSize(w * pixelRatio * resolutionScale, h * pixelRatio * resolutionScale);
                ptRenderer.tiles.setScalar(tilesCount);
                ptRenderer.camera = sourceQxScene.getCamera();
                ptRenderer.material = ptMaterial;
                ptRenderer.alpha = true
                ptMaterial.backgroundAlpha = 0
            
                // ptMaterial.bounces = 5;
                // ptMaterial.transmissiveBounces = 5;
            
                // init quad for rendering to the canvas
                const fsQuadMaterial = new DenoiseMaterial({
                    map: ptRenderer.target.texture,
                    blending: THREE.CustomBlending,
                })
                fsQuadMaterial.uniforms.threshold.value = 0.08
                const fsQuad = new FullScreenQuad(fsQuadMaterial);
            
                // initialize the scene and update the material properties with the bvh, materials, etc
                const generator = new DynamicPathTracingSceneGenerator(sourceScene);
                const { bvh, textures, materials, lights } = generator.generate(sourceScene);
                const geometry = bvh.geometry;
            
                // update bvh and geometry attribute textures
                ptMaterial.bvh.updateFrom(bvh);
                ptMaterial.attributesArray.updateFrom(
                    geometry.attributes.normal,
                    geometry.attributes.tangent,
                    geometry.attributes.uv,
                    geometry.attributes.color,
                );
            
                // update materials and texture arrays
                ptMaterial.materialIndexAttribute.updateFrom(geometry.attributes.materialIndex);
                ptMaterial.textures.setTextures(renderer, 128, 128, textures);
                ptMaterial.materials.updateFrom(materials, textures);
            
                // update the lights
                ptMaterial.lights.updateFrom(lights);
            
                ptMaterial.environmentIntensity = 0;
                const ambientLight = sourceScene.getObjectByProperty("type", "AmbientLight")
                if (ambientLight !== undefined) {
                    ptMaterial.environmentIntensity = ambientLight.intensity * 0.09
                }
            
                // const backgroundTexture = createDisposableResource(GradientEquirectTexture);
                // let backgroundColorHex = 0xffffff
                // if (sourceScene.background instanceof THREE.Color) {
                //     // If scene background is set to a color, apply it to the raytraced scene
                //     backgroundColorHex = sourceScene.background.getHex()
                // }
                // backgroundTexture.topColor.set(backgroundColorHex);
                // backgroundTexture.bottomColor.set(backgroundColorHex);
                // backgroundTexture.update();
                // // Using this instead of ptMaterial.envMapInfo.updateFrom(texture) makes the background unaffected
                // // by the ambient light (environmentIntensity)
                // ptMaterial.backgroundMap = backgroundTexture
            
                // onResize()
                renderer.setAnimationLoop(animate)
            
                async function onResize() {
                    // await new Promise(res => setTimeout(res, 10)); // Maybe delete ?
                    const size = sourceQxScene.getCanvas().getInnerSize();
                    qxCanvas.set(size);
                    const width = size.width;
                    const height = size.height;
                    ptRenderer.setSize(width * pixelRatio * resolutionScale, height * pixelRatio * resolutionScale)
                    renderer.setSize(width, height, false);
            
                    restartPathTracingRenderer()
                }
            
                tracingWindow.addListener("close", () => {
                    // Stop rendering
                    renderer.setAnimationLoop(null)
            
                    // Clean-up disposable resources
                    ptRenderer.target.dispose()
                    renderer.dispose()
                    fsQuadMaterial.dispose()
                    fsQuad.dispose()
                    // objToDispose.forEach(obj => {
                    //     if (obj.dispose === undefined) {
                    //         console.error(`Cannot dispose of ${obj.constructor.name}`)
                    //         return
                    //     }
                    //     obj.dispose()
                    // })
                    // objToDispose.length = 0
            
                    renderSettingsWindow.destroy()
                    tracingWindow.destroy();
                });
            
                sourceQxScene.addListener("mousewheel", onMouseWheelOrUp)
                sourceQxScene.addListener("mouseup", onMouseWheelOrUp)
                sourceQxScene.addListener("mousedown", onMouseDown)
            
                const renderSettingsWindow = new qx.ui.window.Window();
                initSettingsGui()
            
                // SETTINGS WIDGETS
                function initSettingsGui() {
                    const settingsContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox());
                    // tracingWindow.add(settingsContainer, { left: 0, top: 30, width: "60%", height: "60%" });
                    settingsContainer.set({ maxWidth: 300, maxHeight: 600 });
            
                    const menuContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox())
                    tracingWindow.add(menuContainer)
            
                    const settingsButton = new qx.ui.form.ToggleButton("Settings").set({ opacity: 0.5 })
                    menuContainer.add(settingsButton, { flex: 1 });
            
                    var snapshotButton = new qx.ui.form.Button(null, "desk/camera-photo.png");
                    snapshotButton.addListener("click", () => doSnapshot = true);
                    menuContainer.add(snapshotButton, { flex: 1 })
            
                    settingsButton.addListener("click", function () {
                        // settingsContainer.setVisibility(settingsButton.getValue() ? "visible" : "hidden");
                        // settingsButton.setLabel(settingsButton.getValue() ? "-" : "+");
            
                        renderSettingsWindow.setLayout(new qx.ui.layout.VBox());
                        renderSettingsWindow.add(settingsContainer)
                        renderSettingsWindow.open();
                        renderSettingsWindow.center();
                        renderSettingsWindow.addListener('close', function () {
                            // renderSettingsWindow.destroy();
                            renderSettingsWindow.close()
                        });
                    });
            
                    const grid = new qx.ui.layout.Grid();
                    grid.setSpacing(5);
                    grid.setColumnFlex(0, 1);
                    grid.setColumnFlex(1, 1);
                    grid.setColumnFlex(2, 1);
                    grid.setColumnAlign(0, "left", "bottom");
                    grid.setColumnAlign(1, "center", "bottom");
                    grid.setColumnAlign(2, "right", "bottom");
            
                    const gridContainer = new qx.ui.container.Composite(grid);
                    settingsContainer.add(gridContainer);
            
                    const resolutionSlider = new qx.ui.form.Slider().set({
                        minimum: 1,
                        maximum: 10,
                        value: resolutionScale * 10,
                        singleStep: 1
                    });
                    resolutionSlider.setWidth(300);
                    const resolutionSliderLabel = new qx.ui.basic.Label(resolutionScale.toString());
                    resolutionSlider.addListener("changeValue", function (e) {
                        const newValue = resolutionSlider.getValue()
                        resolutionScale = newValue / 10
                        resolutionSliderLabel.setValue(resolutionScale.toString());
                        // restartPathTracingRenderer()
                        onResize()
                    });
                    gridContainer.add(new qx.ui.basic.Label("Resolution"), { row: 0, column: 0 });
                    gridContainer.add(resolutionSliderLabel, { row: 0, column: 1 });
                    gridContainer.add(new qx.ui.basic.Label("Max"), { row: 0, column: 2 });
                    gridContainer.add(resolutionSlider, {
                        row: 1,
                        column: 0,
                        colSpan: 3
                    });
            
            
                    const renderSpeedSlider = new qx.ui.form.Slider().set({
                        minimum: 1,
                        maximum: 20,
                        value: renderSpeedFactor,
                        singleStep: 1
                    });
                    renderSpeedSlider.setWidth(300);
                    const renderSpeedSliderLabel = new qx.ui.basic.Label(renderSpeedFactor.toString());
                    renderSpeedSlider.addListener("changeValue", function (e) {
                        const newValue = renderSpeedSlider.getValue()
                        renderSpeedFactor = newValue
                        renderSpeedSliderLabel.setValue(renderSpeedFactor.toString());
                    });
                    gridContainer.add(new qx.ui.basic.Label("Render speed"), { row: 2, column: 0 })
                    gridContainer.add(renderSpeedSliderLabel, { row: 2, column: 1 });
                    gridContainer.add(new qx.ui.basic.Label("Max"), { row: 2, column: 2 });
                    gridContainer.add(renderSpeedSlider, {
                        row: 3,
                        column: 0,
                        colSpan: 3
                    });
            
                    const toneMappingButton = new qx.ui.form.Button("None")
                    toneMappingButton.addListener("execute", function (e) {
                        const toneMappingNames = ["None", "Linear", "Reinhard", "Cineon", "ACESFilmic"]
                        const nextToneMappingIndex = (renderer.toneMapping + 1) % toneMappingNames.length
                        renderer.toneMapping = nextToneMappingIndex;
                        toneMappingButton.setLabel(toneMappingNames[nextToneMappingIndex])
                    })
                    gridContainer.add(new qx.ui.basic.Label("Tone mapping:"), { row: 4, column: 0 })
                    gridContainer.add(toneMappingButton, {
                        row: 4,
                        column: 1,
                        colSpan: 2
                    })
            
                    const toneExposureSlider = new qx.ui.form.Slider().set({
                        minimum: -9,
                        maximum: 21,
                        value: 1,
                        singleStep: 1
                    });
                    toneExposureSlider.setWidth(300);
                    const toneExposureSliderLabel = new qx.ui.basic.Label("1");
                    toneExposureSlider.addListener("changeValue", function (e) {
                        const newValue = toneExposureSlider.getValue()
                        renderer.toneMappingExposure = (1 + (newValue - 1) / 10)
                        toneExposureSliderLabel.setValue(renderer.toneMappingExposure.toString());
                    });
                    gridContainer.add(new qx.ui.basic.Label("Tone exposure"), { row: 5, column: 0 })
                    gridContainer.add(toneExposureSliderLabel, { row: 5, column: 1 });
                    gridContainer.add(new qx.ui.basic.Label("Max"), { row: 5, column: 2 });
                    gridContainer.add(toneExposureSlider, {
                        row: 6,
                        column: 0,
                        colSpan: 3
                    });
            
                    // Denoiser configuration
                    const kSigma = fsQuadMaterial.uniforms.kSigma
                    const kSigmaSlider = new qx.ui.form.Slider().set({
                        minimum: 0,
                        maximum: 30,
                        value: kSigma.value * 10,
                        singleStep: 2
                    });
                    kSigmaSlider.setWidth(300);
                    const kSigmaSliderLabel = new qx.ui.basic.Label(kSigma.value.toString());
                    kSigmaSlider.addListener("changeValue", function (e) {
                        const newValue = kSigmaSlider.getValue()
                        kSigma.value = newValue / 10
                        kSigmaSliderLabel.setValue(kSigma.value.toString());
                    });
                    gridContainer.add(new qx.ui.basic.Label("kSigma"), { row: 7, column: 0 })
                    gridContainer.add(kSigmaSliderLabel, { row: 7, column: 1 });
                    gridContainer.add(new qx.ui.basic.Label("Max"), { row: 7, column: 2 });
                    gridContainer.add(kSigmaSlider, {
                        row: 8,
                        column: 0,
                        colSpan: 3
                    });
            
                    const sigma = fsQuadMaterial.uniforms.sigma
                    const sigmaSlider = new qx.ui.form.Slider().set({
                        minimum: 1,
                        maximum: 30,
                        value: sigma.value * 2,
                        singleStep: 1
                    });
                    sigmaSlider.setWidth(300);
                    const sigmaSliderLabel = new qx.ui.basic.Label(sigma.value.toString());
                    sigmaSlider.addListener("changeValue", function (e) {
                        const newValue = sigmaSlider.getValue()
                        sigma.value = newValue / 2
                        sigmaSliderLabel.setValue(sigma.value.toString());
                    });
                    gridContainer.add(new qx.ui.basic.Label("sigma"), { row: 9, column: 0 })
                    gridContainer.add(sigmaSliderLabel, { row: 9, column: 1 });
                    gridContainer.add(new qx.ui.basic.Label("Max"), { row: 9, column: 2 });
                    gridContainer.add(sigmaSlider, {
                        row: 10,
                        column: 0,
                        colSpan: 3
                    });
            
                    const threshold = fsQuadMaterial.uniforms.threshold
                    const thresholdSlider = new qx.ui.form.Slider().set({
                        minimum: 1,
                        maximum: 50,
                        value: threshold.value * 100,
                        singleStep: 1
                    });
                    thresholdSlider.setWidth(300);
                    const thresholdSliderLabel = new qx.ui.basic.Label(threshold.value.toString());
                    thresholdSlider.addListener("changeValue", function (e) {
                        const newValue = thresholdSlider.getValue()
                        threshold.value = newValue / 100
                        thresholdSliderLabel.setValue(threshold.value.toString());
                    });
                    gridContainer.add(new qx.ui.basic.Label("threshold"), { row: 11, column: 0 })
                    gridContainer.add(thresholdSliderLabel, { row: 11, column: 1 });
                    gridContainer.add(new qx.ui.basic.Label("Max"), { row: 11, column: 2 });
                    gridContainer.add(thresholdSlider, {
                        row: 12,
                        column: 0,
                        colSpan: 3
                    });
                }
            
                function onMouseWheelOrUp() {
                    restartPathTracingRenderer()
                }
            
                function onMouseDown() {
                    doRaytracing = false
                    ptRenderer.reset()
                }
            
                function restartPathTracingRenderer() {
                    regenerateSceneLights()
                    doRaytracing = true
                    ptRenderer.reset()
                }
            
                function regenerateSceneLights() {
                    const { lights, bvh, textures, materials } = generator.generate(sourceScene);
            
                    const geometry = bvh.geometry;
            
                    // update bvh and geometry attribute textures
                    ptMaterial.bvh.updateFrom(bvh);
                    ptMaterial.attributesArray.updateFrom(
                        geometry.attributes.normal,
                        geometry.attributes.tangent,
                        geometry.attributes.uv,
                        geometry.attributes.color,
                    );
            
                    // update materials and texture arrays
                    ptMaterial.materialIndexAttribute.updateFrom(geometry.attributes.materialIndex);
                    ptMaterial.textures.setTextures(renderer, 128, 128, textures);
                    ptMaterial.materials.updateFrom(materials, textures);
            
                    ptMaterial.lights.updateFrom(lights);
                }
            
                let doSnapshot = false;
            
                function animate() {
                    // update the camera and render one sample
                    ptRenderer.camera.updateMatrixWorld();
            
                    if (doRaytracing) {
                        for (let i = 0; i < samplesPerFrame * renderSpeedFactor; i++) {
                            ptRenderer.update();
                        }
            
                    } else {
                        renderer.render(sourceScene, sourceQxScene.getCamera())
                    }
            
                    // if using alpha = true then the target texture will change every frame
                    // so we must retrieve it before render.
                    fsQuad.material.map = ptRenderer.target.texture;
            
                    // copy the current state of the path tracer to canvas to display
                    fsQuad.render(renderer);
                    if (doSnapshot) {
                        takeSnapshot()
                        doSnapshot= false
                    }
                }
            
                function takeSnapshot() {
                    const dataURL = htmlCanvas.toDataURL("image/png");
                    const binary = atob(dataURL.split(',')[1]);
                    const array = [];
                    for (let i = 0; i < binary.length; i++) array.push(binary.charCodeAt(i));
                    const blob = new Blob([new Uint8Array(array)], { type: 'image/png' });
                    const a = document.createElement('a');
                    a.href = window.URL.createObjectURL(blob);
                    const date = new Date();
            
                    a.download = "snapshot-" + date.getFullYear() + "-" +
                        (date.getMonth() + 1) + "-" + date.getDate() + "_" +
                        date.getHours() + "h" + date.getMinutes() + "mn" +
                        date.getSeconds() + "s" + ".png";
            
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            }
        },

        // members: {}
    });

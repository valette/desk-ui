/**
 * Singleton helper class for raytracing
 */

qx.Class.define("desk.THREE.Raytracer",
    {
        type: "static",

        statics: {

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
            
                const sourceThreeScene = sourceQxScene.getScene();
            
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
            
                const renderer = new THREE.WebGLRenderer({
                    canvas: htmlCanvas,
                    antialias: true,
                    alpha: true,
                    premultipliedAlpha: false
                });
            
               
                renderer.autoClear = false
                const w = qxCanvas.getCanvasWidth(), h = qxCanvas.getCanvasHeight();
                renderer.setSize(w, h);
                renderer.setPixelRatio(pixelRatio * resolutionScale);
                tracingWindow.addListener("resize", onResize);
                sourceQxScene.addListener("resize", onResize);
            
                // Raytracer configuration
                // initialize the path tracing material and renderer
                const ptMaterial = new PhysicalPathTracingMaterial();
                const ptRenderer = new PathTracingRenderer(renderer);
                ptRenderer.setSize(w * pixelRatio * resolutionScale, h * pixelRatio * resolutionScale);
                ptRenderer.tiles.setScalar(tilesCount);
                ptRenderer.camera = sourceQxScene.getCamera();
                ptRenderer.material = ptMaterial;
                ptRenderer.alpha = true
                ptMaterial.backgroundAlpha = 0
            
                // init quad for rendering to the canvas
                const fsQuadMaterial = new DenoiseMaterial({
                    map: ptRenderer.target.texture,
                    blending: THREE.CustomBlending,
                })
                fsQuadMaterial.uniforms.threshold.value = 0.08
                const fsQuad = new FullScreenQuad(fsQuadMaterial);
            
                // initialize the scene and update the material properties with the bvh, materials, etc
                const generator = new DynamicPathTracingSceneGenerator(sourceThreeScene);
                const { bvh, textures, materials, lights } = generator.generate(sourceThreeScene);
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
                const ambientLight = sourceThreeScene.getObjectByProperty("type", "AmbientLight")
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
            
                // Use this instead of requestAnimationFrame, because the latter isn't able to stop rendering
                // upon closing the window
                renderer.setAnimationLoop(animate)
            
                async function onResize() {
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
            
                    renderSettingsWindow.destroy()
                    tracingWindow.destroy();
                });
            
                sourceQxScene.addListener("mousewheel", onMouseWheelOrUp)
                sourceQxScene.addListener("mouseup", onMouseWheelOrUp)
                sourceQxScene.addListener("mousedown", onMouseDown)
            
                const renderSettingsWindow = new qx.ui.window.Window();
                initSettingsGui()
            
                function initSettingsGui() {
                    const menuContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox())
                    tracingWindow.add(menuContainer)
            
                    const settingsButton = new qx.ui.form.ToggleButton("Settings").set({ opacity: 0.5 })
                    menuContainer.add(settingsButton, { flex: 1 });
            
                    var snapshotButton = new qx.ui.form.Button(null, "desk/camera-photo.png");
                    snapshotButton.addListener("click", () => doSnapshot = true);
                    menuContainer.add(snapshotButton, { flex: 1 })

                    const settingsContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox());
                    settingsContainer.set({ width: 300 });
            
                    settingsButton.addListener("click", function () {
                        renderSettingsWindow.setLayout(new qx.ui.layout.VBox());
                        renderSettingsWindow.add(settingsContainer)
                        renderSettingsWindow.open();
                        renderSettingsWindow.center();
                        renderSettingsWindow.addListener('close', function () {
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

                    function setupSlider(name, qxConfig, realStartValue, startRow, changeValueCallback) {
                        const slider = new qx.ui.form.Slider().set(qxConfig);
                        const valueLabel = new qx.ui.basic.Label(realStartValue.toString());
                        slider.addListener("changeValue", e => changeValueCallback(e.getData(), valueLabel));

                        gridContainer.add(new qx.ui.basic.Label(name), { row: startRow, column: 0 });
                        gridContainer.add(valueLabel, { row: startRow, column: 1 });
                        gridContainer.add(new qx.ui.basic.Label("Max"), { row: startRow, column: 2 });
                        gridContainer.add(slider, {
                            row: startRow + 1,
                            column: 0,
                            colSpan: 3
                        });
                    }

                    setupSlider("Resolution", {
                        minimum: 1,
                        maximum: 10,
                        value: resolutionScale * 10,
                        singleStep: 1
                    }, resolutionScale, 0, function (newValue, label) {
                        resolutionScale = newValue / 10
                        label.setValue(resolutionScale.toString());
                        onResize()
                    })
            
                    setupSlider("Render speed", {
                        minimum: 1,
                        maximum: 20,
                        value: renderSpeedFactor,
                        singleStep: 1
                    }, renderSpeedFactor, 2, function (newValue, label) {
                        renderSpeedFactor = newValue
                        label.setValue(renderSpeedFactor.toString());
                    })
            
                    const toneMappingButton = new qx.ui.form.Button("None")
                    toneMappingButton.set({ width: 100 })
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
            
                    setupSlider("Tone exposure", {
                        minimum: -9,
                        maximum: 21,
                        value: 1,
                        singleStep: 1
                    }, 1, 5, function (newValue, label) {
                        renderer.toneMappingExposure = (1 + (newValue - 1) / 10)
                        label.setValue(renderer.toneMappingExposure.toString());
                    })
            
                    // Denoiser configuration
                    const kSigma = fsQuadMaterial.uniforms.kSigma
                    setupSlider("kSigma", {
                        minimum: 0,
                        maximum: 30,
                        value: kSigma.value * 10,
                        singleStep: 2
                    }, kSigma.value, 7, function (newValue, label) {
                        kSigma.value = newValue / 10
                        label.setValue(kSigma.value.toString());
                    })
            
                    const sigma = fsQuadMaterial.uniforms.sigma
                    setupSlider("Sigma", {
                        minimum: 1,
                        maximum: 30,
                        value: sigma.value * 2,
                        singleStep: 1
                    }, sigma.value, 9, function (newValue, label) {
                        sigma.value = newValue / 2
                        label.setValue(sigma.value.toString());
                    })
            
                    const threshold = fsQuadMaterial.uniforms.threshold
                    setupSlider("Edge sharpening threshold", {
                        minimum: 1,
                        maximum: 50,
                        value: threshold.value * 100,
                        singleStep: 1
                    }, threshold.value, 11, function (newValue, label) {
                        threshold.value = newValue / 100
                        label.setValue(threshold.value.toString());
                    })
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
                    const { lights, bvh, textures, materials } = generator.generate(sourceThreeScene);
            
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
                    // update the camera before rendering samples
                    ptRenderer.camera.updateMatrixWorld();
            
                    if (doRaytracing) {
                        for (let i = 0; i < samplesPerFrame * renderSpeedFactor; i++) {
                            ptRenderer.update();
                        }
                    } else {
                        renderer.render(sourceThreeScene, sourceQxScene.getCamera())
                    }
            
                    // if using alpha = true then the target texture will change every frame
                    // so we must retrieve it before render.
                    fsQuad.material.map = ptRenderer.target.texture;
            
                    // copy the current state of the path tracer to canvas to display
                    fsQuad.render(renderer);
                    if (doSnapshot) {
                        desk.THREE.Raytracer.takeSnapshot(htmlCanvas)
                        doSnapshot= false
                    }
                }
            },

            takeSnapshot: function (htmlCanvas) {
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
    });

# DESK-UI Complete API Reference

This document provides a comprehensive reference for all public classes, singletons, mixins, properties, methods, and events in the `desk-ui` framework.

> [!NOTE]
> `desk-ui` features dynamic promisification via `desk.core.AddPromises`. Most asynchronous methods accepting a callback also have an `*Async` counterpart returning a native `Promise`. Both forms are documented below.

---

## Table of Contents

- [Core Subsystem](#1-core-subsystem)
  - [desk.Application](#deskapplication)
  - [desk.FileSystem](#deskfilesystem)
  - [desk.Actions](#deskactions)
  - [desk.Action](#deskaction)
  - [desk.URLParameters](#deskurlparameters)
  - [desk.Random](#deskrandom)
- [Mixins](#2-mixins)
  - [desk.WindowMixin](#deskwindowmixin)
  - [desk.LinkMixin](#desklinkmixin)
- [3D Visualization (`desk.THREE.*`)](#3-3d-visualization-deskthree)
  - [desk.THREE.Scene](#deskthreescene)
  - [desk.THREE.Container](#deskthreecontainer)
  - [desk.THREE.Viewer](#deskthreeviewer)
  - [desk.THREE.Animator](#deskthreeanimator)
  - [desk.THREE.Loader](#deskthreeloader)
- [Multi-Planar Reconstruction (`desk.MPR.*`)](#4-multi-planar-reconstruction-deskmpr)
  - [desk.MPR.Container](#deskmprcontainer)
  - [desk.MPR.Volume](#deskmprvolume)
  - [desk.MPR.Slice](#deskmprslice)
  - [desk.MPR.SliceView](#deskmprsliceview)
  - [desk.MPR.Slicer](#deskmprslicer)
  - [desk.MPR.Viewer](#deskmprviewer)
  - [desk.MPR.SegTools](#deskmprsegtools)
  - [desk.MPR.CropTool](#deskmprcroptool)
- [Code Editing (`desk.Ace.*`)](#5-code-editing-deskace)
  - [desk.Ace.Container](#deskacecontainer)
  - [desk.Ace.Editor](#deskaceeditor)
  - [desk.Ace.TabbedEditor](#deskacetabbededitor)
- [Terminals and Logs (`desk.Xterm.*`)](#6-terminals-and-logs-deskxterm)
  - [desk.Xterm.Container](#deskxtermcontainer)
  - [desk.Xterm.Terminal](#deskxtermterminal)
  - [desk.Xterm.Logger](#deskxtermlogger)
  - [desk.Xterm.FileTail](#deskxtermfiletail)
- [File Navigation and Tools](#7-file-navigation-and-tools)
  - [desk.FileBrowser](#deskfilebrowser)
  - [desk.FileField](#deskfilefield)
  - [desk.Uploader](#deskuploader)
  - [desk.TabView](#desktabview)

---

## 1. Core Subsystem

### `desk.Application`
**Extends:** `qx.application.Standalone`
**Purpose:** Main application entry point for `desk-ui`.

#### Key Responsibilities
- Initializes `desk.Actions.initAsync()`.
- Hides the initial HTML loading splash screen (`#loading`).
- Checks URL parameters for auto-execution:
  - If `noauto` is not present, attempts to run `desk_startup_script` or `code/init.js`.
  - If URL contains `?script=path/to/script.js`, runs that script.
  - Otherwise, opens a root `desk.FileBrowser` in standalone mode.

---

### `desk.FileSystem`
**Extends:** `qx.core.Object` (Singleton)
**Purpose:** Virtual file system abstraction for reading, writing, querying, and traversing files.

#### Static Methods

##### `desk.FileSystem.readFile(file, options, callback, context)`
##### `desk.FileSystem.readFileAsync(file, options) -> Promise<String>`
Loads file contents into memory.
- `file` (*String*): Relative file path (e.g., `'data/file.txt'`).
- `options` (*Object*, optional):
  - `cache` (*Boolean*): Cache response (default: `false`).
  - `forceText` (*Boolean*): Force text parsing.
- `callback` (*Function*, optional): `function(err, content)`.

##### `desk.FileSystem.readURL(url, options, callback, context)`
##### `desk.FileSystem.readURLAsync(url, options) -> Promise<String>`
Loads arbitrary URL content via `qx.io.request.Xhr`.

##### `desk.FileSystem.writeFile(file, content, options, callback, context)`
##### `desk.FileSystem.writeFileAsync(file, content, options) -> Promise`
Writes content to a file on the server.
- `file` (*String*): Target file path.
- `content` (*String*): Text or encoded data.
- `options` (*Object*, optional): `{ binary: true }` to encode via Base64.

##### `desk.FileSystem.writeJSON(file, object, callback, context)`
##### `desk.FileSystem.writeJSONAsync(file, object) -> Promise`
Serializes and writes a JavaScript object as JSON.

##### `desk.FileSystem.writeCachedFile(name, content, callback, context)`
##### `desk.FileSystem.writeCachedFileAsync(name, content) -> Promise<String>`
Writes content into a deterministic content-addressable cache path (`cache/<hash>/<name>`). Returns the generated file path.

##### `desk.FileSystem.readDir(path, callback, context)`
##### `desk.FileSystem.readDirAsync(path) -> Promise<Array>`
Lists contents of a server directory. Resolves with an array of objects: `[{ name: String, isDirectory: Boolean, size: Number }]`.

##### `desk.FileSystem.exists(path, callback, context)`
##### `desk.FileSystem.existsAsync(path) -> Promise<Boolean>`
Checks if a file or directory exists on the backend.

##### `desk.FileSystem.mkdirp(dir, callback, context)`
##### `desk.FileSystem.mkdirpAsync(dir) -> Promise`
Recursively creates directories on the server.

##### `desk.FileSystem.traverse(directory, iterator, asynchronous, callback, context)`
##### `desk.FileSystem.traverseAsync(directory, iterator, asynchronous) -> Promise`
Recursively traverses all files under `directory`.
- `iterator` (*Function*): Invoked for each file found: `function(filePath, [callback])`.

##### `desk.FileSystem.executeScript(file, callback, context)`
##### `desk.FileSystem.executeScriptAsync(file) -> Promise`
Loads and executes a remote JavaScript file inside a local closure with `__dirname` bound to the file's parent directory.

##### `desk.FileSystem.includeScripts(scripts, callback, context)`
##### `desk.FileSystem.includeScriptsAsync(scripts) -> Promise`
Injects an array of `<script>` tags into the DOM sequentially.

##### `desk.FileSystem.downloadFile(file, downloadName)`
Triggers a browser file download for a given server path.

##### `desk.FileSystem.getFileURL(file) -> String`
Converts a relative workspace file path into a fully qualified HTTP/local URL.

##### `desk.FileSystem.getBaseURL() -> String`
Returns the root base URL (e.g. `http://localhost:8080/` or relative path).

##### `desk.FileSystem.getFileDirectory(file) -> String`
Extracts directory path from file path.

##### `desk.FileSystem.getFileName(file) -> String`
Extracts base file name including extension.

##### `desk.FileSystem.getFileExtension(file) -> String`
Extracts extension (without the dot).

---

### `desk.Actions`
**Extends:** `qx.core.Object` (Singleton)
**Purpose:** Dispatches RPC tasks, tracks running jobs, handles streaming stdout/stderr, and manages action caching.

#### Properties
- `forceUpdate` (*Boolean*, init: `false`, event: `changeForceUpdate`): When true, bypasses RPC server-side cache.

#### Static Methods

##### `desk.Actions.init(callback, context)`
##### `desk.Actions.initAsync() -> Promise`
Waits until the backend action definitions have been fetched and parsed.

##### `desk.Actions.execute(params, options, callback, context) -> String`
##### `desk.Actions.executeAsync(params, options) -> Promise<Object>`
Executes an RPC action on the server.
- `params` (*Object*): Action parameters. Must contain `{ action: 'action_name', ... }`.
- `options` (*Object*, optional):
  - `listener` (*Function*): Streaming event listener: `function(message)`. Receives `{ type: 'stdout'|'stderr'|'progress', data: String }`.
  - `force_update` (*Boolean*): Force cache invalidation for this run.
- `callback` (*Function*, optional): `function(err, result)`.
- **Returns:** Unique string `handle` for managing or killing the action.

##### `desk.Actions.killAction(handle, callback, context)`
##### `desk.Actions.killActionAsync(handle) -> Promise`
Terminates a running action on the backend by handle ID.

##### `desk.Actions.getAction(name) -> Object`
Returns the JSON definition describing the specified action.

##### `desk.Actions.getEngine() -> String`
Returns current runtime engine: `'node'`, `'electron'`, or `'nw'`.

##### `desk.Actions.getSettingsButton() -> qx.ui.form.MenuButton`
Returns the top-right system configuration menu button.

---

### `desk.Action`
**Extends:** `qx.ui.container.Composite`
**Purpose:** Visual UI widget representing an RPC action, generating controls from parameter metadata and supporting action pipelining.

#### Constructor
`new desk.Action(name, options)`
- `name` (*String*): Registered action identifier.
- `options` (*Object*, optional): `{ standalone: Boolean }`.

#### Properties
- `forceUpdate` (*Boolean*, init: `false`): Disables caching for this action instance.
- `forceCache` (*Boolean*, init: `false`): Forces caching.

#### Events
- `actionTriggered`: Fired when the action execution starts.
- `actionUpdated`: Fired when execution completes.
- `changeParameter`: Fired when an action parameter is altered.
- `changeOutputDirectory`: Fired when the target output path changes.

#### Instance Methods
- `execute(callback, context)` / `executeAsync() -> Promise`: Executes this action using current UI parameters.
- `connect(parameter, parentAction, fileName)`: Pipes the output file `fileName` of `parentAction` directly into `parameter`.
- `disconnect(parameter, parentAction, fileName)`: Removes a pipe connection.
- `setParameters(params)`: Populates controls from a parameter map.
- `getParameters() -> Object`: Returns current UI parameter values.
- `setOutputDirectory(directory)`: Sets target output path.
- `getOutputDirectory() -> String`: Returns target output path.

---

### `desk.URLParameters`
**Extends:** `qx.core.Object` (Singleton)
**Purpose:** Utility for reading query parameters and configuring application launches.

#### Static Methods
- `desk.URLParameters.getParameter(name) -> any`: Returns parsed URL query value. Automatically parses JSON strings, booleans, and numbers.
- `desk.URLParameters.parseParameters(targetObject)`: Overrides keys in `targetObject` with values matching URL query parameters. Supports arrays (`?items=1,2,3`).

---

### `desk.Random`
**Extends:** `qx.core.Object`
**Purpose:** Deterministic, seedable pseudo-random number generator (Mersenne Twister).

#### Constructor
`new desk.Random(seed)`
- `seed` (*Integer*, default: `1`).

#### Instance Methods
- `random() -> Float`: Returns pseudo-random float in `[0, 1)`.

---

## 2. Mixins

### `desk.WindowMixin`
**Purpose:** Mixin that wraps any composite widget inside a movable, resizable `qx.ui.window.Window`.

#### Injected Methods
- `getWindow() -> qx.ui.window.Window`: Returns the wrapping window widget.
- `fillScreen()`: Maximizes the container to overlay the whole browser viewport.
- `close()`: Closes and disposes the window.

#### Injected Window Controls
Adds caption-bar shortcuts:
- **`L`**: Snaps window to the left half of the display.
- **`R`**: Snaps window to the right half of the display.

---

### `desk.LinkMixin`
**Purpose:** Enables synchronization of camera poses, rotations, zoom levels, and crosshairs across multiple viewers.

#### Injected Methods
- `link(source)`: Joins the link group of `source`.
- `unlink()`: Removes this object from its link group.
- `getLinks() -> Array`: Returns all objects currently linked in this group.

---

## 3. 3D Visualization (`desk.THREE.*`)

### `desk.THREE.Scene`
**Extends:** `qx.ui.container.Composite`
**Includes:** `desk.LinkMixin`
**Purpose:** Base WebGL container hosting a Three.js `Scene`, `Camera`, `WebGLRenderer`, and `TrackballControls2`.

#### Constructor
`new desk.THREE.Scene(options)`
- `options` (*Object*, optional):
  - `orthographic` (*Boolean*): Use orthographic camera instead of perspective.
  - `cameraFov` (*Number*): Custom field of view.
  - `cameraFront` (*Array* | *THREE.Vector3*): Initial camera direction.
  - `cameraUp` (*Array* | *THREE.Vector3*): Initial camera up vector.

#### Instance Methods
- `getScene() -> THREE.Scene`: Returns underlying Three.js scene.
- `getCamera() -> THREE.Camera`: Returns camera instance.
- `getControls() -> THREE.TrackballControls2`: Returns trackball controller.
- `getRenderer() -> THREE.WebGLRenderer`: Returns WebGL renderer.
- `getCanvas() -> HTMLCanvasElement`: Returns HTML5 rendering canvas.
- `render()`: Debounced render trigger.
- `renderAsync() -> Promise`: Resolves once the next frame has rendered.
- `viewAll()`: Automatically adjusts camera distance and center to frame all meshes.
- `resetView()`: Resets camera to initial orientation.

---

### `desk.THREE.Container`
**Extends:** `desk.THREE.Scene`
**Purpose:** Rich 3D workspace with file hierarchy tree, multi-format mesh loading, clipping planes, material properties, and animation support.

#### Constructor
`new desk.THREE.Container(file, options, callback, context)`
- `file` (*String*, optional): Mesh file path to load immediately.
- `options` (*Object*, optional):
  - `noOpts` (*Boolean*): Hide options overlay button.
  - `convertVTK` (*Boolean*): Convert VTK files to CTM automatically.
  - `maxZoom` / `minZoom` (*Number*): Restrict zoom range.

#### Instance Methods
- `addFile(file, options, callback, context)` / `addFileAsync(file, options) -> Promise<THREE.Object3D>`: Loads and renders a 3D geometry file (.vtk, .vtp, .ply, .stl, .obj, .ctm, .xyz).
- `snapshot(options)` / `snapshotAsync(options) -> Promise<String>`: Captures canvas screenshot to image data URL or file.
- `addClippingPlane()`: Attaches interactive clipping plane to slice through 3D meshes.
- `deleteAllMeshes()`: Removes all loaded meshes from the scene.
- `getMeshes() -> Array<THREE.Mesh>`: Returns list of user meshes.

---

### `desk.THREE.Viewer`
**Extends:** `desk.THREE.Container`
**Includes:** `desk.WindowMixin`
**Purpose:** Standalone window wrapper for `desk.THREE.Container`.

#### Constructor
`new desk.THREE.Viewer(file, options, callback, context)`

---

### `desk.THREE.Animator`
**Extends:** `qx.core.Object`
**Purpose:** Keyframed camera trajectories, rotations, and mesh transformations for recording animations.

---

### `desk.THREE.Loader`
**Extends:** `qx.core.Object` (Singleton)
**Purpose:** Asynchronous mesh and geometry loader managing Web Worker queues for OpenCTM, VTK, STL, PLY, and OBJ formats.

#### Static Methods
- `desk.THREE.Loader.loadGeometry(file, opts) -> Promise<THREE.BufferGeometry>`: Loads a 3D geometry file with automatic caching and background worker decompression.

---

## 4. Multi-Planar Reconstruction (`desk.MPR.*`)

### `desk.MPR.Container`
**Extends:** `qx.ui.container.Composite`
**Purpose:** Orchestrates 3-view orthogonal Multi-Planar Reconstruction (Axial, Coronal, Sagittal) plus an integrated 3D perspective viewer.

#### Constructor
`new desk.MPR.Container(file, options, callback, context)`
- `file` (*String*, optional): Volume file to open (.nii, .nii.gz, .mhd, .mha, .dcm, image slices).
- `options` (*Object*, optional):
  - `nbOrientations` (*Number*): Number of view panes (1, 2, or 3, default: 3).
  - `inGridCoord` (*Object*): Custom grid positioning for viewers.

#### Events
- `switchFullScreen`: Fired when a sub-view is toggled fullscreen.

#### Instance Methods
- `addVolume(file, options, callback, context)` / `addVolumeAsync(file, options) -> Promise<desk.MPR.Volume>`: Adds and slices a 3D volume dataset.
- `getViewers() -> Array<desk.MPR.SliceView>`: Returns the orthogonal 2D slice viewers: `[axial, coronal, sagittal]`.
- `getView(orientation) -> desk.MPR.SliceView`: Returns viewer for orientation `0` (axial), `1` (coronal), or `2` (sagittal).
- `getVolumes() -> Array<desk.MPR.Volume>`: Returns list of active volumes.
- `removeAllVolumes()`: Clears all volumes and resets viewers.
- `render()`: Renders all slice viewers.

---

### `desk.MPR.Volume`
**Extends:** `qx.ui.container.Composite`
**Purpose:** Represents a volumetric medical dataset, controlling its opacity, color map (LUT), format, and slice generation.

#### Properties
- `volumeOpacity` (*Number*, range: `[0, 1]`): Global volume opacity.
- `imageFormat` (*Number*): Format ID for slice textures.
- `lut` (*String*): Active color lookup table (e.g. `'grayscale'`, `'rainbow'`).

#### Instance Methods
- `getSlices() -> Map<Number, desk.MPR.Slice>`: Returns map of slice instances per orientation.
- `getSlice(orientation) -> desk.MPR.Slice`: Returns slice instance for given orientation.
- `setBrightnessAndContrast(brightness, contrast)`: Updates window/level settings across all slices.
- `getProperties() -> Object`: Returns volume metadata (dimensions, voxel spacing, origin, scalar range).

---

### `desk.MPR.SliceView`
**Extends:** `desk.THREE.Scene`
**Includes:** `desk.LinkMixin`
**Purpose:** Dedicated 2D viewer displaying volume slices along a specific axis with interactive crosshairs, zooming, and segmentation brush drawing.

#### Properties
- `slice` (*Number*, event: `changeSlice`): Current slice coordinate index.
- `crossPosition` (*Array<Number>*, event: `changeCrossPosition`): `[i, j, k]` volume coordinates of the crosshair.
- `crossLocked` (*Boolean*): Prevents crosshair moving via left-click.
- `paintMode` (*Boolean*, event: `changePaintMode`): Activates seed brush drawing.
- `eraseMode` (*Boolean*, event: `changeEraseMode`): Activates seed eraser.
- `paintOpacity` (*Number*): Opacity of the segmentation overlay.

#### Events
- `changeDrawing`: Fired when the user draws or erases on the slice canvas.

#### Instance Methods
- `addSlice(slice, callback, context)` / `addSliceAsync(slice) -> Promise`: Attaches a `desk.MPR.Slice` to this view.
- `removeSlice(slice)`: Detaches a slice.
- `getDrawingCanvas() -> qx.ui.embed.Canvas`: Returns the 2D drawing canvas overlay.
- `undo()` / `redo()`: Navigates segmentation history.

---

### `desk.MPR.Slice`
**Extends:** `qx.core.Object`
**Purpose:** Extracts 2D voxel planes from a volume, uploads textures to WebGL, and applies window/level shaders.

#### Orientations Constants
- `0`: Axial ($XY$ plane, $Z$ slice)
- `1`: Coronal ($ZY$ plane, $X$ slice)
- `2`: Sagittal ($XZ$ plane, $Y$ slice)

---

### `desk.MPR.Slicer`
**Extends:** `qx.core.Object`
**Purpose:** Web Worker manager (`SlicerWorker.js`) that extracts 2D image slices from 3D/4D volumetric datasets (NIfTI, DICOM, MetaImage) asynchronously.

#### Constructor
`new desk.MPR.Slicer(volume, opts)`

#### Instance Methods
- `getSlice(orientation, number, cb)`: Extracts 2D slice data for the given orientation and index via background worker.

---

### `desk.MPR.Viewer`
**Extends:** `desk.MPR.Container`
**Includes:** `desk.WindowMixin`
**Purpose:** Standalone floating window containing a `desk.MPR.Container`.

---

### `desk.MPR.SegTools`
**Extends:** `qx.ui.window.Window`
**Purpose:** Interactive segmentation toolbox supporting multi-label brush painting, seed extraction, and graph-cut computation.

---

### `desk.MPR.CropTool`
**Extends:** `qx.ui.container.Composite`
**Includes:** `desk.WindowMixin`
**Purpose:** Visual 3D bounding box widget for interactive cropping of medical volumes before analysis.

---

## 5. Code Editing (`desk.Ace.*`)

### `desk.Ace.Container`
**Extends:** `qx.ui.core.Widget`
**Purpose:** Embeds the Ace code editor into a Qooxdoo widget.

#### Instance Methods
- `setCode(code)`: Updates editor text.
- `getCode() -> String`: Returns editor text.
- `setMode(mode)`: Sets language syntax (`'javascript'`, `'c_cpp'`, `'json'`, `'html'`, `'python'`).
- `setFontSize(size)`: Sets font size in pixels.
- `getAce() -> Object`: Returns underlying Ace editor object.

---

### `desk.Ace.Editor`
**Extends:** `qx.ui.container.Composite`
**Purpose:** Code editor composite featuring execution triggers, file saving, font size spinners, and folding controls.

---

### `desk.Ace.TabbedEditor`
**Extends:** `qx.core.Object` (Singleton)
**Purpose:** Multi-tab script editor and IDE window with local storage persistence.

#### Static Methods
- `desk.Ace.TabbedEditor.open(file, options)`: Opens a file in a new or existing tab.

---

## 6. Terminals and Logs (`desk.Xterm.*`)

### `desk.Xterm.Container`
**Extends:** `qx.ui.core.Widget`
**Purpose:** Base xterm.js terminal widget with automatic container fitting and resize events.

#### Events
- `resizeTerminal`: Fired with `{ nCols, nRows }` when dimensions change.

---

### `desk.Xterm.Terminal`
**Extends:** `desk.Xterm.Container`
**Purpose:** Interactive command-line terminal connected to a backend shell via Socket.IO.

---

### `desk.Xterm.Logger`
**Extends:** `desk.Xterm.Container`
**Purpose:** Output log viewer supporting ANSI color styling via `chalk`.

#### Instance Methods
- `log(message, color)`: Writes text to terminal. `color` can be `'red'`, `'green'`, `'yellow'`, `'white'`, etc.
- `clear()`: Clears terminal scrollback.

---

### `desk.Xterm.FileTail`
**Extends:** `desk.Xterm.Logger`
**Purpose:** Floating window that tails a remote file in real time using the backend `tail -f` action.

#### Constructor
`new desk.Xterm.FileTail(filePath)`

---

## 7. File Navigation and Tools

### `desk.FileBrowser`
**Extends:** `qx.ui.container.Composite`
**Purpose:** File explorer tree with drag-and-drop, path breadcrumbs, search filtering, and extension-based double-click launching.

#### Constructor
`new desk.FileBrowser(baseDir, options)`
- `baseDir` (*String*, default: `'data'`): Directory to explore.
- `options` (*Object* | *Boolean*): `{ standalone: Boolean }` or boolean `standalone`.

#### Instance Methods
- `updateRoot(newRoot)`: Changes browsing directory.
- `setFileHandler(handler)`: Overrides double-click handler: `function(filePath)`.
- `getSelectedFiles() -> Array<String>`: Returns currently selected file paths.

---

### `desk.FileField`
**Extends:** `qx.ui.form.TextField`
**Purpose:** Text field with drag-and-drop support: dragging a file from `desk.FileBrowser` automatically fills the field with the file path.

---

### `desk.Uploader`
**Extends:** `qx.core.Object`
**Purpose:** Floating dialog for multi-file background uploads with real-time percentage progress bars.

#### Constructor
`new desk.Uploader(uploadDir)`
- `uploadDir` (*String*, default: `'data/upload'`).

#### Events
- `upload`: Fired when a file completes uploading with the file name.

---

### `desk.TabView`
**Extends:** `qx.ui.tabview.TabView`
**Purpose:** Enhanced TabView supporting mouse-wheel tab cycling.

#### Instance Methods
- `addElement(title, widget) -> qx.ui.tabview.Page`: Adds a widget to a new tab page.

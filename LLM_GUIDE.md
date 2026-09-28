# Developing DESK-UI with LLM Coding Agents

## 1. Introduction for LLM Agents

This document is an authoritative guide for AI coding assistants (such as Claude, Gemini, GPT-4, Cursor, and Copilot) tasked with reading, modifying, or creating code in `desk-ui`.

> [!WARNING]
> **CRITICAL ARCHITECTURAL DIFFERENCE**:
> Standard LLM models have strong priors for modern ES6+ React/Vue/Angular class syntax. **`desk-ui` uses the Qooxdoo (qx) Object-Oriented Framework**.
> Writing ES6 classes (`class Foo extends Bar`) or attempting to import modules with `import { x } from 'y'` will break the Qooxdoo compilation pipeline. You **MUST** strictly follow the Qooxdoo OOP patterns detailed below.

---

## 2. Core Mental Model

```
 +-------------------------------------------------------------------------------+
 |                              QOOXDOO CLASS SYSTEM                             |
 |  - Namespaced: qx.Class.define("desk.subnamespace.MyClass", { ... })          |
 |  - Super calls: this.base(arguments, ...)                                     |
 |  - Properties: Declared with check, init, event, apply                        |
 |  - Memory: Must implement destruct() to clean WebGL, DOM, listeners           |
 +-------------------------------------------------------------------------------+
                                      |
       +------------------------------+------------------------------+
       v                                                             v
+-------------------------------+                     +-------------------------------+
|       DESK ASYNC MODEL        |                     |      DESK VIEWERS & TOOLS     |
| - desk.core.AddPromises       |                     | - desk.THREE (3D Scene/Mesh)  |
| - Both Callback & *Async      |                     | - desk.MPR (Multi-Planar Vol) |
| - Prefer async/await in apps  |                     | - desk.Ace (Code editor)      |
| - Actions RPC via Socket.IO   |                     | - desk.Xterm (Terminal/Logs)  |
+-------------------------------+                     +-------------------------------+
```

---

## 3. Qooxdoo Coding Conventions Cheat Sheet

### 3.1. Defining a Class
Never write `class Foo`. Always use `qx.Class.define`:

```javascript
qx.Class.define("desk.demo.MyWidget", {
    extend : qx.ui.container.Composite, // or qx.core.Object, desk.THREE.Scene, etc.
    include : [ desk.LinkMixin, desk.WindowMixin ], // Optional mixins

    /**
     * Constructor
     * @param options {Object} configuration map
     */
    construct : function ( options ) {
        // ALWAYS call super constructor first:
        this.base( arguments );

        options = options || {};
        this.setLayout( new qx.ui.layout.VBox( 5 ) );

        // Initialize instance members (NEVER initialize arrays/objects in 'members' declaration!)
        this.__items = [];

        // Build UI or initialize
        this.__buildUI();
    },

    properties : {
        /** Description of property */
        active : {
            init : false,
            check : "Boolean",
            event : "changeActive",
            apply : "_applyActive"
        },

        threshold : {
            init : 10,
            check : "Number",
            event : "changeThreshold"
        }
    },

    events : {
        /** Fired when an action finishes */
        "actionCompleted" : "qx.event.type.Data"
    },

    statics : {
        DEFAULT_TIMEOUT : 5000,

        helperUtility : function ( value ) {
            return value * 2;
        }
    },

    members : {
        // Private members start with __
        __items : null, // Primitive declaration only!

        _applyActive : function ( value, oldValue ) {
            console.log( "Active changed from " + oldValue + " to " + value );
        },

        __buildUI : function () {
            const btn = new qx.ui.form.Button( "Click Me" );
            btn.addListener( "execute", this.__onButtonClick, this );
            this.add( btn );
        },

        __onButtonClick : function () {
            this.fireDataEvent( "actionCompleted", { time : Date.now() } );
        }
    },

    destruct : function () {
        // MANDATORY: Dispose resources, clear listeners, free WebGL buffers
        this.__items = null;
    }
});
```

### 3.2. Singletons
Singletons must set `type : "singleton"`:
```javascript
qx.Class.define("desk.core.MyService", {
    extend : qx.core.Object,
    type : "singleton",

    construct : function () {
        this.base( arguments );
    },

    members : {
        fetchData : function () { ... }
    }
});

// Accessing:
const service = desk.core.MyService.getInstance();
```

### 3.3. Mixins
Mixins must use `qx.Mixin.define`:
```javascript
qx.Mixin.define("desk.MyCustomMixin", {
    members : {
        mySharedHelper : function () { ... }
    }
});
```

### 3.4. Crucial Pitfalls to Avoid in Qooxdoo
1. **Never assign array or object literals inside `members`**:
   - ❌ WRONG: `members: { __myList: [] }` (This makes `__myList` static and shared across ALL instances!)
   - ✅ RIGHT: `members: { __myList: null }`, then in `construct`: `this.__myList = [];`
2. **Always pass `this` as context to `.addListener()`**:
   - ❌ WRONG: `button.addListener("execute", this.__onAction)`
   - ✅ RIGHT: `button.addListener("execute", this.__onAction, this)` or `button.addListener("execute", () => this.__onAction())`
3. **Always call `this.base(arguments)`**:
   - When overriding methods or in constructors, invoke the parent method using `this.base(arguments)`.
4. **Use Property Accessors**:
   - For property `active`, Qooxdoo automatically creates:
     - `this.getActive()`
     - `this.setActive(val)`
     - `this.resetActive()`
     - `this.isActive()` (for booleans)

---

## 4. Asynchronous Programming in DESK

`desk-ui` automatically creates Promisified versions of callback methods at initialization via `desk.core.AddPromises`.

### 4.1. Rules for Choosing Between Callbacks and Promises
- When writing application logic, scripts, or newer UI components: **ALWAYS prefer `async/await` with `*Async` methods**.
- When maintaining or overriding existing legacy Qooxdoo methods: maintain compatibility with existing callbacks.

### 4.2. Promisified Method Reference

| Original Callback Method | Modern Async / Await Equivalent |
| :--- | :--- |
| `desk.Actions.execute(params, callback)` | `const res = await desk.Actions.executeAsync(params, [options])` |
| `desk.Actions.killAction(handle, callback)` | `await desk.Actions.killActionAsync(handle)` |
| `desk.FileSystem.readFile(file, callback)` | `const content = await desk.FileSystem.readFileAsync(file, [options])` |
| `desk.FileSystem.writeFile(file, data, callback)` | `await desk.FileSystem.writeFileAsync(file, data, [options])` |
| `desk.FileSystem.writeJSON(file, obj, callback)` | `await desk.FileSystem.writeJSONAsync(file, obj)` |
| `desk.FileSystem.readDir(dir, callback)` | `const files = await desk.FileSystem.readDirAsync(dir)` |
| `desk.FileSystem.exists(path, callback)` | `const exists = await desk.FileSystem.existsAsync(path)` |
| `desk.FileSystem.mkdirp(dir, callback)` | `await desk.FileSystem.mkdirpAsync(dir)` |
| `desk.FileSystem.executeScript(file, callback)` | `await desk.FileSystem.executeScriptAsync(file)` |
| `desk.THREE.Container.prototype.addFile(...)` | `const mesh = await container.addFileAsync(file, [options])` |
| `desk.MPR.Container.prototype.addVolume(...)` | `const volume = await mpr.addVolumeAsync(file, [options])` |
| `desk.THREE.Scene.prototype.render(...)` | `await scene.renderAsync()` |

### 4.3. Streaming Action Logs with `executeAsync`
If you need real-time streaming output while awaiting completion:

```javascript
const res = await desk.Actions.executeAsync({
    action: "my_long_process",
    input_file: "data/input.vtk"
}, {
    listener: function (message) {
        if (message.type === "stdout") {
            console.log("Stream output:", message.data);
        } else if (message.type === "stderr") {
            console.warn("Stream error:", message.data);
        }
    }
});
console.log("Finished with result:", res);
```

---

## 5. Globals & Available Libraries

`desk.core.AddLibs` exposes several libraries globally on `window`:

| Global Identifier | Library | Usage Example |
| :--- | :--- | :--- |
| `THREE` | Three.js (r183) | `new THREE.Vector3(0, 1, 0)`, `new THREE.Mesh(...)` |
| `_` | Lodash | `_.debounce(fn, 50)`, `_.chunk(arr, 2)` |
| `async` | Async.js | `async.eachLimit(...)` |
| `chroma` | Chroma.js | `chroma.scale(['yellow', 'navy']).mode('lch')` |
| `d3` | D3.js v7 | D3 scales, selections, axes |
| `bb` / `c3` | Billboard.js | Charting widgets |
| `jstat` | jStat | Statistical computations |
| `numeric` | Numeric Javascript | Linear algebra and matrix solvers |
| `randomJS` | Random-js | Random engines and distributions |
| `MHD` | MHD Parser | `MHD.parse(headerString)` |

---

## 6. Developing Viewers

### 6.1. Adding a 3D Mesh Viewer
```javascript
// Standalone window:
const viewer = new desk.THREE.Viewer("data/mesh.ply");

// Or embedded in a custom layout:
const container = new desk.THREE.Container();
myLayout.add(container, { flex: 1 });
await container.addFileAsync("data/mesh.vtk");
container.viewAll();
```

### 6.2. Adding a Medical Image MPR Viewer
```javascript
// Standalone window:
const mpr = new desk.MPR.Viewer("data/volume.nii.gz");

// Synchronizing two viewers using LinkMixin:
const viewer1 = new desk.THREE.Viewer("data/model1.vtk");
const viewer2 = new desk.THREE.Viewer("data/model2.vtk");
viewer1.link(viewer2); // Camera changes in viewer1 now sync to viewer2
```

---

## 7. Memory Safety & Cleanup

Every visual component that allocates resources (WebGL meshes, textures, canvases, Web Workers, or event listeners on singletons) **MUST** implement a `destruct()` method:

```javascript
destruct : function () {
    // 1. Remove listeners on global singletons
    desk.Actions.getInstance().removeListenerById( this.__actionListenerId );

    // 2. Dispose WebGL meshes or textures
    if ( this.__geometry ) {
        this.__geometry.dispose();
        this.__geometry = null;
    }
    if ( this.__material ) {
        this.__material.dispose();
        this.__material = null;
    }

    // 3. Dispose child widgets or containers
    qx.util.DisposeUtil.destroyContainer( this.__subContainer );

    // 4. Call super destructor
    this.base( arguments );
}
```

---

## 8. Build, Lint, and Validation Workflow

Commands must be executed from the repository root:

1. **Development compilation with watch mode**:
   ```bash
   npm run dev
   ```
2. **One-shot source compilation**:
   ```bash
   npx qx compile --target source
   ```
3. **Building both source and production targets**:
   ```bash
   npm run compile
   ```
4. **Fixing bundled CSS assets (Billboard & xterm)**:
   ```bash
   npm run fixCss
   ```
5. **Rebuilding Web Workers (`SlicerWorker`, `CTMWorkerBundle`)**:
   ```bash
   npm run buildWorkers
   ```
6. **Compiling Qooxdoo API Viewer**:
   ```bash
   npx qx compile --app-name=apiviewer
   ```

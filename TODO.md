# DESK-UI Codebase Audit & Improvement Plan

This document contains a comprehensive technical audit of the `desk-ui` codebase, covering runtime bugs, memory/resource leaks, Qooxdoo framework violations, build issues, and an actionable step-by-step remediation plan.

---

## 📑 Summary of Findings

| Severity | Category | Description | Count |
| :--- | :--- | :--- | :---: |
| 🔴 **P0 (Critical)** | **Runtime Crash** | Browser incompatibility with `window.setImmediate` (Chrome/Firefox/Safari) | 3 |
| 🔴 **P0 (Critical)** | **Promise Hang** | Silent infinite promise hang on Socket.IO reconnect in `desk.Actions` | 1 |
| 🔴 **P0 (Critical)** | **Missing Asset** | Broken Web Worker path `desk-ui/workerSlicer.worker.js` in `desk.MPR.Slicer` | 1 |
| 🟠 **P1 (High)** | **Memory Leak** | Missing `destruct()` in `desk.MPR.Slice` leaks WebGL textures | 1 |
| 🟠 **P1 (High)** | **Memory Leak** | `desk.THREE.Container.removeMesh` does not dispose geometry/materials | 1 |
| 🟠 **P1 (High)** | **Memory Leak** | Missing `destruct()` in `desk.MPR.SegTools` leaks listeners and canvases | 1 |
| 🟠 **P1 (High)** | **Exception Risk** | Unsafe `JSON.parse` in `desk.FileSystem` (`exists`, `readDir`, `executeScript`) | 3 |
| 🟡 **P2 (Medium)** | **Qooxdoo Violation** | Literal object/array in `desk.Actions.members` (Rule 3) | 2 |
| 🟡 **P2 (Medium)** | **Build/Compiler** | Outdated framework in `node_modules` (7.7.2 vs 7.9.3 declared) | 1 |
| 🟡 **P2 (Medium)** | **Build/Compiler** | Fragile relative imports (`three/../../source/ext/...`) in `AddLibs.js` | 1 |
| 🟡 **P2 (Medium)** | **Security/Lint** | Use of `eval()` in `desk.core.AddPromises` for prototype binding | 1 |
| 🟢 **P3 (Low)** | **Code Quality** | Missing `destruct` null checks, leftover debug code, missing test suite | Multi |

---

## 1. 🔴 Critical Bugs (P0 - Immediate Fixes)

### 1.1. Non-standard `window.setImmediate` Calls in Browser
- **Files**:
  - `source/class/desk/MPR/CropTool.js:33`
  - `source/class/desk/MPR/SliceView.js:816`
  - `source/class/desk/MPR/Slice.js:1220`
- **Issue**: `window.setImmediate` is a non-standard API originally only supported in Node.js and legacy IE. In standard browsers (Google Chrome, Mozilla Firefox, Safari), `window.setImmediate` is `undefined`, throwing:
  ```
  TypeError: window.setImmediate is not a function
  ```
- **Remedy**: Replace all calls with `setTimeout(..., 0)` or `window.requestAnimationFrame(...)`, or inject a cross-browser shim in `desk.core.AddLibs`.

### 1.2. Silent Infinite Promise Hang on Socket.IO Reconnect
- **File**: `source/class/desk/Actions.js:583`
- **Issue**: In `__onDisconnect`, when a disconnect occurs and an action is no longer present on the server upon reconnect:
  ```javascript
  if ( !action ) {
      params.callback = function () {};
      this.__onActionEnd( { handle : params.POST.handle } );
  }
  ```
  Overwriting `params.callback` with an empty no-op function means any caller waiting with `await desk.Actions.executeAsync(...)` will **hang forever**. The returned promise will neither resolve nor reject.
- **Remedy**: Pass an explicit error to the callback:
  ```javascript
  params.callback.call( params.context, new Error( "Action disconnected or lost on server" ) );
  ```

### 1.3. Missing Web Worker Path in `desk.MPR.Slicer`
- **File**: `source/class/desk/MPR/Slicer.js:96-98`
- **Issue**: When `opts.worker` is enabled:
  ```javascript
  // TODO!!!
  const scriptFile = "desk-ui/workerSlicer.worker.js";
  this.worker = new Worker(scriptFile);
  ```
  `desk-ui/workerSlicer.worker.js` does not exist in the codebase. Invoking with `{ worker: true }` instantly crashes with a 404 network worker error.
- **Remedy**: Use the bundled worker generated in `source/resource/desk/workers/SlicerWorker.js` via `qx.util.ResourceManager.getInstance().toUri(...)`.

---

## 2. 🟠 High Severity Bugs & Resource Leaks (P1)

### 2.1. WebGL Texture Leak in `desk.MPR.Slice`
- **File**: `source/class/desk/MPR/Slice.js`
- **Issue**: `desk.MPR.Slice` creates `THREE.DataTexture` instances (`this.__texture` and `this.__lookupTable`). However, `desk.MPR.Slice` implements **no `destruct()` method**.
  When a volume is destroyed (`desk.MPR.Volume.destruct` calls `slice.dispose()`), the WebGL textures are never freed from GPU memory.
- **Remedy**: Implement a `destruct` block in `desk.MPR.Slice`:
  ```javascript
  destruct : function () {
      if ( this.__texture ) this.__texture.dispose();
      if ( this.__lookupTable ) this.__lookupTable.dispose();
      this.__texture = null;
      this.__lookupTable = null;
  }
  ```

### 2.2. WebGL Geometry and Material Leaks in `desk.THREE.Container`
- **File**: `source/class/desk/THREE/Container.js:1243-1250`
- **Issue**: `removeMesh(mesh)` traverses objects and removes them from the parent Three.js group, but never invokes:
  ```javascript
  if ( object.geometry ) object.geometry.dispose();
  if ( object.material ) {
      if ( Array.isArray( object.material ) ) object.material.forEach( m => m.dispose() );
      else object.material.dispose();
  }
  ```
  Buffers and shaders remain permanently allocated on the GPU.
- **Remedy**: Add optional or default disposal flag in `removeMesh(mesh, dispose = true)`.

### 2.3. Unhandled Exceptions in `desk.FileSystem`
- **File**: `source/class/desk/FileSystem.js:371, 391, 408`
- **Issues**:
  - `exists()`: `JSON.parse(message.stdout)` crashes if `message.stdout` is undefined or malformed JSON (e.g. backend error HTML).
  - `readDir()`: `!err ? JSON.parse(message.stdout) : null` crashes if the server returns non-JSON text.
  - `executeScript()`: Appends `<script>` even when `err` is returned, attempting to execute undefined content.
- **Remedy**: Wrap `JSON.parse` calls in `try/catch` and guard callback dispatches.

### 2.4. Missing `destruct()` in `desk.MPR.SegTools`
- **File**: `source/class/desk/MPR/SegTools.js`
- **Issue**: At 1,940 lines, `SegTools` binds numerous event listeners across volumes and slice views, allocates 2D drawing canvases, and manages UI windows without any `destruct()` method. Closing the tool leaves zombie listeners in memory.
- **Remedy**: Implement a complete `destruct` lifecycle method unregistering all volume and canvas listeners.

---

## 3. 🟡 Medium Severity Architecture & Qooxdoo Violations (P2)

### 3.1. Literal Arrays/Objects in `desk.Actions.members` (Rule 3 Violation)
- **File**: `source/class/desk/Actions.js:233, 239`
- **Issue**:
  ```javascript
  __runningActions : {},
  __finishedActions : [],
  ```
  Declaring literal `{}` and `[]` in `members` attaches references directly to the class prototype. In Qooxdoo, all instances share the same reference.
- **Remedy**: Set to `null` in `members: { ... }` and initialize in `construct`:
  ```javascript
  construct : function() {
      this.__runningActions = {};
      this.__finishedActions = [];
      // ...
  }
  ```

### 3.2. Outdated Dependencies in `node_modules`
- **Issue**: `package.json` specifies `"@qooxdoo/framework": "7.9.3"` and `Manifest.json` requires `"^7.9.0"`, but `node_modules/@qooxdoo/framework` is still on `7.7.2`. The compiler outputs:
  ```
  desk: Needs @qooxdoo/framework version ^7.9.0, found 7.7.2
  ```
- **Remedy**: Run `npm install` to synchronize `node_modules` with `package.json`.

### 3.3. Fragile Local File Imports in `desk.core.AddLibs`
- **File**: `source/class/desk/core/AddLibs.js:35-50`
- **Issue**:
  ```javascript
  require( "three/../../source/ext/CTMLoader.js" );
  require( "desk-ui/source/ext/CTMLoader.js" );
  ```
  Navigating out of `node_modules/three/` with `../../` or relying on self-referential `desk-ui` package name causes static module resolution errors during `qx compile`.
- **Remedy**: Use Qooxdoo asset loader or configure `@asset(desk/ext/*)` with `qx.util.ResourceManager`.

### 3.4. Unsafe `eval()` in `desk.core.AddPromises`
- **File**: `source/class/desk/core/AddPromises.js:145`
- **Issue**: `eval()` is used to dynamically inject deprecated method wrappers onto prototype objects. This violates strict Content Security Policy (CSP) and prevents V8 optimizations.
- **Remedy**: Replace `eval()` with direct property assignment:
  ```javascript
  const targetClass = qx.Class.getByName( source );
  if ( targetClass ) {
      targetClass.prototype[ member ] = function( item, ...args ) {
          console.warn( `${deprecated} is deprecated. Use item.${target} instead.` );
          return item[ target ]( ...args );
      };
  }
  ```

---

## 4. 🟢 Quality & Usability Improvements (P3)

### 4.1. Missing Null Check in `desk.Xterm.Terminal.destruct`
- **File**: `source/class/desk/Xterm/Terminal.js:42`
- **Issue**: `this.__socket.removeEventListener` throws if the terminal widget is destroyed before socket connection completes.
- **Remedy**: Use optional chaining `this.__socket?.removeEventListener(...)` and `this.__socket?.disconnect()`.

### 4.2. Inconsistent Context Binding in `desk.FileField`
- **File**: `source/class/desk/FileField.js:20`
- **Issue**: `this.addListener('dragstart', this.__onDragStart)` lacks the context argument `this` (Rule 5 violation).

### 4.3. Leftover Test Code in `desk.Uploader`
- **File**: `source/class/desk/Uploader.js:50-51`
- **Issue**:
  ```javascript
  if ( uploadCount % 2 == 0)
      file.setParam("myGlobalParam", "overridden-global-value");
  ```
  Dummy example parameter code is present in production upload routine.

### 4.4. Untracked Artifacts in `.gitignore`
- **Issue**: Running `npm run build` generates `source/ext/CTMWorkerBundle.js` and `source/resource/webpack-bundle/`, and documentation builds produce `*.pdf`, cluttering `git status`.
- **Remedy**: Add these paths to `.gitignore`.

### 4.5. Complete Lack of Automated Tests
- **Issue**: There are currently **0 test files** and no `test` script in `package.json`.
- **Remedy**: Configure Qooxdoo testrunner (`qx compile --app-name=test`) or lightweight unit tests with Vitest/Jest for core classes (`desk.Random`, `desk.URLParameters`, `desk.FileSystem`, `desk.Actions`).

---

## 📋 Remediation Plan & Task Checklist

### Phase 1: Critical Bug Fixes (P0)
- [x] **Task 1.1**: Replace `window.setImmediate` with `setTimeout(..., 0)` in `CropTool.js`, `SliceView.js`, and `Slice.js` (and add fallback shim in `AddLibs.js`).
- [ ] **Task 1.2**: Fix `__onDisconnect` in `desk.Actions.js` to dispatch an error to `params.callback` instead of setting a silent no-op.
- [ ] **Task 1.3**: Resolve `workerSlicer.worker.js` reference in `desk.MPR.Slicer.js` or safely guard worker creation.

### Phase 2: Memory & Resource Leak Fixes (P1)
- [ ] **Task 2.1**: Implement `destruct()` in `desk.MPR.Slice.js` to dispose `__texture` and `__lookupTable`.
- [ ] **Task 2.2**: Update `removeMesh()` in `desk.THREE.Container.js` to dispose geometries and materials.
- [ ] **Task 2.3**: Implement `destruct()` in `desk.MPR.SegTools.js` to cleanly detach all event listeners and canvas elements.
- [ ] **Task 2.4**: Add `try/catch` and error guards around `JSON.parse` in `desk.FileSystem.js` (`exists`, `readDir`).

### Phase 3: Qooxdoo Standards & Cleanups (P2)
- [ ] **Task 3.1**: Fix `__runningActions` and `__finishedActions` in `desk.Actions.js` (initialize in `construct`, set to `null` in `members`).
- [ ] **Task 3.2**: Refactor `eval()` in `desk.core.AddPromises.js` to use safe property access via `qx.Class.getByName()`.
- [ ] **Task 3.3**: Clean up `desk.FileField.js` to supply context `this` to all listeners.
- [ ] **Task 3.4**: Clean up `source/ext/` and `AddLibs.js` module imports to eliminate compile-time require errors.

### Phase 4: Build System & Repository Polish (P3)
- [ ] **Task 4.1**: Update `.gitignore` to include `source/ext/CTMWorkerBundle.js`, `source/resource/webpack-bundle/`, and `*.pdf`.
- [ ] **Task 4.2**: Remove leftover debug code (`myGlobalParam`) in `desk.Uploader.js`.
- [ ] **Task 4.3**: Add null safety to `desk.Xterm.Terminal.destruct()`.
- [ ] **Task 4.4**: Introduce a test harness for core utility classes.

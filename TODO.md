# DESK-UI Codebase Audit & Improvement Plan

This document contains a comprehensive technical audit of the `desk-ui` codebase, covering runtime bugs, memory/resource leaks, Qooxdoo framework violations, build issues, and an actionable step-by-step remediation plan.

---

## 📑 Summary of Findings & Progress

| Severity | Category | Description | Status |
| :--- | :--- | :--- | :--- |
| 🔴 **P0 (Critical)** | **Runtime Crash** | Non-standard `window.setImmediate` (Chrome/Firefox/Safari) | ✅ Fixed (`5cf277c`) |
| 🔴 **P0 (Critical)** | **Promise Hang** | Silent infinite promise hang on Socket.IO reconnect in `desk.Actions` | ✅ Fixed (`c21faa2`) |
| 🔴 **P0 (Critical)** | **Missing Asset** | Broken Web Worker path in `desk.MPR.Slicer` | ✅ Fixed (`0bb712a`) |
| 🟠 **P1 (High)** | **Memory Leak** | Missing `destruct()` in `desk.MPR.Slice` leaks WebGL textures | ✅ Fixed (`dbc44c9`) |
| 🟠 **P1 (High)** | **Memory Leak** | `desk.THREE.Container.removeMesh` does not dispose geometry/materials | ✅ Fixed (`02d123f`) |
| 🟠 **P1 (High)** | **Memory Leak** | Missing `destruct()` in `desk.MPR.SegTools` leaks listeners and canvases | ✅ Fixed (`facba0f`) |
| 🟠 **P1 (High)** | **Exception Risk** | Unsafe `JSON.parse` in `desk.FileSystem` (`exists`, `readDir`, `executeScript`) | ✅ Fixed (`95a67be`) |
| 🟢 **P3 (Low)** | **Build/Git** | Cluttered git status with worker bundles, webpack outputs, PDFs | ✅ Fixed (`b199b33`) |
| 🟢 **P3 (Low)** | **Code Quality** | Leftover debug parameter code in `desk.Uploader` | ✅ Fixed (`643dbb5`) |
| 🟢 **P3 (Low)** | **Exception Risk** | Missing null check on socket in `desk.Xterm.Terminal.destruct` | ✅ Fixed (`2274ebf`) |
| 🟢 **P3 (Low)** | **Qooxdoo Violation** | Missing `this` context binding on `dragstart` in `desk.FileField` | ✅ Fixed (`a5679cb`) |
| 🟢 **P3 (Low)** | **Code Quality** | In-place array mutation during iteration in `desk.LinkMixin.unlink` | ✅ Fixed (`9a24350`) |
| 🟢 **P3 (Low)** | **Exception Risk** | Modulo by zero on empty children in `desk.TabView.__onMouseWheel` | ✅ Fixed (`bd9beb4`) |
| 🟡 **P2 (Medium)** | **Qooxdoo Violation** | Literal object/array in `desk.Actions.members` (Rule 3) | ⏳ Pending investigation |
| 🟡 **P2 (Medium)** | **Build/Compiler** | Outdated framework in `node_modules` (7.7.2 vs 7.9.3 declared) | ⏳ Pending investigation |
| 🟡 **P2 (Medium)** | **Build/Compiler** | Fragile relative imports (`three/../../source/ext/...`) in `AddLibs.js` | ⏳ Pending investigation |
| 🟡 **P2 (Medium)** | **Security/Lint** | Use of `eval()` in `desk.core.AddPromises` for prototype binding | ⏳ Pending investigation |
| 🟢 **P3 (Low)** | **Test Coverage** | Lack of automated test suite | ⏳ Backlog |

---

## 1. 🔴 Critical Bugs (P0 - Immediate Fixes)

### 1.1. Non-standard `window.setImmediate` Calls in Browser
- **Files**:
  - `source/class/desk/MPR/CropTool.js:33`
  - `source/class/desk/MPR/SliceView.js:816`
  - `source/class/desk/MPR/Slice.js:1220`
- **Issue**: `window.setImmediate` is a non-standard API originally only supported in Node.js and legacy IE. In standard browsers (Google Chrome, Mozilla Firefox, Safari), `window.setImmediate` is `undefined`, throwing `TypeError: window.setImmediate is not a function`.
- **Status**: ✅ **Fixed in commit [`5cf277c`](file:///home/valette/git/desk-ui/source/class/desk/core/AddLibs.js)**. Replaced calls with standard `setTimeout(..., 0)` and injected a cross-browser fallback shim into `desk.core.AddLibs`.

### 1.2. Silent Infinite Promise Hang on Socket.IO Reconnect
- **File**: `source/class/desk/Actions.js:583`
- **Issue**: In `__onDisconnect`, when a disconnect occurred and an action was no longer present on the server upon reconnect, `params.callback` was overwritten with an empty function (`function () {}`). Any caller waiting with `await desk.Actions.executeAsync(...)` hung indefinitely without resolving or rejecting.
- **Status**: ✅ **Fixed in commit [`c21faa2`](file:///home/valette/git/desk-ui/source/class/desk/Actions.js)**. Calls `this.__onActionEnd` with an explicit disconnection error.

### 1.3. Missing Web Worker Path in `desk.MPR.Slicer`
- **File**: `source/class/desk/MPR/Slicer.js:96-98`
- **Issue**: When `opts.worker` was enabled, `const scriptFile = "desk-ui/workerSlicer.worker.js"` was requested, crashing with a 404 network worker error.
- **Status**: ✅ **Fixed in commit [`0bb712a`](file:///home/valette/git/desk-ui/source/class/desk/MPR/Slicer.js)**. Loads bundled worker using `qx.util.ResourceManager.getInstance().toUri("desk/workers/SlicerWorker.js")` and adds error handling.

---

## 2. 🟠 High Severity Bugs & Resource Leaks (P1)

### 2.1. WebGL Texture Leak in `desk.MPR.Slice`
- **File**: `source/class/desk/MPR/Slice.js`
- **Issue**: `desk.MPR.Slice` creates `THREE.DataTexture` instances (`__texture` and `__lookupTable`), but implemented no `destruct()` method. When destroying a volume, textures were left allocated in GPU memory.
- **Status**: ✅ **Fixed in commit [`dbc44c9`](file:///home/valette/git/desk-ui/source/class/desk/MPR/Slice.js)**. Implemented `destruct()` to dispose `__texture` and `__lookupTable`.

### 2.2. WebGL Geometry and Material Leaks in `desk.THREE.Container`
- **File**: `source/class/desk/THREE/Container.js:1243-1250`
- **Issue**: `removeMesh(mesh)` detached meshes from Three.js scene groups but never disposed geometries, materials (or material arrays), or texture maps, leaking VRAM buffers.
- **Status**: ✅ **Fixed in commit [`02d123f`](file:///home/valette/git/desk-ui/source/class/desk/THREE/Container.js)**. Updated `removeMesh(mesh, dispose = true)` to recursively dispose geometry, material arrays, and associated texture maps.

### 2.3. Missing `destruct()` in `desk.MPR.SegTools`
- **File**: `source/class/desk/MPR/SegTools.js`
- **Issue**: At 1,940 lines, `SegTools` attached numerous listeners to viewer containers and volumes, created 2D canvas drawing buffers, and managed modal UI elements without any disposal lifecycle.
- **Status**: ✅ **Fixed in commit [`facba0f`](file:///home/valette/git/desk-ui/source/class/desk/MPR/SegTools.js)**. Converted listener storage to a `Map` and implemented `destruct()` to detach all listeners, clear canvas drawing contexts, and reset tool state.

### 2.4. Unhandled Exceptions in `desk.FileSystem`
- **File**: `source/class/desk/FileSystem.js:371, 391, 408`
- **Issue**: `exists()`, `readDir()`, and `executeScript()` called `JSON.parse` directly on raw server responses without error guards, causing runtime exceptions if non-JSON responses or errors were returned.
- **Status**: ✅ **Fixed in commit [`95a67be`](file:///home/valette/git/desk-ui/source/class/desk/FileSystem.js)**. Added `try/catch` blocks, empty/error output guards, and protected callback dispatches.

---

## 3. 🟡 Medium Severity Architecture & Qooxdoo Violations (P2 - Deferred)

### 3.1. Literal Arrays/Objects in `desk.Actions.members` (Rule 3 Violation)
- **File**: `source/class/desk/Actions.js:233, 239`
- **Issue**:
  ```javascript
  __runningActions : {},
  __finishedActions : [],
  ```
  Declaring literal `{}` and `[]` in `members` attaches references directly to the class prototype. In Qooxdoo, all instances share the same reference.
- **Status**: ⏳ **Pending investigation** (Leave P2 issues for later investigation).

### 3.2. Outdated Dependencies in `node_modules`
- **Issue**: `package.json` specifies `"@qooxdoo/framework": "7.9.3"` and `Manifest.json` requires `"^7.9.0"`, but `node_modules/@qooxdoo/framework` is still on `7.7.2`. The compiler outputs:
  ```
  desk: Needs @qooxdoo/framework version ^7.9.0, found 7.7.2
  ```
- **Status**: ⏳ **Pending investigation** (See full feasibility report in [docs/QOOXDOO_8_ANALYSIS.md](file:///home/valette/git/desk-ui/docs/QOOXDOO_8_ANALYSIS.md)).

### 3.3. Fragile Local File Imports in `desk.core.AddLibs`
- **File**: `source/class/desk/core/AddLibs.js:35-50`
- **Issue**:
  ```javascript
  require( "three/../../source/ext/CTMLoader.js" );
  require( "desk-ui/source/ext/CTMLoader.js" );
  ```
  Navigating out of `node_modules/three/` with `../../` or relying on self-referential `desk-ui` package name causes static module resolution errors during `qx compile`.
- **Status**: ⏳ **Pending investigation**.

### 3.4. Unsafe `eval()` in `desk.core.AddPromises`
- **File**: `source/class/desk/core/AddPromises.js:145`
- **Issue**: `eval()` is used to dynamically inject deprecated method wrappers onto prototype objects. This violates strict Content Security Policy (CSP) and prevents V8 optimizations.
- **Status**: ⏳ **Pending investigation**.

---

## 4. 🟢 Quality & Usability Improvements (P3)

### 4.1. Untracked Artifacts in `.gitignore`
- **Issue**: Running builds generated `source/ext/CTMWorkerBundle.js`, `source/resource/webpack-bundle/`, and documentation `*.pdf` files, cluttering `git status`.
- **Status**: ✅ **Fixed in commit [`b199b33`](file:///home/valette/git/desk-ui/.gitignore)**. Added generated artifacts to `.gitignore`.

### 4.2. Leftover Test Code in `desk.Uploader`
- **File**: `source/class/desk/Uploader.js:50-51`
- **Issue**: Hardcoded example parameter `myGlobalParam` and `uploadCount` modulo from external demo was present in production uploader.
- **Status**: ✅ **Fixed in commit [`643dbb5`](file:///home/valette/git/desk-ui/source/class/desk/Uploader.js)**. Removed leftover test code.

### 4.3. Missing Null Check in `desk.Xterm.Terminal.destruct`
- **File**: `source/class/desk/Xterm/Terminal.js:42`
- **Issue**: `this.__socket.removeEventListener` threw if the terminal widget was destroyed before the socket connection finished establishing.
- **Status**: ✅ **Fixed in commit [`2274ebf`](file:///home/valette/git/desk-ui/source/class/desk/Xterm/Terminal.js)**. Added optional chaining (`this.__socket?.removeEventListener(...)` and `this.__socket?.disconnect()`).

### 4.4. Inconsistent Context Binding in `desk.FileField`
- **File**: `source/class/desk/FileField.js:20`
- **Issue**: `this.addListener('dragstart', this.__onDragStart)` omitted the context argument `this` (violating Rule 5).
- **Status**: ✅ **Fixed in commit [`a5679cb`](file:///home/valette/git/desk-ui/source/class/desk/FileField.js)**. Provided `this` context to the event listener.

### 4.5. In-Place Array Mutation in `desk.LinkMixin.unlink`
- **File**: `source/class/desk/LinkMixin.js:38-45`
- **Issue**: `links.splice(index, 1)` mutated the array in-place while iterating over it with `forEach`.
- **Status**: ✅ **Fixed in commit [`9a24350`](file:///home/valette/git/desk-ui/source/class/desk/LinkMixin.js)**. Replaced iterating splice with clean `indexOf` lookup and removal.

### 4.6. Modulo Calculation on Empty Children in `desk.TabView`
- **File**: `source/class/desk/TabView.js:40-55`
- **Issue**: Wheel event handler calculated modulo on `children.length` without checking if children existed, leading to `NaN` indexing and unhandled exceptions.
- **Status**: ✅ **Fixed in commit [`bd9beb4`](file:///home/valette/git/desk-ui/source/class/desk/TabView.js)**. Added empty check and index guards before triggering tab button execution.

### 4.7. Test Suite / Harness
- **Issue**: 0 automated test files exist for core classes (`desk.Random`, `desk.URLParameters`, `desk.FileSystem`, `desk.Actions`).
- **Status**: ⏳ **Backlog / Future Improvement**.

---

## 📋 Remediation Plan & Task Checklist

### Phase 1: Critical Bug Fixes (P0)
- [x] **Task 1.1**: Replace `window.setImmediate` with `setTimeout(..., 0)` in `CropTool.js`, `SliceView.js`, and `Slice.js` (and add fallback shim in `AddLibs.js`). *(Commit [`5cf277c`](file:///home/valette/git/desk-ui/source/class/desk/core/AddLibs.js))*
- [x] **Task 1.2**: Fix `__onDisconnect` in `desk.Actions.js` to dispatch an error to `params.callback` instead of setting a silent no-op. *(Commit [`c21faa2`](file:///home/valette/git/desk-ui/source/class/desk/Actions.js))*
- [x] **Task 1.3**: Resolve `workerSlicer.worker.js` reference in `desk.MPR.Slicer.js` or safely guard worker creation. *(Commit [`0bb712a`](file:///home/valette/git/desk-ui/source/class/desk/MPR/Slicer.js))*

### Phase 2: Memory & Resource Leak Fixes (P1)
- [x] **Task 2.1**: Implement `destruct()` in `desk.MPR.Slice.js` to dispose `__texture` and `__lookupTable`. *(Commit [`dbc44c9`](file:///home/valette/git/desk-ui/source/class/desk/MPR/Slice.js))*
- [x] **Task 2.2**: Update `removeMesh()` in `desk.THREE.Container.js` to dispose geometries and materials. *(Commit [`02d123f`](file:///home/valette/git/desk-ui/source/class/desk/THREE/Container.js))*
- [x] **Task 2.3**: Implement `destruct()` in `desk.MPR.SegTools.js` to cleanly detach all event listeners and canvas elements. *(Commit [`facba0f`](file:///home/valette/git/desk-ui/source/class/desk/MPR/SegTools.js))*
- [x] **Task 2.4**: Add `try/catch` and error guards around `JSON.parse` in `desk.FileSystem.js` (`exists`, `readDir`, `executeScript`). *(Commit [`95a67be`](file:///home/valette/git/desk-ui/source/class/desk/FileSystem.js))*

### Phase 3: Qooxdoo Standards & Cleanups (P2 - Deferred)
- [ ] **Task 3.1**: Fix `__runningActions` and `__finishedActions` in `desk.Actions.js` (initialize in `construct`, set to `null` in `members`).
- [ ] **Task 3.2**: Refactor `eval()` in `desk.core.AddPromises.js` to use safe property access via `qx.Class.getByName()`.
- [ ] **Task 3.3**: Clean up `source/ext/` and `AddLibs.js` module imports to eliminate compile-time require errors.
- [ ] **Task 3.4**: Synchronize framework version in `node_modules` with `package.json` (`7.9.3`).

### Phase 4: Build System & Repository Polish (P3)
- [x] **Task 4.1**: Update `.gitignore` to include `source/ext/CTMWorkerBundle.js`, `source/resource/webpack-bundle/`, and `*.pdf`. *(Commit [`b199b33`](file:///home/valette/git/desk-ui/.gitignore))*
- [x] **Task 4.2**: Remove leftover debug code (`myGlobalParam`) in `desk.Uploader.js`. *(Commit [`643dbb5`](file:///home/valette/git/desk-ui/source/class/desk/Uploader.js))*
- [x] **Task 4.3**: Add null safety to `desk.Xterm.Terminal.destruct()`. *(Commit [`2274ebf`](file:///home/valette/git/desk-ui/source/class/desk/Xterm/Terminal.js))*
- [x] **Task 4.4**: Inconsistent context binding in `desk.FileField.js` (Rule 5). *(Commit [`a5679cb`](file:///home/valette/git/desk-ui/source/class/desk/FileField.js))*
- [x] **Task 4.5**: Fix array mutation inside `forEach` in `desk.LinkMixin.js`. *(Commit [`9a24350`](file:///home/valette/git/desk-ui/source/class/desk/LinkMixin.js))*
- [x] **Task 4.6**: Fix modulo calculation on empty children in `desk.TabView.js`. *(Commit [`bd9beb4`](file:///home/valette/git/desk-ui/source/class/desk/TabView.js))*
- [ ] **Task 4.7**: Introduce a test harness for core utility classes.

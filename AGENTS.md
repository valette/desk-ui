# Instructions for AI Coding Agents (desk-ui)

## Project Overview
`desk-ui` is a web-based scientific desktop environment for 3D visualization and processing of medical images (CT, MRI, NIfTI, DICOM, MHD) built on [Qooxdoo (qx 7.x)](https://qooxdoo.org/) and [Three.js](https://threejs.org/).

## Critical Coding Rules
1. **NO ES6 CLASS SYNTAX**: Never write `class Foo extends Bar`. You MUST use `qx.Class.define("desk.namespace.ClassName", { extend: ..., construct: ..., members: ..., properties: ..., events: ..., destruct: ... })`.
2. **SUPER CALLS**: Use `this.base(arguments)` in constructors and overridden methods.
3. **MEMBER DECLARATION**: Never assign array `[]` or object `{}` literals in the `members: { ... }` block declaration. Assign them in `construct : function () { this.__myArray = []; }`.
4. **ASYNC METHODS**: Prefer `*Async` methods (`desk.Actions.executeAsync`, `desk.FileSystem.readFileAsync`, `desk.FileSystem.writeFileAsync`, `container.addFileAsync`, `mpr.addVolumeAsync`) with `async/await`. These are provided dynamically by `desk.core.AddPromises`.
5. **EVENT LISTENERS**: Always supply context: `target.addListener("event", this.__handler, this)`.
6. **MEMORY DISPOSAL**: Every class creating WebGL buffers, textures, canvas elements, or global listeners must implement `destruct: function() { ... }` to dispose them.

## Important Namespaces
- `desk.Actions`: Singleton for backend RPC execution, caching, streaming, and cancellation.
- `desk.Action`: UI container for configuring, connecting, and running a specific RPC action.
- `desk.FileSystem`: Virtual file system for reading/writing remote files, scripts, and directories.
- `desk.THREE.*`: 3D rendering (`Scene`, `Container`, `Viewer`, `Animator`, `Loader`).
- `desk.MPR.*`: Multi-Planar Reconstruction (`Container`, `Volume`, `Slice`, `SliceView`, `Slicer`, `Viewer`, `SegTools`, `CropTool`).
- `desk.Ace.*`: In-browser code editing (`Container`, `Editor`, `TabbedEditor`).
- `desk.Xterm.*`: Embedded terminals and logs (`Container`, `Terminal`, `Logger`, `FileTail`).
- `desk.FileBrowser`: Virtual file explorer tree.
- `desk.LinkMixin`: Synchronizing camera/crosshairs across viewers.
- `desk.WindowMixin`: Wrapping any composite in a floating window.

## Available Global Variables (Injected by `desk.core.AddLibs`)
- `THREE`, `_` (lodash), `async`, `chroma`, `d3`, `bb`/`c3`, `jstat`, `numeric`, `randomJS`, `MHD`.

## Build & Test Commands
- Dev watch mode: `npm run dev`
- Build source target: `npx qx compile --target source`
- Full compile: `npm run compile`
- Assets & Workers: `npm run fixCss && npm run buildWorkers`
- API Viewer build: `npx qx compile --app-name=apiviewer`

For extensive documentation, see [LLM_GUIDE.md](LLM_GUIDE.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/API.md](docs/API.md).

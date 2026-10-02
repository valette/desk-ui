# DESK-UI

[![License: CeCILL-B](https://img.shields.io/badge/License-CeCILL--B-blue.svg)](https://spdx.org/licenses/CeCILL-B.html)
[![Node: >=8.0.0](https://img.shields.io/badge/node-%3E%3D8.0.0-brightgreen.svg)](https://nodejs.org/)
[![Qooxdoo: 7.9](https://img.shields.io/badge/qooxdoo-7.9-orange.svg)](https://qooxdoo.org/)
[![Three.js: r183](https://img.shields.io/badge/three.js-r183-black.svg)](https://threejs.org/)

**DESK** (*Desktop Environment for Scientific Knowledge*) is a high-performance web front-end and remote desktop designed for interactive 3D visualization and processing of scientific and medical imaging data (CT, MRI, NIfTI, DICOM, MetaImage, and 3D polygonal surface meshes).

`desk-ui` provides the client-side user interface, rendering engine, and RPC action pipeline built on top of [Qooxdoo](https://qooxdoo.org/) and [Three.js](https://threejs.org/).

---

## 📖 Table of Contents

- [Live Demo & Project Links](#live-demo-project-links)
- [Architecture & Overview](#architecture-overview)
- [Key Features](#key-features)
- [Documentation & AI Coding Guides](#documentation-ai-coding-guides)
- [Backend Hosts](#backend-hosts)
- [Quick Start & Build Instructions](#quick-start-build-instructions)
- [Development Workflow](#development-workflow)
- [Citation & License](#citation-license)

---

<a id="live-demo-project-links"></a>
## 🌐 Live Demo & Project Links

- **Interactive Live Demo:** [https://desk.creatis.insa-lyon.fr/demo/](https://desk.creatis.insa-lyon.fr/demo/)
- **Project Homepage:** [http://www.creatis.insa-lyon.fr/~valette/desk.html](http://www.creatis.insa-lyon.fr/~valette/desk.html)
- **Static Content Showcase:** [http://www.creatis.insa-lyon.fr/~valette/200](http://www.creatis.insa-lyon.fr/~valette/200)

---

<a id="architecture-overview"></a>
## 🏛 Architecture & Overview

`desk-ui` bridges rich browser-based WebGL visualizers with backend scientific computation:

1. **RPC Actions Framework (`desk.Actions`)**: Command-line utilities on the server are exposed as JSON-defined "actions". The front-end triggers jobs, tracks progress, streams `stdout`/`stderr` logs, and caches deterministic results.
2. **Virtual File System (`desk.FileSystem`)**: Client-side abstraction for remote file queries, reading, writing, script execution, and workspace exploration over WebSocket/REST.
3. **Multi-Planar Reconstruction (`desk.MPR.*`)**: Interactive 3-plane orthogonal slicing (Axial, Coronal, Sagittal) and 3D surface rendering powered by Web Workers.
4. **WebGL 3D Rendering (`desk.THREE.*`)**: Hardware-accelerated rendering for meshes (VTK, OpenCTM, STL, PLY, OBJ, XYZ) with trackball controls, point picking, clipping planes, and cross-viewer camera synchronization.
5. **Integrated Developer Tools**: Multi-tab code editor with syntax highlighting (`desk.Ace.*`), interactive shell terminals (`desk.Xterm.*`), and virtual file explorer (`desk.FileBrowser`).

---

<a id="key-features"></a>
## 🚀 Key Features

- **Medical Volume Visualization**: High-speed slicing and rendering of NIfTI (.nii, .nii.gz), MetaImage (.mhd, .mha), DICOM (.dcm), and raw 3D/4D volumes.
- **Interactive Segmentation Tools (`desk.MPR.SegTools`)**: Multi-label 2D seed drawing, graph-cut segmentation algorithms, region growing, and mask-to-mesh conversion.
- **Synchronized Viewers (`desk.LinkMixin`)**: Link rotation, zoom, crosshair positions, and clipping planes across multiple 2D and 3D viewers simultaneously.
- **Offline / Static Web Export ("Statifier")**: Pre-compute action outputs and file queries into `cache/responses.json` to publish zero-backend static web demonstrations.
- **Asynchronous Execution**: Native `async`/`await` support across all file system operations and RPC tasks via `desk.core.AddPromises`.

---

<a id="documentation-ai-coding-guides"></a>
## 📚 Documentation & AI Coding Guides

| Document | Description |
| :--- | :--- |
| 🏗️ [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) | Deep architectural blueprint, component design, data flow diagrams, and memory management rules. |
| 📑 [**docs/API.md**](docs/API.md) | Exhaustive API reference for all classes, singletons, mixins, properties, methods, and events. |
| 🤖 [**LLM_GUIDE.md**](LLM_GUIDE.md) | Crucial guidelines, Qooxdoo syntax patterns, and common pitfalls for **LLM Coding Agents** (Claude, Gemini, Cursor, Copilot). |
| ⚡ [**AGENTS.md**](AGENTS.md) | Compact agent prompt instructions (symlinked to `CLAUDE.md`). |

---

<a id="backend-hosts"></a>
## 🖥️ Backend Hosts

This repository contains the front-end user interface. To run with a live backend, pair with one of the following:

- **Web Server Hosting**: [`desk`](https://github.com/valette/desk) (Node.js backend with Socket.IO)
- **Local Desktop App (Electron)**: [`desk-electron`](https://github.com/valette/desk-electron)
- **Local Desktop App (NW.js)**: [`desk-nw`](https://github.com/valette/desk-nw)

---

<a id="quick-start-build-instructions"></a>
## 📦 Quick Start & Build Instructions

### Prerequisites
- Node.js (>= 8.0.0, recommended LTS 18+)
- npm
- git

### Installation
```bash
git clone https://github.com/valette/desk-ui.git
cd desk-ui
npm install
```

### Building
```bash
# Full clean production build:
npm run buildClean

# Or standard build:
npm run build
```

---

<a id="development-workflow"></a>
## 🛠 Development Workflow

```bash
# 1. Start Qooxdoo compiler in watch mode (recompiles on source changes):
npm run dev

# 2. Recompile source target once:
npx qx compile --target source

# 3. Compile interactive Qooxdoo API viewer:
npx qx compile --app-name=apiviewer

# 4. Rebuild Web Workers (SlicerWorker, CTMWorkerBundle):
npm run buildWorkers

# 5. Fix/copy bundled third-party CSS assets:
npm run fixCss
```

---

<a id="citation-license"></a>
## 📄 Citation & License

### Academic Citation
If you use DESK or `desk-ui` in academic work, please cite:

> H. Jacinto, R. Kéchichan, M. Desvignes, R. Prost, and S. Valette,
> *"A Web Interface for 3D Visualization and Interactive Segmentation of Medical Images"*,
> 17th International Conference on 3D Web Technology (Web 3D 2012), Los Angeles, USA, pp. 51-58, 2012.
> [[HAL Open Access PDF]](http://hal.archives-ouvertes.fr/hal-00732335)

### License
Released under the **CeCILL-B** License (BSD-compatible).
Copyright (c) CNRS, INSA-Lyon, UCBL, INSERM.

# Qooxdoo 8 (Beta) Migration Analysis for `desk-ui`

This document provides a comprehensive technical audit and feasibility analysis of upgrading `desk-ui` from Qooxdoo 7.x (`@qooxdoo/framework: 7.9.3`) to the Qooxdoo 8 development stream (`branch_8_0_beta` under Node.js 26).

---

## Executive Summary & Re-Assessment

Following the upgrade to **Node.js 26 (v26.10.0)** and testing against the latest **[`branch_8_0_beta`](https://github.com/qooxdoo/qooxdoo/tree/branch_8_0_beta)** upstream commits, the migration status has **significantly improved**:

| Issue | Status on npm `8.0.0-beta.3` (Node 22) | Status on `branch_8_0_beta` (Node 26) |
| :--- | :--- | :--- |
| **CLI Crash (`ERR_REQUIRE_ESM`)** | 🔴 Crashed on startup | 🟢 **RESOLVED** (`require(esm)` supported natively in Node 26) |
| **Engine Warnings (`EBADENGINE`)** | ⚠️ Multiple package engine warnings | 🟢 **RESOLVED** (Node 26 satisfies all `@inquirer` & `yargs` requirements) |
| **Module Bundler (`esbuild`)** | 🔴 27 errors (`empty.js` missing exports) | 🟢 **RESOLVED** (Bundles `commonjs-browserify.js` 15.7MB successfully) |
| **Compilation Exit Code** | 🔴 Failed with error | 🟢 **SUCCESS** (`Applications are made`, exit code 0) |
| **Package Class Collision** | 🔴 `cannot redefine a class` | 🟡 **RESOLVED WITH WORKAROUND** (Duplicate `CompilerApi` in `qxl.dialog`) |
| **Package Manifest Versions** | 🟡 Outdated `^7.0.0` warnings | 🟡 Non-blocking compiler warnings |
| **Runtime Execution** | ❓ Untested due to build failure | 🟠 **NEXT FOCUS**: Browser runtime testing & constructor ordering |

---

## What Was Resolved by Node 26 & `branch_8_0_beta`

### 1. Startup `ERR_REQUIRE_ESM` is Completely Gone
- In Node 22.11.0, CommonJS `require()` could not synchronously import pure ESM packages like `replace-in-file@^8.4.0`.
- In **Node.js 26**, `require(esm)` is enabled by default. The compiler boots instantly and cleanly without any flags or crashes.
- All `EBADENGINE` warnings during `npm install` are eliminated.

### 2. Client-Side Module Bundling (`esbuild`) Now Passes
- In the published npm package `8.0.0-beta.3`, `esbuild-plugin-polyfill-node@0.3.0` caused 27 fatal errors when bundling dependencies (`glob`, `fs`, etc.) due to missing exports in `empty.js`.
- In `branch_8_0_beta`, the upstream compiler successfully bundles all CommonJS and ES module dependencies, generating:
  - `compiled/source/desk-ui/commonjs-browserify.js` (15.7 MB)
  - `compiled/source/desk-ui/package-0.js` (303 KB)
  - `compiled/source/desk-ui/polyfill.js` (288 KB)
  - `compiled/source/desk-ui/index.js` (64 KB)
- The build finishes with **`Applications are made` and exit code 0**.

---

## The Remaining Build Blocker: Duplicate Class Definition

During testing with `branch_8_0_beta`, the compiler threw the following fatal error on startup:

```text
Error: Error while reading qx_packages/qooxdoo_qxl_apiviewer_v2_0_1/compile.js
Error: qxl.apiviewer.compile.CompilerApi is already defined; cannot redefine a class
```

### Root Cause
In Qooxdoo 8, `qx.Class.define` **strictly forbids redefining an already registered class**.

An audit of `qx_packages/` revealed that **two different packages define the exact same class**:
1. [`qx_packages/qooxdoo_qxl_apiviewer_v2_0_1/compile.js:5`](file:///home/valette/git/desk-ui/qx_packages/qooxdoo_qxl_apiviewer_v2_0_1/compile.js#L5):
   ```javascript
   qx.Class.define("qxl.apiviewer.compile.CompilerApi", { ... });
   ```
2. [`qx_packages/qooxdoo_qxl_dialog_v5_0_0/compile.js:1`](file:///home/valette/git/desk-ui/qx_packages/qooxdoo_qxl_dialog_v5_0_0/compile.js#L1):
   ```javascript
   qx.Class.define("qxl.apiviewer.compile.CompilerApi", { ... });
   ```
`qxl.dialog` copy-pasted `CompilerApi` from `qxl.apiviewer`. Under Qooxdoo 7, this was silently tolerated because duplicate class definitions had their configurations merged. In Qooxdoo 8, this throws an unhandled exception.

### The Fix
Wrapping the class definition in both `compile.js` files with an `isDefined` check immediately resolves the issue:
```javascript
if (!qx.Class.isDefined("qxl.apiviewer.compile.CompilerApi")) {
  qx.Class.define("qxl.apiviewer.compile.CompilerApi", {
    extend: qx.tool.cli.api.CompilerApi,
    // ...
  });
}
```
Once guarded, the compiler boots, processes all dependencies, and compiles `desk-ui` without errors.

---

## Remaining Challenges (Runtime & Ecosystem)

Now that compilation succeeds, the remaining hurdles are centered on the **package ecosystem** and **runtime behavior in the browser**:

### 1. Package Ecosystem Version Mismatch
The compiler outputs warnings for installed packages:
```text
desk: Needs @qooxdoo/framework version ^7.9.0, found 8.0.0-beta.3
com.zenesis.qx.upload: Needs @qooxdoo/framework version ^7.0.0, found 8.0.0-beta.3
qxl.dialog: Needs @qooxdoo/framework version ^7.0.0, found 8.0.0-beta.3
qxl.apiviewer: Needs @qooxdoo/framework version ^7.0.0, found 8.0.0-beta.3
```
While compilation still completes despite these warnings, running `qx pkg upgrade` will not find a Qooxdoo 8 compatible release for `UploadMgr` (`com.zenesis.qx.upload`).

### 2. Runtime Breaking Changes in Desk-UI
Once the compiled application runs in a browser:
- **Constructor Order**: In Qooxdoo 8, calling property setters *before* `this.base(arguments)` wipes out the assigned values when the parent constructor initializes. All `desk.*` constructors setting properties must invoke `this.base(arguments)` first.
- **Unified Property & Member Namespace**: Classes must not declare a property and a member variable with the same name.
- **Async Properties**: All properties in v8 natively have `setAsync`. The dynamic promisification in [`desk.core.AddPromises`](file:///home/valette/git/desk-ui/source/class/desk/core/AddPromises.js) must be verified to ensure it does not collide with built-in async methods.
- **Parallel Async Event Handlers**: In Qooxdoo 8, asynchronous event handlers run concurrently rather than sequentially.

---

## How to Test and Run with `branch_8_0_beta`

If you would like to run `desk-ui` with the latest Qooxdoo 8 beta code:

1. **Bootstrap the Qooxdoo compiler** (done in your scratch directory or local clone):
   ```bash
   git clone --branch branch_8_0_beta https://github.com/qooxdoo/qooxdoo.git /path/to/qooxdoo
   cd /path/to/qooxdoo
   npm ci
   ./bootstrap-compiler
   ```
2. **Apply the duplicate class guard** to `qx_packages`:
   Ensure `qx_packages/qooxdoo_qxl_dialog_v5_0_0/compile.js` and `qx_packages/qooxdoo_qxl_apiviewer_v2_0_1/compile.js` check `if (!qx.Class.isDefined("qxl.apiviewer.compile.CompilerApi"))`.
3. **Compile `desk-ui`**:
   ```bash
   /path/to/qooxdoo/bin/build/qx compile --target source
   ```
4. **Launch the development server**:
   ```bash
   /path/to/qooxdoo/bin/build/qx compile --target source --watch
   ```

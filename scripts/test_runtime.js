const { spawn } = require('child_process');

async function testRuntime() {
  const ff = spawn('firefox', [
    '--headless',
    '--remote-debugging-port', '9222'
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let ws = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      ws = new WebSocket('ws://127.0.0.1:9222/session');
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
      });
      break;
    } catch (_) {}
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('Could not connect to Firefox WebDriver BiDi');
    ff.kill();
    process.exit(1);
  }

  let id = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  const logs = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
      return;
    }

    if (msg.method === 'log.entryAdded') {
      const p = msg.params;
      const text = p.text || (p.args || []).map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
      logs.push({ level: p.level, type: p.type, text });
      console.log(`[BROWSER ${p.level ? p.level.toUpperCase() : 'LOG'}]`, text);
      if (p.level === 'error') {
        console.log('[ERROR ENTRY FULL]', JSON.stringify(p, null, 2));
      }
    }
  };

  try {
    await send('session.new', { capabilities: {} });
    await send('session.subscribe', { events: ['log.entryAdded'] });
    const tree = await send('browsingContext.getTree', {});
    const contextId = tree.result.contexts[0].context;

    console.log('Navigating to http://valette:desk@localhost:8080/ ...');
    await send('browsingContext.navigate', {
      context: contextId,
      url: 'http://valette:desk@localhost:8080/',
      wait: 'complete'
    });
    await new Promise(r => setTimeout(r, 1000));

    console.log('Navigating to http://valette:desk@localhost:8080/ui/compiled/source/ ...');
    await send('browsingContext.navigate', {
      context: contextId,
      url: 'http://valette:desk@localhost:8080/ui/compiled/source/',
      wait: 'complete'
    });

    // Wait for desk.Application to finish initializing
    await new Promise(r => setTimeout(r, 3000));

    const checkRes = await send('script.evaluate', {
      target: { context: contextId },
      expression: `(() => {
        try {
          return JSON.stringify({
            THREE: typeof window.THREE,
            TrackballControls2: typeof window.THREE?.TrackballControls2,
            CTMLoader: typeof window.THREE?.CTMLoader,
            VTKLoader: typeof window.THREE?.VTKLoader,
            OBJLoader: typeof window.THREE?.OBJLoader,
            PLYLoader: typeof window.THREE?.PLYLoader,
            STLLoader: typeof window.THREE?.STLLoader,
            XYZLoader: typeof window.THREE?.XYZLoader,
            TransformControls: typeof window.THREE?.TransformControls,
            DragControls: typeof window.THREE?.DragControls,
            BufferGeometryUtils: typeof window.THREE?.BufferGeometryUtils,
            MHD: typeof window.MHD,
            Actions: typeof desk?.Actions?.getInstance,
            FileSystem: typeof desk?.FileSystem?.getInstance,
            mprViewerCreated: (() => {
              try {
                const v = new desk.MPR.Viewer();
                return !!v;
              } catch (e) {
                return "ERR: " + e.message + " at " + e.stack;
              }
            })(),
            fileBrowserCreated: (() => {
              try {
                const fb = new desk.FileBrowser();
                return !!fb;
              } catch (e) {
                return "ERR: " + e.message + " at " + e.stack;
              }
            })(),
            threeViewerCreated: (() => {
              try {
                const v = new desk.THREE.Viewer();
                return !!v;
              } catch (e) {
                return "ERR: " + e.message + " at " + e.stack;
              }
            })(),
            aceContainerCreated: (() => {
              try {
                const ac = new desk.Ace.Container();
                return !!ac;
              } catch (e) {
                return "ERR: " + e.message + " at " + e.stack;
              }
            })(),
            xtermContainerCreated: (() => {
              try {
                const xc = new desk.Xterm.Container();
                return !!xc;
              } catch (e) {
                return "ERR: " + e.message + " at " + e.stack;
              }
            })(),
            mprViewerSphereCreated: (() => {
              try {
                const v = new desk.MPR.Viewer("data/sphere.mhd");
                return !!v;
              } catch (e) {
                return "ERR: " + e.message + " at " + e.stack;
              }
            })(),
            mprViewerAddVolume: (() => {
              try {
                window.testMpr = new desk.MPR.Viewer();
                window.testMpr.addVolume("data/sphere.mhd");
                return "triggered";
              } catch (e) {
                return "ERR: " + e.message + " at " + e.stack;
              }
            })()
          }, null, 2);
        } catch (e) {
          return "EVAL_ERROR: " + e.message;
        }
      })()`,
      awaitPromise: false
    });

    console.log('\n=== RUNTIME CHECK RESULT ===');
    console.log(checkRes.result?.result?.value || JSON.stringify(checkRes.result));
    console.log('============================\n');

    // Wait for async slicing actions to execute and log
    console.log('Waiting 10s for async slicing actions...');
    await new Promise(r => setTimeout(r, 10000));

    const postRes = await send('script.evaluate', {
      target: { context: contextId },
      expression: `(() => {
        try {
          const mpr = window.testMpr;
          const viewers = mpr ? mpr.getViewers() : [];
          return JSON.stringify({
            mprExists: !!mpr,
            viewersCount: viewers.length,
            viewersDetails: viewers.map((v, i) => {
              const slice = v.getFirstSlice();
              return {
                index: i,
                orientation: v.getOrientation(),
                slice: v.getSlice(),
                firstSliceReady: slice ? slice.isReady() : false,
                crossPosition: v.getCrossPosition()
              };
            })
          }, null, 2);
        } catch (e) {
          return "POST_EVAL_ERROR: " + e.message;
        }
      })()`,
      awaitPromise: false
    });

    console.log('\n=== POST-SLICING CHECK RESULT ===');
    console.log(postRes.result?.result?.value || JSON.stringify(postRes.result));
    console.log('=================================\n');

    const threeLinkRes = await send('script.evaluate', {
      target: { context: contextId },
      expression: `(() => {
        try {
          const v1 = window.v1 = new desk.THREE.Viewer("data/0.vtk");
          const v2 = window.v2 = new desk.THREE.Viewer("data/0.vtk");
          v2.link(v1);

          const c1 = v1.getControls();
          const c2 = v2.getControls();
          const cam1 = v1.getCamera();
          const cam2 = v2.getCamera();

          cam1.position.set(0, 0, 100);
          cam2.position.set(0, 0, 100);
          c1.update();
          c2.update();

          const infoBefore = {
            c1_zoomUsingZ: c1.zoomUsingZ,
            c2_zoomUsingZ: c2.zoomUsingZ,
            isPerspective1: !!cam1.isPerspectiveCamera,
            isPerspective2: !!cam2.isPerspectiveCamera,
            cam1_pos: cam1.position.toArray(),
            cam2_pos: cam2.position.toArray()
          };

          // Simulate right click zoom on v1: button 1 (drag downward by 50px)
          c1.mouseDown(1, 100, 100);
          c1.mouseMove(100, 150);
          v1.render();
          v1._propagateLinks();
          c1.mouseUp();

          const infoAfterV1Zoom = {
            cam1_pos: cam1.position.toArray(),
            cam2_pos: cam2.position.toArray()
          };

          // Simulate right click zoom on v2: button 1 (drag upward by 25px)
          c2.mouseDown(1, 100, 100);
          c2.mouseMove(100, 75);
          v2.render();
          v2._propagateLinks();
          c2.mouseUp();

          const infoAfterV2Zoom = {
            cam1_pos: cam1.position.toArray(),
            cam2_pos: cam2.position.toArray()
          };

          return JSON.stringify({ infoBefore, infoAfterV1Zoom, infoAfterV2Zoom }, null, 2);
        } catch (e) {
          return "THREE_LINK_ERROR: " + e.message + " at " + e.stack;
        }
      })()`,
      awaitPromise: false
    });

    console.log('\n=== THREE VIEWER LINKING CHECK RESULT ===');
    console.log(threeLinkRes.result?.result?.value || JSON.stringify(threeLinkRes.result));
    console.log('=========================================\n');

  } catch (err) {
    console.error('Error during testing:', err);
  } finally {
    try { ws.close(); } catch (_) {}
    ff.kill();
  }
}

testRuntime().catch(e => {
  console.error(e);
  process.exit(1);
});

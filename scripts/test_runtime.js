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
    }
  };

  try {
    await send('session.new', { capabilities: {} });
    await send('session.subscribe', { events: ['log.entryAdded'] });
    const tree = await send('browsingContext.getTree', {});
    const contextId = tree.result.contexts[0].context;

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
    console.log('Waiting 5s for async slicing actions...');
    await new Promise(r => setTimeout(r, 5000));

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

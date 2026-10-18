import { launchChrome, startServer } from "./helpers.mjs";

// No snapshots are serialized here, so getter probes can observe tree traversal.
export const panelPrelude = `
    (() => {
      const event = () => {
        const listeners = new Set();
        return { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn),
          emit: value => [...listeners].forEach(fn => fn(value)) };
      };
      const onMessage = event();
      const onNavigated = event();
      let connections = 0;
      let saved = { actionFilters: [
        { id: 'default-ngrx', pattern: '@ngrx', enabled: false, readonly: true },
        { id: 'default-router', pattern: '[Router]', enabled: true, readonly: true },
        { id: 'default-screen-width', pattern: '[Screen width]', enabled: false, readonly: true },
        { id: 'default-websocket', pattern: '[WebSocket connection]', enabled: false, readonly: true },
      ] };
      const port = { onMessage, onDisconnect: event(), postMessage() {}, disconnect() {} };
      Object.assign(window.chrome ||= {}, {
        runtime: { connect: () => { connections++; return port; } },
        devtools: { inspectedWindow: { tabId: 1 }, network: { onNavigated } },
        storage: { local: { get: async () => saved, set: async value => { saved = { ...saved, ...value }; } } },
      });
      window.ngrxUITest = {
        emit: action => onMessage.emit({ type: 'NGRX_ACTION', payload: action }),
        navigate: () => onNavigated.emit('https://next-page.example'),
        status: status => onMessage.emit({ type: 'CONNECTION_STATUS', status }),
        disconnect: () => port.onDisconnect.emit(),
        get connections() { return connections; },
        visible: visible => { window.__ngrxInspectorPanelVisible = visible; window.dispatchEvent(new Event('ngrx-inspector-visibility')); },
      };
    })();
  `;

export async function openMockPanel(t) {
  const server = await startServer();
  t.after(() => server.close());
  const browser = await launchChrome();
  t.after(() => browser.close());
  const { sessionId } = await browser.newPage();
  const rpc = (method, params = {}) => browser.rpc(method, params, sessionId);
  const evaluate = (expression) => browser.evaluate(sessionId, expression);
  const waitFor = (expression) => browser.waitFor(sessionId, expression);
  await rpc("Emulation.setDeviceMetricsOverride", {
    width: 1100,
    height: 760,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await rpc("Page.addScriptToEvaluateOnNewDocument", { source: panelPrelude });
  await rpc("Page.navigate", { url: server.url });
  await waitFor("!!document.querySelector('.latest-action')");
  return { browser, sessionId, rpc, evaluate, waitFor };
}

import assert from "node:assert/strict";
import test from "node:test";
import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildRoot,
  delay,
  launchChrome,
  startServer,
  writeArtifact,
} from "./helpers.mjs";

// Only the DevTools inspected-tab facade and fault probes are injected into a temporary
// copy. Production content script, worker and real Chrome ports run in extension contexts.
test(
  "extension capture subscriptions, disconnect recovery and navigation in Chrome",
  { timeout: 120_000 },
  async (t) => {
    const browser = await launchChrome({ extensions: true });
    t.after(() => browser.close());
    const root = path.join(browser.directory, "extension");
    await cp(buildRoot, root, { recursive: true });
    const indexPath = path.join(root, "index.html");
    await writeFile(
      indexPath,
      (await readFile(indexPath, "utf8")).replace(
        "<head>",
        '<head><script src="runtime-test-preload.js"></script>',
      ),
    );
    await writeFile(path.join(root, "runtime-test-preload.js"), "");
    const contentPath = path.join(root, "content-script.js");
    await writeFile(
      contentPath,
      "chrome.runtime.onConnect.addListener(port => { if (port.name === 'ngrx-inspector-source') globalThis.runtimeProbePort = port; });\n" +
        (await readFile(contentPath, "utf8")),
    );
    const server = await startServer({
      html: `<!doctype html><title>NgRx capture fixture</title><script>
    window.sent = 0; window.received = 0;
    addEventListener('message', event => { if (event.data?.source === 'ngrx-inspector') received++; });
    window.emitActions = count => {
      for (let i = 0; i < count; i++) {
        const id = ++sent;
        postMessage({ source: 'ngrx-inspector', payload: { id, type: 'Action ' + id, state: { count: id }, timestamp: id } }, '*');
      }
      return sent;
    };
  </script>`,
    });

    t.after(() => server.close());
    const { rpc, evaluate, waitFor, attach, errors, contexts } = browser;
    let panel;
    try {
      const { id: extensionId } = await rpc("Extensions.loadUnpacked", {
        path: root,
      });
      let workerTarget;
      for (let i = 0; i < 100; i++) {
        workerTarget = (await rpc("Target.getTargets")).targetInfos.find(
          (item) =>
            item.type === "service_worker" &&
            item.url.startsWith("chrome-extension://" + extensionId),
        );
        if (workerTarget) break;
        await delay(100);
      }
      assert.ok(workerTarget, "Extension worker did not start");
      const worker = await attach(workerTarget.targetId);
      await evaluate(
        worker,
        `(() => {
    globalThis.captureProbe = { snapshots: 0, opened: 0, closed: 0, tabId: null, icons: [], completed: 0 };
    const setIcon = chrome.action.setIcon.bind(chrome.action);
    chrome.action.setIcon = options => {
      const applied = { tabId: options.tabId, path: { ...options.path } };
      return setIcon(options).then(() => { captureProbe.icons.push(applied); });
    };
    chrome.runtime.onMessage.addListener((message, sender) => {
      if (message.type === 'NGRX_CONTENT_READY') captureProbe.tabId = sender.tab.id;
    });
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (tabId === captureProbe.tabId && changeInfo.status === 'complete') captureProbe.completed++;
    });
    const connect = chrome.tabs.connect.bind(chrome.tabs);
    chrome.tabs.connect = (...args) => {
      const port = connect(...args); captureProbe.opened++;
      port.onMessage.addListener(message => { if (message.type === 'NGRX_ACTION') captureProbe.snapshots++; });
      let closed = false;
      const recordClose = () => { if (!closed) { closed = true; captureProbe.closed++; } };
      port.onDisconnect.addListener(() => { void chrome.runtime.lastError; recordClose(); });
      const disconnect = port.disconnect.bind(port);
      port.disconnect = () => { recordClose(); return disconnect(); };
      return port;
    };
  })()`,
      );
      const fixtureTarget = (
        await rpc("Target.createTarget", { url: "about:blank" })
      ).targetId;
      const fixture = await attach(fixtureTarget);
      await rpc("Page.navigate", { url: server.url }, fixture);
      await waitFor(worker, "Number.isInteger(captureProbe.tabId)");
      const tabId = await evaluate(worker, "captureProbe.tabId");
      const tabIcons = `captureProbe.icons.filter(icon => icon.tabId === ${tabId})`;
      const waitForIcon = (filename) =>
        waitFor(
          worker,
          `${tabIcons}.at(-1)?.path[16] === ${JSON.stringify(filename)}`,
        );
      await waitForIcon("icon_16.png");
      await evaluate(fixture, "emitActions(3000)");
      await waitFor(fixture, "received === sent");
      await waitForIcon("icon_active_16.png");
      assert.equal(await evaluate(worker, "captureProbe.snapshots"), 0);
      for (const route of [
        "history.pushState({}, '', '/next-route')",
        "history.replaceState({}, '', '/replaced-route')",
        "location.hash = 'next-section'",
      ]) {
        const completed = await evaluate(worker, "captureProbe.completed");
        const iconsBefore = await evaluate(worker, `${tabIcons}.length`);
        await evaluate(fixture, route);
        await waitFor(worker, `captureProbe.completed > ${completed}`);
        // The detection reply and Chrome's icon update both finish after navigation.
        await waitFor(worker, `${tabIcons}.length > ${iconsBefore}`);
        assert.match(
          await evaluate(worker, `chrome.action.getTitle({ tabId: ${tabId} })`),
          /NgRx detected/,
          route,
        );
        assert.equal(
          await evaluate(
            worker,
            `${tabIcons}.slice(${iconsBefore}).every(icon => icon.path[16] === 'icon_active_16.png')`,
          ),
          true,
          route,
        );
      }
      assert.equal(await evaluate(worker, "captureProbe.opened"), 0);
      assert.equal(await evaluate(worker, "captureProbe.snapshots"), 0);
      const openPanel = async () => {
        const targetId = (
          await rpc("Target.createTarget", { url: "about:blank" })
        ).targetId;
        const sessionId = await attach(targetId);
        await writeFile(
          path.join(root, "runtime-test-preload.js"),
          `(() => {
      const listeners = new Set();
      window.runtimeProbeNavigate = () => listeners.forEach(listener => listener('http://next-page.example'));
      Object.defineProperty(chrome, 'devtools', { value: {
        inspectedWindow: { tabId: ${tabId} },
        network: { onNavigated: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) } },
      } });
    })();`,
        );
        await rpc(
          "Emulation.setDeviceMetricsOverride",
          { width: 900, height: 760, deviceScaleFactor: 1, mobile: false },
          sessionId,
        );
        await rpc(
          "Page.navigate",
          { url: `chrome-extension://${extensionId}/index.html` },
          sessionId,
        );
        await waitFor(
          sessionId,
          "document.querySelector('.connection-status')?.getAttribute('data-state') === 'connected'",
        );
        return { targetId, sessionId };
      };
      panel = await openPanel();
      assert.equal(
        await evaluate(
          panel.sessionId,
          "document.querySelectorAll('.row').length",
        ),
        0,
      );
      await evaluate(fixture, "emitActions(2)");
      await waitFor(
        panel.sessionId,
        "document.querySelectorAll('.row').length === 2",
      );
      await evaluate(
        panel.sessionId,
        "document.querySelector('.latest-action').click()",
      );
      await waitFor(
        panel.sessionId,
        "!!document.querySelector('action-details-tabs')",
      );
      await evaluate(
        panel.sessionId,
        "[...document.querySelectorAll('action-details-tabs button')].find(button => button.textContent.trim().toLowerCase() === 'diff').click()",
      );
      await waitFor(
        panel.sessionId,
        "document.querySelector('.before')?.textContent === '3001'",
      );
      await evaluate(
        panel.sessionId,
        "window.__ngrxInspectorPanelVisible = false; window.dispatchEvent(new Event('ngrx-inspector-visibility'))",
      );
      await waitFor(worker, "captureProbe.closed >= 1");
      await waitFor(
        panel.sessionId,
        "document.querySelector('.connection-status').getAttribute('data-state') === 'paused'",
      );
      await evaluate(fixture, "emitActions(3000)");
      await waitFor(fixture, "received === sent");
      assert.equal(await evaluate(worker, "captureProbe.snapshots"), 2);
      await waitForIcon("icon_active_16.png");
      assert.equal(
        await evaluate(
          panel.sessionId,
          "document.querySelector('.selected-action-type').textContent",
        ),
        "Action 3002",
      );
      await evaluate(
        panel.sessionId,
        "window.__ngrxInspectorPanelVisible = true; window.dispatchEvent(new Event('ngrx-inspector-visibility'))",
      );
      await waitFor(
        panel.sessionId,
        "document.querySelector('.connection-status').getAttribute('data-state') === 'connected'",
      );
      assert.equal(
        await evaluate(
          panel.sessionId,
          "document.querySelectorAll('.row').length",
        ),
        2,
      );
      await evaluate(fixture, "emitActions(1)");
      await waitFor(
        panel.sessionId,
        "document.querySelectorAll('.row').length === 3",
      );
      await evaluate(
        panel.sessionId,
        "document.querySelector('.latest-action').click()",
      );
      await waitFor(
        panel.sessionId,
        "document.querySelector('action-diff')?.textContent.includes('previous state is unavailable')",
      );
      await evaluate(fixture, "emitActions(1)");
      await waitFor(
        panel.sessionId,
        "document.querySelectorAll('.row').length === 4",
      );
      await evaluate(
        panel.sessionId,
        "document.querySelector('.latest-action').click()",
      );
      await waitFor(
        panel.sessionId,
        "document.querySelector('.before')?.textContent === '6003' && document.querySelector('.after')?.textContent === '6004'",
      );
      let contentContext;
      for (const context of contexts.filter(
        (item) => item.sessionId === fixture,
      )) {
        const probe = await rpc(
          "Runtime.evaluate",
          {
            expression: 'typeof globalThis.runtimeProbePort !== "undefined"',
            contextId: context.id,
            returnByValue: true,
          },
          fixture,
        );
        if (probe.result.value) {
          contentContext = context.id;
          break;
        }
      }
      assert.ok(contentContext, "Content-script context was not found");
      await rpc(
        "Runtime.evaluate",
        {
          expression: "runtimeProbePort.disconnect()",
          contextId: contentContext,
        },
        fixture,
      );
      await waitFor(worker, "captureProbe.opened >= 3");
      await waitFor(
        panel.sessionId,
        "document.querySelector('.connection-status').getAttribute('data-state') === 'connected'",
      );
      await evaluate(fixture, "emitActions(1)");
      await waitFor(
        panel.sessionId,
        "document.querySelectorAll('.row').length === 5",
      );
      await evaluate(
        panel.sessionId,
        "document.querySelector('.latest-action').click()",
      );
      await waitFor(
        panel.sessionId,
        "document.querySelector('action-diff')?.textContent.includes('previous state is unavailable')",
      );
      await rpc("Page.reload", {}, fixture);
      await evaluate(panel.sessionId, "runtimeProbeNavigate()");
      await waitFor(fixture, 'typeof emitActions === "function" && sent === 0');
      await waitFor(
        panel.sessionId,
        "document.querySelector('.connection-status').getAttribute('data-state') === 'waiting' && document.querySelectorAll('.row').length === 0",
      );
      await waitForIcon("icon_16.png");
      await evaluate(fixture, "emitActions(1)");
      await waitFor(
        panel.sessionId,
        "document.querySelector('.connection-status').getAttribute('data-state') === 'connected' && document.querySelectorAll('.row').length === 1",
      );
      await waitForIcon("icon_active_16.png");
      const screenshot = await rpc(
        "Page.captureScreenshot",
        { format: "png" },
        panel.sessionId,
      );
      await writeArtifact(
        "extension-connection.png",
        Buffer.from(screenshot.data, "base64"),
      );
      await rpc("Target.closeTarget", { targetId: panel.targetId });
      await waitFor(worker, "captureProbe.closed === captureProbe.opened");
      await evaluate(fixture, "emitActions(3000)");
      await waitFor(fixture, "received === sent");
      assert.equal(await evaluate(worker, "captureProbe.snapshots"), 6);
      await waitForIcon("icon_active_16.png");
      // The icon must also reset on a URL where no content script can announce READY.
      await rpc("Page.navigate", { url: "chrome://version/" }, fixture);
      await waitForIcon("icon_16.png");
      assert.match(
        await evaluate(worker, `chrome.action.getTitle({ tabId: ${tabId} })`),
        /not detected/,
      );
      assert.deepEqual(errors, []);
    } catch (error) {
      if (panel)
        await browser
          .screenshot(panel.sessionId, "extension-failure.png")
          .catch(() => {});
      await writeArtifact(
        "extension-failure.json",
        JSON.stringify({ error: error.stack, errors }, null, 2),
      );
      throw error;
    }
  },
);

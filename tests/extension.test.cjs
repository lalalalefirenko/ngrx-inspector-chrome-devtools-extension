const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const action = {
  id: 1,
  type: "Increment",
  payload: null,
  state: { count: 1 },
  timestamp: 1,
};
const script = (name) =>
  fs.readFileSync(path.join(__dirname, "..", name), "utf8");

function event() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    emit: (...args) => [...listeners].forEach((listener) => listener(...args)),
  };
}

function port(name = "ngrx-inspector") {
  const messages = [];
  return {
    name,
    messages,
    onMessage: event(),
    onDisconnect: event(),
    disconnected: false,
    postMessage(message) {
      messages.push(message);
    },
    disconnect() {
      this.disconnected = true;
      this.onDisconnect.emit();
    },
    get actions() {
      return messages.filter((message) => message.type === "NGRX_ACTION");
    },
  };
}

function contentHarness(sendMessage) {
  const messages = [];
  const onMessage = event();
  const onConnect = event();
  const page = {
    addEventListener: (_type, listener) => onMessage.addListener(listener),
  };
  vm.runInNewContext(script("content-script.js"), {
    window: page,
    chrome: {
      runtime: {
        onConnect,
        sendMessage: (message) => {
          messages.push(message);
          return sendMessage ? sendMessage(message) : Promise.resolve();
        },
      },
    },
  });
  return {
    messages,
    connect(source = port("ngrx-inspector-source")) {
      onConnect.emit(source);
      return source;
    },
    emit: (payload, source = page) =>
      onMessage.emit({ source, data: { source: "ngrx-inspector", payload } }),
  };
}

function backgroundHarness(connectSource) {
  const onConnect = event();
  const onMessage = event();
  const sources = [];
  const icons = [];
  vm.runInNewContext(script("background.js"), {
    chrome: {
      runtime: { onConnect, onMessage },
      tabs: {
        connect: (tabId, options) => {
          const source = connectSource
            ? connectSource(tabId, options)
            : port(options.name);
          sources.push({ tabId, options, source });
          return source;
        },
      },
      action: {
        setIcon: (options) => {
          icons.push(options);
          return Promise.resolve();
        },
      },
    },
  });
  return {
    onConnect,
    onMessage,
    sources,
    icons,
    source: (tabId) => sources.findLast((item) => item.tabId === tabId)?.source,
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("content script detects NgRx without forwarding snapshots while closed", () => {
  const harness = contentHarness();
  for (let id = 1; id <= 3000; id++) harness.emit({ ...action, id });
  assert.deepEqual(
    harness.messages.map((message) => message.type),
    ["NGRX_CONTENT_READY", "NGRX_DETECTED"],
  );
  assert.ok(
    harness.messages.every((message) => !Object.hasOwn(message, "action")),
  );
});

test("content script forwards every valid action over an active source port", () => {
  const harness = contentHarness();
  const source = harness.connect();
  assert.equal(source.messages[0].type, "SOURCE_STATUS");
  assert.equal(source.messages[0].detected, false);
  for (let id = 1; id <= 3000; id++) harness.emit({ ...action, id });
  assert.equal(source.actions.length, 3000);
  assert.equal(
    harness.messages.filter((message) => message.type === "NGRX_DETECTED")
      .length,
    1,
  );
});

test("content script resumes future events without replaying snapshots from a closed panel", () => {
  const harness = contentHarness();
  harness.emit(action);
  const source = harness.connect();
  assert.equal(source.messages[0].detected, true);
  assert.equal(source.actions.length, 0);
  harness.emit({ ...action, id: 2 });
  assert.equal(source.actions[0].action.id, 2);
});

test("source disconnection immediately stops snapshot forwarding", () => {
  const harness = contentHarness();
  const source = harness.connect();
  harness.emit(action);
  source.onDisconnect.emit();
  for (let id = 2; id <= 3000; id++) harness.emit({ ...action, id });
  assert.equal(source.actions.length, 1);
});

test("disconnecting a replaced source does not disable its replacement", () => {
  const harness = contentHarness();
  const old = harness.connect();
  const replacement = harness.connect();
  old.onDisconnect.emit();
  harness.emit(action);
  assert.equal(old.actions.length, 0);
  assert.equal(replacement.actions.length, 1);
});

test("content script ignores connections with another port name", () => {
  const harness = contentHarness();
  const source = harness.connect(port("unrelated"));
  harness.emit(action);
  assert.equal(source.messages.length, 0);
});

test("content script tolerates a source port that fails while forwarding", () => {
  const harness = contentHarness();
  const source = harness.connect();
  source.postMessage = () => {
    throw new Error("Disconnected");
  };
  assert.doesNotThrow(() => harness.emit(action));
  assert.doesNotThrow(() => harness.emit(action));
  assert.equal(source.actions.length, 0);
});

test("content script retries detection after asynchronous and synchronous notification failures", async () => {
  let detections = 0;
  const harness = contentHarness((message) => {
    if (message.type === "NGRX_DETECTED") {
      detections++;
      if (detections === 1)
        return Promise.reject(new Error("Worker unavailable"));
      if (detections === 2) throw new Error("Extension context invalidated");
    }
    return Promise.resolve();
  });
  harness.emit(action);
  await tick();
  harness.emit(action);
  harness.emit(action);
  harness.emit(action);
  assert.equal(detections, 3);
});

test("content script ignores malformed payloads and messages from other windows", () => {
  const harness = contentHarness();
  const source = harness.connect();
  for (const payload of [
    null,
    undefined,
    [],
    {},
    { ...action, type: 1 },
    { ...action, type: "  " },
    { ...action, id: NaN },
    { ...action, timestamp: Infinity },
    { ...action, isMeta: "true" },
    { ...action, isNew: 1 },
    { id: 1, type: "Missing state", timestamp: 1 },
  ])
    harness.emit(payload);
  harness.emit(action, {});
  assert.equal(source.actions.length, 0);
  assert.equal(harness.messages.length, 1);
});

test("content script accepts a null state and absent payload", () => {
  const harness = contentHarness();
  const source = harness.connect();
  harness.emit({ id: 1, type: "Reset", timestamp: 1, state: null });
  assert.equal(source.actions.length, 1);
});

test("content script tolerates an invalidated extension context at startup and detection", async () => {
  const harness = contentHarness(() => {
    throw new Error("Extension context invalidated");
  });
  assert.doesNotThrow(() => harness.emit(action));
  const rejected = contentHarness(() =>
    Promise.reject(new Error("Worker unavailable")),
  );
  rejected.emit(action);
  await tick();
});

test("background connects only the subscribed tab main frame and routes its source", () => {
  const harness = backgroundHarness();
  const first = port();
  const second = port();
  harness.onConnect.emit(first);
  harness.onConnect.emit(second);
  first.onMessage.emit({ type: "INIT", tabId: 12 });
  second.onMessage.emit({ type: "INIT", tabId: 13 });
  assert.deepEqual(JSON.parse(JSON.stringify(harness.sources[0].options)), {
    name: "ngrx-inspector-source",
    frameId: 0,
  });
  harness.source(12).onMessage.emit({ type: "NGRX_ACTION", action });
  assert.equal(first.actions.length, 1);
  assert.equal(first.actions[0].payload, action);
  assert.equal(second.actions.length, 0);
});

test("background publishes waiting and detected states without repeating status per action", () => {
  const harness = backgroundHarness();
  const panel = port();
  harness.onConnect.emit(panel);
  panel.onMessage.emit({ type: "INIT", tabId: 12 });
  const source = harness.source(12);
  source.onMessage.emit({ type: "SOURCE_STATUS", detected: false });
  source.onMessage.emit({ type: "SOURCE_STATUS", detected: true });
  source.onMessage.emit({ type: "NGRX_ACTION", action });
  source.onMessage.emit({ type: "NGRX_ACTION", action });
  assert.deepEqual(
    panel.messages
      .filter((message) => message.type === "CONNECTION_STATUS")
      .map((message) => message.status),
    ["waiting", "connected"],
  );
});

test("closing a panel disconnects its source and ignores queued source messages", () => {
  const harness = backgroundHarness();
  const panel = port();
  harness.onConnect.emit(panel);
  panel.onMessage.emit({ type: "INIT", tabId: 12 });
  const source = harness.source(12);
  panel.onDisconnect.emit();
  assert.equal(source.disconnected, true);
  source.onMessage.emit({ type: "NGRX_ACTION", action });
  assert.equal(panel.actions.length, 0);
});

test("disconnecting an old panel preserves its replacement and discards old source messages", () => {
  const harness = backgroundHarness();
  const first = port();
  const replacement = port();
  harness.onConnect.emit(first);
  first.onMessage.emit({ type: "INIT", tabId: 12 });
  const oldSource = harness.source(12);
  harness.onConnect.emit(replacement);
  replacement.onMessage.emit({ type: "INIT", tabId: 12 });
  first.onDisconnect.emit();
  oldSource.onMessage.emit({ type: "NGRX_ACTION", action });
  harness.source(12).onMessage.emit({ type: "NGRX_ACTION", action });
  assert.equal(oldSource.disconnected, true);
  assert.equal(first.actions.length, 0);
  assert.equal(replacement.actions.length, 1);
});

test("a new content document replaces the source and resets detection", () => {
  const harness = backgroundHarness();
  const panel = port();
  harness.onConnect.emit(panel);
  panel.onMessage.emit({ type: "INIT", tabId: 12 });
  const old = harness.source(12);
  old.onMessage.emit({ type: "SOURCE_STATUS", detected: true });
  harness.onMessage.emit(
    { type: "NGRX_CONTENT_READY" },
    { tab: { id: 12 }, frameId: 0 },
  );
  assert.notEqual(harness.source(12), old);
  assert.equal(old.disconnected, true);
  assert.equal(panel.messages.at(-1).status, "waiting");
  old.onDisconnect.emit();
  harness.source(12).onMessage.emit({ type: "NGRX_ACTION", action });
  assert.equal(panel.actions.length, 1);
});

test("a lost established source releases the panel for automatic reconnection", () => {
  const harness = backgroundHarness();
  const panel = port();
  harness.onConnect.emit(panel);
  panel.onMessage.emit({ type: "INIT", tabId: 12 });
  const source = harness.source(12);
  source.onMessage.emit({ type: "SOURCE_STATUS", detected: true });
  source.onDisconnect.emit();
  assert.equal(panel.disconnected, true);
  const replacement = port();
  harness.onConnect.emit(replacement);
  replacement.onMessage.emit({ type: "INIT", tabId: 12 });
  assert.equal(harness.sources.length, 2);
});

test("an unavailable content script stays waiting until a new document is ready", () => {
  const harness = backgroundHarness();
  const panel = port();
  harness.onConnect.emit(panel);
  panel.onMessage.emit({ type: "INIT", tabId: 12 });
  harness.source(12).onDisconnect.emit();
  assert.equal(panel.disconnected, false);
  assert.equal(panel.messages.at(-1).status, "waiting");
  harness.onMessage.emit({ type: "NGRX_CONTENT_READY" }, { tab: { id: 12 } });
  assert.equal(harness.sources.length, 2);
});

test("background handles a failing panel and closes its source", () => {
  const harness = backgroundHarness();
  const panel = port();
  harness.onConnect.emit(panel);
  panel.onMessage.emit({ type: "INIT", tabId: 12 });
  const source = harness.source(12);
  panel.postMessage = () => {
    throw new Error("Disconnected");
  };
  assert.doesNotThrow(() =>
    source.onMessage.emit({ type: "NGRX_ACTION", action }),
  );
  assert.equal(source.disconnected, true);
});

test("background tolerates a tab connection failure and retries when content becomes ready", () => {
  let fail = true;
  const harness = backgroundHarness(() => {
    if (fail) throw new Error("Unavailable");
    return port("ngrx-inspector-source");
  });
  const panel = port();
  harness.onConnect.emit(panel);
  assert.doesNotThrow(() => panel.onMessage.emit({ type: "INIT", tabId: 12 }));
  assert.equal(panel.messages.at(-1).status, "waiting");
  fail = false;
  harness.onMessage.emit({ type: "NGRX_CONTENT_READY" }, { tab: { id: 12 } });
  assert.equal(harness.sources.length, 1);
});

test("background supports tab zero and ignores invalid INIT, frames and unrelated source messages", () => {
  const harness = backgroundHarness();
  const panel = port();
  harness.onConnect.emit(panel);
  for (const message of [
    null,
    {},
    { type: "INIT", tabId: "0" },
    { type: "INIT", tabId: -1 },
  ])
    panel.onMessage.emit(message);
  assert.equal(harness.sources.length, 0);
  panel.onMessage.emit({ type: "INIT", tabId: 0 });
  harness.onMessage.emit(
    { type: "NGRX_CONTENT_READY" },
    { tab: { id: 0 }, frameId: 1 },
  );
  assert.equal(harness.sources.length, 1);
  for (const message of [
    null,
    {},
    { type: "OTHER", action },
    { type: "SOURCE_STATUS", detected: "yes" },
  ])
    harness.source(0).onMessage.emit(message);
  assert.equal(panel.actions.length, 0);
  harness.source(0).onMessage.emit({ type: "NGRX_ACTION", action });
  assert.equal(panel.actions.length, 1);
});

test("reinitializing a panel releases its previous tab source", () => {
  const harness = backgroundHarness();
  const panel = port();
  harness.onConnect.emit(panel);
  panel.onMessage.emit({ type: "INIT", tabId: 12 });
  const old = harness.source(12);
  panel.onMessage.emit({ type: "INIT", tabId: 13 });
  old.onMessage.emit({ type: "NGRX_ACTION", action });
  harness.source(13).onMessage.emit({ type: "NGRX_ACTION", action });
  assert.equal(old.disconnected, true);
  assert.equal(panel.actions.length, 1);
});

test("detection without a panel sets the icon but never creates a source connection", () => {
  const harness = backgroundHarness();
  harness.onMessage.emit({ type: "NGRX_DETECTED" }, { tab: { id: 12 } });
  assert.equal(harness.icons.length, 1);
  assert.equal(harness.sources.length, 0);
});

test("DevTools visibility is delivered to the panel window, including a hide before app startup", () => {
  const panel = { onShown: event(), onHidden: event() };
  const events = [];
  const panelWindow = {
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
    dispatchEvent: (event) => events.push(event.type),
  };
  vm.runInNewContext(script("devtools.js"), {
    chrome: {
      devtools: {
        panels: { create: (_name, _icon, _page, callback) => callback(panel) },
      },
    },
  });
  panel.onShown.emit(panelWindow);
  assert.equal(panelWindow.__ngrxInspectorPanelVisible, true);
  panel.onHidden.emit();
  assert.equal(panelWindow.__ngrxInspectorPanelVisible, false);
  panel.onShown.emit(panelWindow);
  assert.equal(panelWindow.__ngrxInspectorPanelVisible, true);
  assert.deepEqual(events, Array(3).fill("ngrx-inspector-visibility"));
});

function linkedPorts() {
  const worker = port("ngrx-inspector-source");
  const content = port("ngrx-inspector-source");
  let closed = false;
  for (const [sender, receiver] of [
    [worker, content],
    [content, worker],
  ]) {
    sender.postMessage = (message) => {
      sender.messages.push(message);
      if (!closed) receiver.onMessage.emit(message);
    };
    sender.disconnect = () => {
      if (closed) return;
      closed = true;
      worker.onDisconnect.emit();
      content.onDisconnect.emit();
    };
  }
  return { worker, content };
}

test("content and worker together deliver zero snapshots while closed and resume after reopening", async () => {
  let content;
  const sources = [];
  const background = backgroundHarness(() => {
    const pair = linkedPorts();
    sources.push(pair);
    Promise.resolve().then(() => content.connect(pair.content));
    return pair.worker;
  });
  content = contentHarness((message) => {
    background.onMessage.emit(message, { tab: { id: 12 }, frameId: 0 });
    return Promise.resolve();
  });
  for (let id = 1; id <= 3000; id++) content.emit({ ...action, id });
  assert.equal(sources.length, 0);
  const panel = port();
  background.onConnect.emit(panel);
  panel.onMessage.emit({ type: "INIT", tabId: 12 });
  await tick();
  assert.equal(panel.messages.at(-1).status, "connected");
  content.emit({ ...action, id: 3001 });
  assert.equal(panel.actions.length, 1);
  panel.onDisconnect.emit();
  for (let id = 3002; id <= 6000; id++) content.emit({ ...action, id });
  assert.equal(sources[0].content.actions.length, 1);
  const reopened = port();
  background.onConnect.emit(reopened);
  reopened.onMessage.emit({ type: "INIT", tabId: 12 });
  await tick();
  assert.equal(reopened.actions.length, 0);
  content.emit({ ...action, id: 6001 });
  assert.equal(reopened.actions.length, 1);
  assert.equal(reopened.actions[0].payload.id, 6001);
});

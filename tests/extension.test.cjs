const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const action = {
  id: 1,
  type: 'Increment',
  payload: null,
  state: { count: 1 },
  timestamp: 1,
};
const script = (name) =>
  fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function event() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    emit: (...args) => [...listeners].forEach((listener) => listener(...args)),
  };
}

function contentHarness(sendMessage) {
  const messages = [];
  const onMessage = event();
  const page = {
    addEventListener: (type, listener) => onMessage.addListener(listener),
  };
  vm.runInNewContext(script('content-script.js'), {
    window: page,
    chrome: {
      runtime: {
        sendMessage:
          sendMessage ||
          ((message) => {
            messages.push(message);
            return Promise.resolve();
          }),
      },
    },
  });
  return {
    messages,
    emit: (payload, source = page) =>
      onMessage.emit({
        source,
        data: { source: 'ngrx-inspector', payload },
      }),
  };
}

function backgroundHarness() {
  const onConnect = event();
  const onMessage = event();
  vm.runInNewContext(script('background.js'), {
    chrome: {
      runtime: { onConnect, onMessage },
      action: { setIcon: () => Promise.resolve() },
    },
  });
  return { onConnect, onMessage };
}

function port(name = 'ngrx-inspector') {
  const messages = [];
  return {
    name,
    messages,
    onMessage: event(),
    onDisconnect: event(),
    postMessage: (message) => messages.push(message),
  };
}

test('content script forwards a valid action and detects NgRx', () => {
  const harness = contentHarness();
  harness.emit(action);
  assert.equal(harness.messages.length, 2);
  assert.equal(harness.messages[0].type, 'NGRX_ACTION');
  assert.equal(harness.messages[0].action, action);
  assert.equal(harness.messages[1].type, 'NGRX_DETECTED');
});

test('content script forwards every action but detects NgRx only once per page', () => {
  const harness = contentHarness();
  for (let id = 1; id <= 3000; id++) harness.emit({ ...action, id });
  assert.equal(
    harness.messages.filter(message => message.type === 'NGRX_ACTION').length,
    3000,
  );
  assert.equal(
    harness.messages.filter(message => message.type === 'NGRX_DETECTED').length,
    1,
  );
});

test('content script retries detection after a rejected notification', async () => {
  let detections = 0;
  const harness = contentHarness(message => {
    if (message.type === 'NGRX_DETECTED' && ++detections === 1) {
      return Promise.reject(new Error('Worker unavailable'));
    }
    return Promise.resolve();
  });
  harness.emit(action);
  await new Promise(resolve => setImmediate(resolve));
  harness.emit(action);
  harness.emit(action);
  assert.equal(detections, 2);
});

test('content script retries detection after a synchronous notification failure', () => {
  let detections = 0;
  const harness = contentHarness(message => {
    if (message.type === 'NGRX_DETECTED' && ++detections === 1) {
      throw new Error('Extension context invalidated');
    }
    return Promise.resolve();
  });
  assert.doesNotThrow(() => harness.emit(action));
  harness.emit(action);
  harness.emit(action);
  assert.equal(detections, 2);
});

test('content script ignores malformed payloads', () => {
  const harness = contentHarness();
  for (const payload of [
    null,
    undefined,
    [],
    {},
    { ...action, type: 1 },
    { ...action, type: '  ' },
    { ...action, id: NaN },
    { ...action, timestamp: Infinity },
    { ...action, isMeta: 'true' },
    { ...action, isNew: 1 },
    { id: 1, type: 'Missing state', timestamp: 1 },
  ])
    harness.emit(payload);
  assert.equal(harness.messages.length, 0);
});

test('content script ignores events from other windows', () => {
  const harness = contentHarness();
  harness.emit(action, {});
  assert.equal(harness.messages.length, 0);
});

test('content script accepts a null state and absent payload', () => {
  const harness = contentHarness();
  harness.emit({ id: 1, type: 'Reset', timestamp: 1, state: null });
  assert.equal(harness.messages.length, 2);
});

test('content script tolerates an invalidated extension context', () => {
  const harness = contentHarness(() => {
    throw new Error('Extension context invalidated');
  });
  assert.doesNotThrow(() => harness.emit(action));
});

test('content script handles runtime message rejections', async () => {
  const harness = contentHarness(() =>
    Promise.reject(new Error('Worker unavailable')),
  );
  harness.emit(action);
  await new Promise((resolve) => setImmediate(resolve));
});

test('background routes actions only to the matching inspected tab', () => {
  const harness = backgroundHarness();
  const first = port();
  const second = port();
  harness.onConnect.emit(first);
  harness.onConnect.emit(second);
  first.onMessage.emit({ type: 'INIT', tabId: 12 });
  second.onMessage.emit({ type: 'INIT', tabId: 13 });
  harness.onMessage.emit({ type: 'NGRX_ACTION', action }, { tab: { id: 12 } });
  assert.equal(first.messages.length, 1);
  assert.equal(first.messages[0].payload, action);
  assert.equal(second.messages.length, 0);
});

test('disconnecting an old port preserves its replacement', () => {
  const harness = backgroundHarness();
  const first = port();
  const replacement = port();
  harness.onConnect.emit(first);
  first.onMessage.emit({ type: 'INIT', tabId: 12 });
  harness.onConnect.emit(replacement);
  replacement.onMessage.emit({ type: 'INIT', tabId: 12 });
  first.onDisconnect.emit();
  harness.onMessage.emit({ type: 'NGRX_ACTION', action }, { tab: { id: 12 } });
  assert.equal(replacement.messages.length, 1);
});

test('background supports tab ID zero', () => {
  const harness = backgroundHarness();
  const connected = port();
  harness.onConnect.emit(connected);
  connected.onMessage.emit({ type: 'INIT', tabId: 0 });
  harness.onMessage.emit({ type: 'NGRX_ACTION', action }, { tab: { id: 0 } });
  assert.equal(connected.messages.length, 1);
});

test('background ignores invalid INIT and runtime messages', () => {
  const harness = backgroundHarness();
  const connected = port();
  harness.onConnect.emit(connected);
  for (const message of [
    null,
    {},
    { type: 'INIT', tabId: '12' },
    { type: 'INIT', tabId: -1 },
  ]) {
    assert.doesNotThrow(() => connected.onMessage.emit(message));
  }
  assert.doesNotThrow(() => harness.onMessage.emit(null, { tab: { id: 12 } }));
  harness.onMessage.emit({ type: 'NGRX_ACTION', action }, { tab: { id: 12 } });
  assert.equal(connected.messages.length, 0);
});

test('reinitializing a port stops routing messages from its previous tab', () => {
  const harness = backgroundHarness();
  const connected = port();
  harness.onConnect.emit(connected);
  connected.onMessage.emit({ type: 'INIT', tabId: 12 });
  connected.onMessage.emit({ type: 'INIT', tabId: 13 });
  harness.onMessage.emit({ type: 'NGRX_ACTION', action }, { tab: { id: 12 } });
  assert.equal(connected.messages.length, 0);
  harness.onMessage.emit({ type: 'NGRX_ACTION', action }, { tab: { id: 13 } });
  assert.equal(connected.messages.length, 1);
});

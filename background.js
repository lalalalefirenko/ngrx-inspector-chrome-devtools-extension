const panelsByTabId = new Map();

function setDetectionIcon(tabId, detected) {
  const path = Object.fromEntries(
    [16, 32, 48, 128].map((size) => [
      size,
      `icon${detected ? "_active" : ""}_${size}.png`,
    ]),
  );
  try {
    chrome.action.setIcon({ tabId, path }).catch(() => {});
    chrome.action
      .setTitle({
        tabId,
        title: `NgRx Inspector — NgRx ${detected ? "detected" : "not detected"}`,
      })
      .catch(() => {});
  } catch {
    // A tab can close while its content script is announcing detection.
  }
}

function stopSource(connection) {
  const source = connection.source;
  connection.source = null;
  try {
    source?.disconnect();
  } catch {
    // Navigation or worker shutdown may have already closed this port.
  }
}

function release(connection) {
  if (panelsByTabId.get(connection.tabId) === connection) {
    panelsByTabId.delete(connection.tabId);
  }
  stopSource(connection);
}

function closePanel(connection) {
  release(connection);
  try {
    connection.port.disconnect();
  } catch {
    // The panel may already be gone.
  }
}

function sendToPanel(connection, message) {
  if (panelsByTabId.get(connection.tabId) !== connection) return false;
  try {
    connection.port.postMessage(message);
    return true;
  } catch {
    closePanel(connection);
    return false;
  }
}

function publishStatus(connection, status) {
  if (connection.status === status) return true;
  connection.status = status;
  if (status === "connected") setDetectionIcon(connection.tabId, true);
  return sendToPanel(connection, { type: "CONNECTION_STATUS", status });
}

function connectSource(connection) {
  if (panelsByTabId.get(connection.tabId) !== connection || connection.source)
    return;
  try {
    const source = chrome.tabs.connect(connection.tabId, {
      name: "ngrx-inspector-source",
      frameId: 0,
    });
    connection.source = source;
    let sourceReady = false;
    source.onMessage.addListener((message) => {
      if (
        panelsByTabId.get(connection.tabId) !== connection ||
        connection.source !== source
      )
        return;
      if (
        message?.type === "SOURCE_STATUS" &&
        typeof message.detected === "boolean"
      ) {
        sourceReady = true;
        if (!message.detected) setDetectionIcon(connection.tabId, false);
        publishStatus(connection, message.detected ? "connected" : "waiting");
      } else if (message?.type === "NGRX_ACTION") {
        sourceReady = true;
        if (publishStatus(connection, "connected")) {
          sendToPanel(connection, {
            type: "NGRX_ACTION",
            payload: message.action,
          });
        }
      }
    });
    source.onDisconnect.addListener(() => {
      // Reading lastError also consumes the expected "no content script" error.
      void chrome.runtime.lastError;
      if (connection.source !== source) return;
      connection.source = null;
      if (sourceReady) {
        // Let the panel's existing reconnect logic restore a lost source channel.
        closePanel(connection);
      } else {
        publishStatus(connection, "waiting");
      }
    });
  } catch {
    publishStatus(connection, "waiting");
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "ngrx-inspector") return;
  let connection;
  port.onMessage.addListener((message) => {
    if (
      message?.type !== "INIT" ||
      !Number.isInteger(message.tabId) ||
      message.tabId < 0
    )
      return;
    if (connection) release(connection);
    const previous = panelsByTabId.get(message.tabId);
    if (previous) release(previous);
    connection = { tabId: message.tabId, port, source: null, status: null };
    panelsByTabId.set(connection.tabId, connection);
    publishStatus(connection, "waiting");
    connectSource(connection);
  });
  port.onDisconnect.addListener(() => {
    if (connection) release(connection);
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!Number.isInteger(sender.tab?.id) || sender.tab.id < 0) return;
  if (sender.frameId !== undefined && sender.frameId !== 0) return;
  const connection = panelsByTabId.get(sender.tab.id);
  if (message?.type === "NGRX_CONTENT_READY") {
    setDetectionIcon(sender.tab.id, false);
    if (connection) {
      stopSource(connection);
      publishStatus(connection, "waiting");
      connectSource(connection);
    }
  } else if (message?.type === "NGRX_DETECTED") {
    setDetectionIcon(sender.tab.id, true);
    if (connection) connectSource(connection);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Includes navigation to restricted pages where no content script can run.
  if (changeInfo.status === "loading") setDetectionIcon(tabId, false);
});

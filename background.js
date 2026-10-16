const portsByTabId = new Map();

// ===============================
// PORT CONNECTIONS
// ===============================
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "ngrx-inspector") return;

  let tabId = null;

  port.onMessage.addListener((msg) => {
    if (msg?.type === "INIT" && Number.isInteger(msg.tabId) && msg.tabId >= 0) {
      if (tabId !== null && portsByTabId.get(tabId) === port) {
        portsByTabId.delete(tabId);
      }
      tabId = msg.tabId;
      portsByTabId.set(tabId, port);
    }
  });

  port.onDisconnect.addListener(() => {
    if (tabId !== null && portsByTabId.get(tabId) === port) {
      portsByTabId.delete(tabId);
    }
  });
});

// ===============================
// RECEIVE ACTIONS
// ===============================
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!Number.isInteger(sender.tab?.id) || sender.tab.id < 0) return;
  const tabId = sender.tab.id;

  if (msg?.type === "NGRX_ACTION") {
    const port = portsByTabId.get(tabId);
    if (port) {
      try {
        port.postMessage({ type: "NGRX_ACTION", payload: msg.action });
      } catch {
        if (portsByTabId.get(tabId) === port) portsByTabId.delete(tabId);
      }
    }
  } else if (msg?.type === "NGRX_DETECTED") {
    chrome.action.setIcon({
      tabId: tabId,
      path: "icon_active_16.png",
    });
  }
});

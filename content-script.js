(() => {
  let sourcePort = null;
  let detected = false;
  let detectionNotified = false;

  function closeSource(port) {
    if (sourcePort === port) sourcePort = null;
    try {
      port.disconnect();
    } catch {
      // The extension context may have been invalidated.
    }
  }

  // The source channel exists only while the inspector panel is subscribed.
  // Its disconnect event also disables capture if the worker shuts down.
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "ngrx-inspector-source") return;
    const previous = sourcePort;
    sourcePort = port;
    if (previous) closeSource(previous);
    port.onDisconnect.addListener(() => {
      if (sourcePort === port) sourcePort = null;
    });
    try {
      port.postMessage({ type: "SOURCE_STATUS", detected });
    } catch {
      closeSource(port);
    }
  });

  function isActionRecord(record) {
    return (
      typeof record === "object" &&
      record !== null &&
      !Array.isArray(record) &&
      typeof record.id === "number" &&
      Number.isFinite(record.id) &&
      typeof record.type === "string" &&
      record.type.trim().length > 0 &&
      typeof record.timestamp === "number" &&
      Number.isFinite(record.timestamp) &&
      Object.hasOwn(record, "state") &&
      (record.isMeta === undefined || typeof record.isMeta === "boolean") &&
      (record.isNew === undefined || typeof record.isNew === "boolean")
    );
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "ngrx-inspector")
      return;
    if (!isActionRecord(event.data.payload)) return;
    detected = true;

    if (!detectionNotified) {
      try {
        detectionNotified = true;
        chrome.runtime.sendMessage({ type: "NGRX_DETECTED" }).catch(() => {
          detectionNotified = false;
        });
      } catch {
        detectionNotified = false;
      }
    }

    const port = sourcePort;
    if (!port) return;
    try {
      port.postMessage({ type: "NGRX_ACTION", action: event.data.payload });
    } catch {
      closeSource(port);
    }
  });

  // Register listeners before announcing this document, including after navigation.
  try {
    chrome.runtime.sendMessage({ type: "NGRX_CONTENT_READY" }).catch(() => {});
  } catch {
    // A page can retain this content script after the extension is reloaded.
  }
})();

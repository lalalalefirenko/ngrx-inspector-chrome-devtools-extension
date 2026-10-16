(() => {
  let detectionNotified = false;

  // Content scripts are classic scripts; validate before crossing into the worker.
  function isActionRecord(record) {
    return (
      typeof record === "object" && record !== null && !Array.isArray(record) &&
      typeof record.id === "number" && Number.isFinite(record.id) &&
      typeof record.type === "string" && record.type.trim().length > 0 &&
      typeof record.timestamp === "number" && Number.isFinite(record.timestamp) &&
      Object.hasOwn(record, "state") &&
      (record.isMeta === undefined || typeof record.isMeta === "boolean") &&
      (record.isNew === undefined || typeof record.isNew === "boolean")
    );
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "ngrx-inspector") return;
    if (!isActionRecord(event.data.payload)) return;

    try {
      chrome.runtime.sendMessage({
        type: "NGRX_ACTION",
        action: event.data.payload,
      }).catch(() => {});

      if (!detectionNotified) {
        detectionNotified = true;
        chrome.runtime.sendMessage({ type: "NGRX_DETECTED" }).catch(() => {
          detectionNotified = false;
        });
      }
    } catch {
      detectionNotified = false;
      // A page can retain this content script after the extension is reloaded.
    }
  });
})();

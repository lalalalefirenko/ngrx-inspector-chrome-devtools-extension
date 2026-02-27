// content-script.js

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== "ngrx-inspector") return;

  chrome.runtime.sendMessage({
    type: "NGRX_ACTION",
    action: event.data.payload,
  });

  chrome.runtime.sendMessage({
    type: "NGRX_DETECTED",
  });
});

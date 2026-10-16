chrome.devtools.panels.create(
  "NgRx Inspector",
  "icon_active_16.png",
  "index.html",
  (panel) => {
    let panelWindow;
    const setVisible = (visible) => {
      if (!panelWindow) return;
      panelWindow.__ngrxInspectorPanelVisible = visible;
      panelWindow.dispatchEvent(
        new panelWindow.Event("ngrx-inspector-visibility"),
      );
    };
    panel.onShown.addListener((window) => {
      panelWindow = window;
      setVisible(true);
    });
    panel.onHidden.addListener(() => setVisible(false));
  },
);

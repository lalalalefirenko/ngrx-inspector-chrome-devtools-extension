import assert from "node:assert/strict";
import test from "node:test";
import { delay, launchChrome, startServer, writeArtifact } from "./helpers.mjs";
import { panelPrelude } from "./fixtures.mjs";

// Chrome APIs are simulated here; extension.test.mjs covers actual runtime/tabs ports.
test(
  "panel inspection, settings, focus and responsive layout in Chrome",
  { timeout: 120_000 },
  async (t) => {
    const server = await startServer();
    t.after(() => server.close());
    const browser = await launchChrome();
    t.after(() => browser.close());
    const { sessionId } = await browser.newPage();
    const rpc = (method, params = {}) => browser.rpc(method, params, sessionId);
    const evaluate = (expression) => browser.evaluate(sessionId, expression);
    const waitFor = (expression) => browser.waitFor(sessionId, expression);
    const { errors } = browser;
    await rpc("Emulation.setDeviceMetricsOverride", {
      width: 1100,
      height: 760,
      deviceScaleFactor: 1,
      mobile: false,
    });
    try {
      await rpc("Page.addScriptToEvaluateOnNewDocument", {
        source: panelPrelude,
      });
      await rpc("Page.navigate", { url: server.url });
      await waitFor("!!document.querySelector('.latest-action')");
      await waitFor(
        "document.querySelector('.connection-status')?.getAttribute('data-state') === 'waiting'",
      );
      await evaluate("ngrxUITest.disconnect()");
      await waitFor(
        "document.querySelector('.connection-status').getAttribute('data-state') === 'reconnecting'",
      );
      await waitFor("ngrxUITest.connections === 2");
      await evaluate("ngrxUITest.status('connected')");
      await waitFor(
        "document.querySelector('.connection-status').getAttribute('data-state') === 'connected'",
      );
      await evaluate(`(() => {
    for (let id = 1; id <= 2; id++) ngrxUITest.emit({ id, type: 'Action ' + id, payload: { id }, state: { count: id }, timestamp: id });
  })()`);
      await waitFor("document.querySelectorAll('.row').length === 2");
      await evaluate(
        "[...document.querySelectorAll('.row')].find(row => row.textContent.trim() === 'Action 2').click()",
      );
      await waitFor(
        "document.querySelector('.selected-action-type')?.textContent === 'Action 2'",
      );
      await evaluate(
        "[...document.querySelectorAll('action-details-tabs button')].find(button => button.textContent.trim().toLowerCase() === 'diff').click()",
      );
      await evaluate(`(() => {
    for (let id = 3; id <= 250; id++) ngrxUITest.emit({ id, type: id === 249 ? 'Special event' : 'Action ' + id, payload: { id }, state: { count: id }, timestamp: id });
  })()`);
      await waitFor(
        "!!document.querySelector('.retained-selection') && document.querySelector('.before')?.textContent === '1'",
      );
      assert.equal(
        await evaluate("document.querySelector('.after').textContent"),
        "2",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('.selected-action-type').textContent",
        ),
        "Action 2",
      );
      const retainedImage = await rpc("Page.captureScreenshot", {
        format: "png",
      });
      await writeArtifact(
        "ui-retained.png",
        Buffer.from(retainedImage.data, "base64"),
      );
      await evaluate("document.querySelector('.latest-action').click()");
      await waitFor(
        "document.querySelector('.selected-action-type')?.textContent === 'Action 250' && !document.querySelector('.retained-selection')",
      );
      await waitFor(`(() => {
    const row = document.querySelector('.row.active');
    const viewport = document.querySelector('cdk-virtual-scroll-viewport');
    if (!row || !viewport) return false;
    const rect = row.getBoundingClientRect(); const bounds = viewport.getBoundingClientRect();
    return rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1 && Math.abs(rect.height - 30) < 1;
  })()`);
      await evaluate(
        "(() => { const input = document.querySelector('input.filter'); input.value = 'Special'; input.dispatchEvent(new Event('input', { bubbles: true })); })()",
      );
      await waitFor(
        "!!document.querySelector('.retained-selection') && [...document.querySelectorAll('.row')].some(row => row.textContent.trim() === 'Special event')",
      );
      await evaluate("document.querySelector('.latest-action').click()");
      await waitFor(
        "document.querySelector('.selected-action-type')?.textContent === 'Special event'",
      );
      assert.equal(
        await evaluate("document.querySelector('.before').textContent"),
        "248",
      );
      assert.equal(
        await evaluate("document.querySelector('.after').textContent"),
        "249",
      );
      await rpc("Emulation.setDeviceMetricsOverride", {
        width: 520,
        height: 760,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await delay(200);
      const footer = await evaluate(`(() => {
    const latest = document.querySelector('.latest-action').getBoundingClientRect();
    const clear = document.querySelector('.clear-btn').getBoundingClientRect();
    return { latestVisible: latest.left >= 0 && latest.right <= innerWidth && latest.bottom <= innerHeight,
      buttonsOverlap: !(latest.right <= clear.left || latest.left >= clear.right || latest.bottom <= clear.top || latest.top >= clear.bottom) };
  })()`);
      assert.equal(footer.latestVisible, true);
      assert.equal(footer.buttonsOverlap, false);
      assert.ok(
        await evaluate(
          "document.querySelector('main').getBoundingClientRect().width >= 250",
        ),
      );
      const latestImage = await rpc("Page.captureScreenshot", {
        format: "png",
      });
      await writeArtifact(
        "ui-latest.png",
        Buffer.from(latestImage.data, "base64"),
      );
      await rpc("Emulation.setDeviceMetricsOverride", {
        width: 1100,
        height: 760,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(`(() => {
    ngrxUITest.emit({ id: 300, type: '[User] Profile loaded', state: { user: { profile: { name: 'Ada' } }, theme: 'light' }, timestamp: 300 });
    ngrxUITest.emit({ id: 301, type: '[User] Logout', state: { user: null, theme: 'light' }, timestamp: 301 });
    const input = document.querySelector('input.filter');
    input.value = '[User]';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
      await waitFor("document.querySelectorAll('.row').length === 2");
      const selectProfile = () =>
        evaluate(
          "[...document.querySelectorAll('.row')].find(row => row.textContent.trim() === '[User] Profile loaded').click()",
        );
      const selectLogout = () =>
        evaluate(
          "[...document.querySelectorAll('.row')].find(row => row.textContent.trim() === '[User] Logout').click()",
        );
      const pinProfile = () =>
        evaluate(
          "[...document.querySelectorAll('action-state .key')].find(key => key.textContent.trim() === 'profile').closest('.node-header').querySelector('.pin-button').click()",
        );
      await selectProfile();
      await waitFor(
        "document.querySelector('.selected-action-type')?.textContent === '[User] Profile loaded'",
      );
      await evaluate(
        "[...document.querySelectorAll('action-details-tabs button')].find(button => button.textContent.trim().toLowerCase() === 'state').click()",
      );
      await waitFor("!!document.querySelector('action-state json-tree')");
      await evaluate(
        "[...document.querySelectorAll('action-state .key')].find(key => key.textContent.trim() === 'user').closest('.node-header').click()",
      );
      await waitFor(
        "[...document.querySelectorAll('action-state .key')].some(key => key.textContent.trim() === 'profile')",
      );
      await pinProfile();
      await waitFor(
        "document.querySelector('action-path')?.textContent.includes('profile') && document.querySelector('action-state json-tree')?.textContent.includes('Ada')",
      );
      await selectLogout();
      await waitFor(
        "!!document.querySelector('.missing-pinned-path[role=status]') && !document.querySelector('action-state json-tree')",
      );
      assert.ok(
        await evaluate(
          "document.querySelector('action-path').textContent.includes('profile')",
        ),
      );
      await rpc("Emulation.setDeviceMetricsOverride", {
        width: 520,
        height: 760,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await delay(200);
      const missingBounds = await evaluate(`(() => {
    const message = document.querySelector('.missing-pinned-path').getBoundingClientRect();
    const button = document.querySelector('.missing-pinned-path button').getBoundingClientRect();
    return { fitsMessage: button.left >= message.left && button.right <= message.right,
      fitsViewport: button.right <= innerWidth && button.bottom <= innerHeight };
  })()`);
      assert.deepEqual(missingBounds, {
        fitsMessage: true,
        fitsViewport: true,
      });
      const missingImage = await rpc("Page.captureScreenshot", {
        format: "png",
      });
      await writeArtifact(
        "ui-missing-pin.png",
        Buffer.from(missingImage.data, "base64"),
      );
      await selectProfile();
      await waitFor(
        "!document.querySelector('.missing-pinned-path') && document.querySelector('action-state json-tree')?.textContent.includes('Ada')",
      );
      assert.ok(
        await evaluate(
          "document.querySelector('action-path').textContent.includes('profile')",
        ),
      );
      await selectLogout();
      await waitFor("!!document.querySelector('.missing-pinned-path')");
      await evaluate(
        "[...document.querySelectorAll('action-path .clickable')].find(segment => segment.textContent.trim() === 'user').click()",
      );
      await waitFor(
        "!document.querySelector('.missing-pinned-path') && document.querySelector('action-state .value')?.textContent === 'null'",
      );
      await selectProfile();
      await waitFor(
        "[...document.querySelectorAll('action-state .key')].some(key => key.textContent.trim() === 'profile')",
      );
      await pinProfile();
      await waitFor(
        "document.querySelector('action-path')?.textContent.includes('profile')",
      );
      await selectLogout();
      await waitFor("!!document.querySelector('.missing-pinned-path button')");
      await evaluate(
        "document.querySelector('.missing-pinned-path button').click()",
      );
      await waitFor(
        "!document.querySelector('action-path') && !document.querySelector('.missing-pinned-path') && document.querySelector('action-state json-tree')?.textContent.includes('theme')",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('.selected-action-type').textContent",
        ),
        "[User] Logout",
      );
      await evaluate(
        "[...document.querySelectorAll('action-details-tabs button')].find(button => button.textContent.trim().toLowerCase() === 'diff').click()",
      );
      await evaluate("ngrxUITest.visible(false)");
      await waitFor(
        "document.querySelector('.connection-status').getAttribute('data-state') === 'paused'",
      );
      await evaluate(
        "ngrxUITest.emit({ id: 302, type: '[User] Skipped', state: { count: 302 }, timestamp: 302 })",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('.selected-action-type').textContent",
        ),
        "[User] Logout",
      );
      await evaluate("ngrxUITest.visible(true)");
      await waitFor(
        "document.querySelector('.connection-status').getAttribute('data-state') === 'waiting'",
      );
      await evaluate(
        "ngrxUITest.emit({ id: 303, type: '[User] Resumed', state: { count: 303 }, timestamp: 303 })",
      );
      await waitFor("document.querySelectorAll('.row').length === 3");
      await evaluate("document.querySelector('.latest-action').click()");
      await waitFor(
        "document.querySelector('.selected-action-id')?.textContent === '#303' && document.querySelector('action-diff')?.textContent.includes('previous state is unavailable')",
      );
      await evaluate(
        "ngrxUITest.emit({ id: 304, type: '[User] Next', state: { count: 304 }, timestamp: 304 })",
      );
      await waitFor("document.querySelectorAll('.row').length === 4");
      await evaluate("document.querySelector('.latest-action').click()");
      await waitFor(
        "document.querySelector('.before')?.textContent === '303' && document.querySelector('.after')?.textContent === '304'",
      );
      await evaluate("document.querySelector('.settings-btn').click()");
      await waitFor(
        "document.querySelectorAll('.filters .filter-item').length === 1",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('.filter-text').textContent.trim()",
        ),
        "@ngrx",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('.default-badge')?.textContent.trim()",
        ),
        "Built-in",
      );
      assert.ok(
        await evaluate(
          "document.querySelector('.filter-description')?.textContent.includes('NgRx internal actions')",
        ),
      );
      assert.ok(await evaluate("document.querySelector('.add-btn').disabled"));
      assert.equal(
        await evaluate(
          "document.querySelector('.prefix-list-title')?.textContent.trim()",
        ),
        "Prefixes to hide",
      );
      assert.ok(
        await evaluate(
          "getComputedStyle(document.querySelector('.prefixes-separator')).borderTopWidth === '1px'",
        ),
      );
      assert.ok(
        await evaluate(
          "[...document.querySelectorAll('button, input:not([type=checkbox])')].every(control => getComputedStyle(control).borderTopLeftRadius === '0px')",
        ),
      );
      await rpc("Emulation.setDeviceMetricsOverride", {
        width: 1400,
        height: 760,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await delay(100);
      assert.ok(
        await evaluate(
          "document.querySelector('.settings-page').getBoundingClientRect().width <= 480",
        ),
      );
      assert.ok(
        await evaluate(`(() => {
    const main = document.querySelector('main').getBoundingClientRect();
    const settings = document.querySelector('.settings-page').getBoundingClientRect();
    return Math.abs((settings.left + settings.right) / 2 - (main.left + main.right) / 2) < 1;
  })()`),
      );
      for (const selector of ["input.filter", ".filter-input"]) {
        const focus = await evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      input.focus();
      const style = getComputedStyle(input);
      return { width: style.outlineWidth, color: style.outlineColor, offset: style.outlineOffset };
    })()`);
        assert.deepEqual(focus, {
          width: "1px",
          color: "rgba(42, 109, 230, 0.45)",
          offset: "-1px",
        });
      }
      const wideSettings = await rpc("Page.captureScreenshot", {
        format: "png",
      });
      await writeArtifact(
        "ui-settings-wide.png",
        Buffer.from(wideSettings.data, "base64"),
      );
      const settingsClip = await evaluate(
        `(() => { const bounds = document.querySelector('.settings-page').getBoundingClientRect(); return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, scale: 2 }; })()`,
      );
      const settingsPreview = await rpc("Page.captureScreenshot", {
        format: "png",
        clip: settingsClip,
      });
      await writeArtifact(
        "ui-settings-preview.png",
        Buffer.from(settingsPreview.data, "base64"),
      );

      await rpc("Emulation.setDeviceMetricsOverride", {
        width: 520,
        height: 760,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await delay(100);
      const settingsBounds = await evaluate(`(() => {
    const button = document.querySelector('.add-btn').getBoundingClientRect();
    return { buttonVisible: button.right <= innerWidth,
      noHorizontalOverflow: document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth };
  })()`);
      assert.deepEqual(settingsBounds, {
        buttonVisible: true,
        noHorizontalOverflow: true,
      });
      const statusAndSettings = await rpc("Page.captureScreenshot", {
        format: "png",
      });
      await writeArtifact(
        "ui-connection-and-settings.png",
        Buffer.from(statusAndSettings.data, "base64"),
      );
      await evaluate(`(() => {
    const input = document.querySelector('.filter-input'); input.focus(); input.value = '  [User]  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
      await waitFor("!document.querySelector('.add-btn').disabled");
      await rpc("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Enter",
        code: "Enter",
        text: "\r",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
      });
      await rpc("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
      });
      await waitFor(
        "document.querySelectorAll('.filters .filter-item').length === 2 && document.querySelector('.latest-action').disabled",
      );
      assert.equal(
        await evaluate("document.querySelector('.filter-input').value"),
        "",
      );
      assert.ok(
        await evaluate(
          "document.querySelector('.add-btn').disabled && document.activeElement === document.querySelector('.filter-input')",
        ),
      );
      const customSettings = await rpc("Page.captureScreenshot", {
        format: "png",
      });
      await writeArtifact(
        "ui-settings-narrow-custom.png",
        Buffer.from(customSettings.data, "base64"),
      );
      await evaluate("document.querySelector('.remove-btn').click()");
      await waitFor(
        "document.querySelectorAll('.filters .filter-item').length === 1 && !document.querySelector('.latest-action').disabled",
      );
      await evaluate(`(() => {
    const input = document.querySelector('.filter-input'); input.value = '[LongFeature]' + 'VeryLongPrefix'.repeat(10);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
      await waitFor("!document.querySelector('.add-btn').disabled");
      await evaluate("document.querySelector('.add-btn').click()");
      await waitFor("document.querySelectorAll('.filter-item').length === 2");
      assert.ok(
        await evaluate(
          "document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth",
        ),
      );
      await evaluate("document.querySelector('.remove-btn').click()");
      await waitFor("document.querySelectorAll('.filter-item').length === 1");
      await evaluate("document.querySelector('.settings-btn').click()");
      await evaluate("ngrxUITest.navigate()");
      await waitFor(
        "!document.querySelector('.selected-action-header') && !document.querySelector('.retained-selection') && document.querySelector('.latest-action').disabled",
      );
      assert.deepEqual(errors, []);
    } catch (error) {
      await browser.screenshot(sessionId, "ui-failure.png").catch(() => {});
      await writeArtifact(
        "ui-failure.json",
        JSON.stringify({ error: error.stack, errors }, null, 2),
      );
      throw error;
    }
  },
);

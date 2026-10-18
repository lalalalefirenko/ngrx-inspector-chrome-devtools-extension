import assert from "node:assert/strict";
import test from "node:test";
import { openMockPanel } from "./fixtures.mjs";
import { writeArtifact } from "./helpers.mjs";

for (const tab of ["State", "Payload"]) {
  for (const explicitlyCollapsed of [true, false]) {
    test(
      `${tab} releases old expanded subtrees after ${explicitlyCollapsed ? "manual" : "automatic"} collapse`,
      { timeout: 60_000 },
      async (t) => {
        const { browser, evaluate, waitFor, rpc } = await openMockPanel(t);
        await rpc("HeapProfiler.enable");
        await evaluate(`(() => {
        const items = Array.from({length: 10_000}, (_, id) => ({id, text: 'old-' + id + 'x'.repeat(300)}));
        const value = {feature: {items}};
        window.previousTree = {root: new WeakRef(value), items: new WeakRef(items)};
        ngrxUITest.emit({id: 1, type: 'Old tree', timestamp: 1, state: value, payload: value});
      })()`);
        await waitFor("document.querySelectorAll('.row').length === 1");
        await evaluate("document.querySelector('.latest-action').click()");
        await waitFor("!!document.querySelector('action-details-tabs')");
        await evaluate(
          `[...document.querySelectorAll('action-details-tabs button')].find(button => button.textContent.trim() === ${JSON.stringify(tab)}).click()`,
        );
        const tree = tab === "State" ? "action-state" : "action-payload";
        const feature = `[...document.querySelectorAll('${tree} .key')].find(key => key.textContent === 'feature').closest('.node-header')`;
        await waitFor(`!!document.querySelector('${tree} json-tree')`);
        await evaluate(feature + ".click()");
        await waitFor(
          `[...document.querySelectorAll('${tree} .key')].some(key => key.textContent === 'items')`,
        );
        if (explicitlyCollapsed) {
          await evaluate(feature + ".click()");
          await waitFor(
            `![...document.querySelectorAll('${tree} .key')].some(key => key.textContent === 'items')`,
          );
        }
        await evaluate(`(() => {
        for (let id = 2; id <= 250; id++) {
          const value = {feature: {items: [], marker: 'current snapshot'}};
          ngrxUITest.emit({id, type: 'New tree ' + id, timestamp: id, state: value, payload: value});
        }
      })()`);
        await evaluate("document.querySelector('.latest-action').click()");
        await waitFor(
          "document.querySelector('.selected-action-type').textContent === 'New tree 250'",
        );
        await waitFor(
          `![...document.querySelectorAll('${tree} .key')].some(key => key.textContent === 'items')`,
        );
        await rpc("HeapProfiler.collectGarbage");
        assert.deepEqual(
          await evaluate(
            "({rootAlive: !!previousTree.root.deref(), itemsAlive: !!previousTree.items.deref()})",
          ),
          { rootAlive: false, itemsAlive: false },
        );
        await evaluate(feature + ".click()");
        await waitFor(
          `document.querySelector('${tree}').textContent.includes('current snapshot')`,
        );
        assert.deepEqual(browser.errors, []);
      },
    );
  }
}

test(
  "large State/Payload trees stay lazy and pinned paths skip unrelated data",
  { timeout: 60_000 },
  async (t) => {
    const { browser, sessionId, evaluate, waitFor } = await openMockPanel(t);
    try {
      await evaluate(`(() => {
      window.treeReads = { items: 0, unrelated: 0 };
      const items = Array.from({ length: 20_000 }, (_, id) => ({
        id, details: { get label() { treeReads.items++; return 'Item ' + id; } },
      }));
      ngrxUITest.emit({ id: 1, type: 'Large tree', timestamp: 1,
        payload: { items }, state: { user: { profile: { name: 'Ada' } }, items,
          get unrelated() { treeReads.unrelated++; return { extra: true }; } },
      });
    })()`);
      await waitFor("document.querySelectorAll('.row').length === 1");
      await evaluate("document.querySelector('.latest-action').click()");
      await waitFor("!!document.querySelector('action-details-tabs')");
      const tab = (name) =>
        evaluate(
          `[...document.querySelectorAll('action-details-tabs button')].find(button => button.textContent.trim() === ${JSON.stringify(name)}).click()`,
        );
      await tab("State");
      await waitFor("!!document.querySelector('action-state json-tree')");
      assert.equal(await evaluate("treeReads.items"), 0);
      assert.ok(
        await evaluate(
          "document.querySelectorAll('action-state json-tree').length < 10",
        ),
      );
      await evaluate(
        "[...document.querySelectorAll('action-state .key')].find(key => key.textContent.trim() === 'user').closest('.node-header').querySelector('.pin-button').click()",
      );
      await waitFor("!!document.querySelector('action-path')");
      const readsAtPin = await evaluate("treeReads.unrelated");
      await tab("Payload");
      await waitFor("!!document.querySelector('action-payload .preview')");
      assert.equal(await evaluate("treeReads.items"), 0);
      assert.ok(
        await evaluate(
          "document.querySelectorAll('action-payload json-tree').length < 5",
        ),
      );
      await tab("State");
      await waitFor("!!document.querySelector('action-state json-tree')");
      assert.equal(await evaluate("treeReads.unrelated"), readsAtPin);
      assert.equal(await evaluate("treeReads.items"), 0);

      // Deep data can be selected without recursive construction or a stack overflow.
      await evaluate(`(() => {
      let deep = { leaf: true };
      for (let depth = 0; depth < 10_000; depth++) deep = { nested: deep };
      ngrxUITest.emit({ id: 2, type: 'Deep tree', timestamp: 2, state: { user: deep } });
    })()`);
      await waitFor("document.querySelectorAll('.row').length === 2");
      await evaluate("document.querySelector('.latest-action').click()");
      await waitFor(
        "document.querySelector('.selected-action-type').textContent === 'Deep tree'",
      );
      assert.ok(
        await evaluate(
          "document.querySelectorAll('action-state json-tree').length <= 2",
        ),
      );
      await browser.screenshot(sessionId, "trees-deep-pin.png");
      assert.deepEqual(browser.errors, []);
    } catch (error) {
      await browser.screenshot(sessionId, "trees-failure.png").catch(() => {});
      throw error;
    }
  },
);

test(
  "snapshot retention stays bounded after a burst, inspection, clear and navigation",
  { timeout: 60_000 },
  async (t) => {
    const { browser, rpc, evaluate, waitFor } = await openMockPanel(t);
    await rpc("HeapProfiler.enable");
    const settle = () =>
      evaluate(
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
      );
    const sample = async () => {
      await rpc("HeapProfiler.collectGarbage");
      return {
        liveSnapshots: await evaluate(
          "probeRefs.filter(ref => ref.deref()).length",
        ),
        heapMB: (await rpc("Runtime.getHeapUsage")).usedSize / 1024 / 1024,
      };
    };
    const burstMs = await evaluate(`(() => {
    window.probeRefs = [];
    const start = performance.now();
    for (let id = 1; id <= 3000; id++) {
      const state = { count: id, items: Array.from({ length: 128 }, (_, index) => ({
        id: index, label: id + ':' + index + ':' + 'x'.repeat(200),
      })) };
      probeRefs.push(new WeakRef(state));
      ngrxUITest.emit({ id, type: 'Action ' + id, timestamp: id, state });
    }
    return performance.now() - start;
  })()`);
    await settle();
    const afterBurst = await sample();
    assert.equal(afterBurst.liveSnapshots, 200);
    await evaluate("document.querySelector('.latest-action').click()");
    await waitFor("!!document.querySelector('action-details-tabs')");
    await evaluate(
      "[...document.querySelectorAll('action-details-tabs button')].find(button => button.textContent.trim() === 'State').click()",
    );
    await waitFor("!!document.querySelector('action-state json-tree')");
    await evaluate("document.querySelector('.clear-btn').click()");
    await settle();
    const afterClear = await sample();
    assert.equal(afterClear.liveSnapshots, 1);
    await evaluate("ngrxUITest.navigate()");
    await settle();
    const afterNavigation = await sample();
    assert.equal(afterNavigation.liveSnapshots, 0);
    assert.deepEqual(browser.errors, []);
    await writeArtifact(
      "memory.json",
      JSON.stringify(
        {
          chrome: browser.version,
          burstMs,
          afterBurst,
          afterClear,
          afterNavigation,
        },
        null,
        2,
      ),
    );
  },
);

test(
  "array diffs show identity, real moves and changed fields in Chrome",
  { timeout: 60_000 },
  async (t) => {
    const { browser, sessionId, evaluate, waitFor } = await openMockPanel(t);
    await evaluate(`(() => {
    ngrxUITest.emit({ id: 1, type: 'Before', timestamp: 1,
      state: { users: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bob' }, { id: 3, name: 'Cal' }] } });
    ngrxUITest.emit({ id: 2, type: 'After', timestamp: 2,
      state: { users: [{ id: 3, name: 'Cal' }, { id: 1, name: 'Anna' }, { id: 4, name: 'Dan' }] } });
  })()`);
    await waitFor("document.querySelectorAll('.row').length === 2");
    await evaluate("document.querySelector('.latest-action').click()");
    await waitFor("!!document.querySelector('action-details-tabs')");
    await evaluate(
      "[...document.querySelectorAll('action-details-tabs button')].find(button => button.textContent.trim() === 'Diff').click()",
    );
    await waitFor("!!document.querySelector('.item-move')");
    assert.equal(
      await evaluate("document.querySelectorAll('.item-change--added').length"),
      1,
    );
    assert.equal(
      await evaluate(
        "document.querySelectorAll('.item-change--removed').length",
      ),
      1,
    );
    assert.equal(
      await evaluate("document.querySelectorAll('.item-move').length"),
      1,
    );
    await evaluate(
      "[...document.querySelectorAll('diff-tree .key')].find(key => key.textContent === '[id: 1]').closest('.node-header').click()",
    );
    await waitFor(
      "document.querySelector('.before')?.textContent === '\"Ada\"'",
    );
    assert.equal(
      await evaluate("document.querySelector('.after').textContent"),
      '"Anna"',
    );
    await browser.screenshot(sessionId, "array-diff.png");
    await evaluate(`(() => {
      ngrxUITest.emit({id: 3, type: 'Before mixed reorder', timestamp: 3,
        state: {users: [{id: 1}, {id: 2}, {id: 3}]}});
      ngrxUITest.emit({id: 4, type: 'After mixed reorder', timestamp: 4,
        state: {users: [{id: 4}, {id: 2}, {id: 1}]}});
    })()`);
    await evaluate("document.querySelector('.latest-action').click()");
    await waitFor(
      "document.querySelector('.selected-action-type').textContent === 'After mixed reorder'",
    );
    await waitFor(
      "document.querySelector('.item-move')?.textContent.includes('Moved [0] → [2]')",
    );
    assert.equal(
      await evaluate("document.querySelectorAll('.item-change--added').length"),
      1,
    );
    assert.equal(
      await evaluate(
        "document.querySelectorAll('.item-change--removed').length",
      ),
      1,
    );
    assert.equal(
      await evaluate("document.querySelectorAll('.item-move').length"),
      1,
    );
    assert.deepEqual(browser.errors, []);
  },
);

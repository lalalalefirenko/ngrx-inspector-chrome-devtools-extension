import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionFilter } from '../models/filter.model';
import { NgrxActionRecord } from '../models/ngrx-action-record.model';
import { ActionsStore } from './actions-store.service';
import { SettingsStoreService } from './settings-store.service';

describe('ActionsStore', () => {
  const filters = signal<ActionFilter[]>([]);
  let store: ActionsStore;

  const record = (id: number, type = 'Increment'): NgrxActionRecord => ({
    id,
    type,
    payload: { id },
    state: { count: id },
    timestamp: id,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    filters.set([]);
    TestBed.configureTestingModule({
      providers: [{ provide: SettingsStoreService, useValue: { filters } }],
    });
    store = TestBed.inject(ActionsStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps the selected record after it is evicted from the bounded history', () => {
    const selected = record(1);
    store.add(selected);
    store.select(selected.id);
    for (let id = 2; id <= 250; id++) store.add(record(id));

    expect(store.actions()).toHaveLength(200);
    expect(store.visibleActions()).toHaveLength(100);
    expect(store.actions()).not.toContain(selected);
    expect(store.selectedAction()).toBe(selected);
  });

  it('keeps the selected record when search hides it', () => {
    const selected = record(1, 'Selected action');
    store.add(selected);
    store.select(selected.id);
    store.searchValue.set('Unrelated');

    expect(store.visibleActions()).toEqual([]);
    expect(store.selectedAction()).toBe(selected);
  });

  it('keeps the selected record when prefix filtering hides it', () => {
    const selected = record(1, '[Users] Load');
    store.add(selected);
    store.select(selected.id);
    filters.set([{ id: 'users', pattern: '[Users]', enabled: true }]);

    expect(store.visibleActions()).toEqual([]);
    expect(store.selectedAction()).toBe(selected);
  });

  it('ignores selection of an unknown ID instead of losing the current selection', () => {
    const selected = record(1);
    store.add(selected);
    store.select(selected.id);
    store.select(999);

    expect(store.selectedAction()).toBe(selected);
  });

  it('replaces the selection when another action is clicked', () => {
    const first = record(1);
    const second = record(2);
    store.add(first);
    store.add(second);
    store.select(first.id);
    store.select(second.id);

    expect(store.selectedAction()).toBe(second);
    expect(store.selectedPreviousAction()).toBe(first);
  });

  it('captures the raw predecessor even when it is filtered out', () => {
    const previous = record(1, 'Hidden');
    const selected = record(2, 'Selected');
    store.add(previous);
    store.add(selected);
    filters.set([{ id: 'hidden', pattern: 'Hidden', enabled: true }]);
    store.select(selected.id);
    for (let id = 3; id <= 250; id++) store.add(record(id));

    expect(store.selectedPreviousAction()).toBe(previous);
    expect(store.selectedAction()).toBe(selected);
  });

  it('preserves the captured predecessor when reselecting the same action', () => {
    const previous = record(1);
    const selected = record(2);
    store.add(previous);
    store.add(selected);
    store.select(selected.id);
    for (let id = 3; id <= 201; id++) store.add(record(id));
    expect(store.actions()[0]).toBe(selected);
    store.select(selected.id);

    expect(store.selectedPreviousAction()).toBe(previous);
  });

  it('shows the retained row only while the selected action is outside the visible list', () => {
    const selected = record(1, 'Selected');
    store.add(selected);
    store.select(selected.id);
    expect(store.retainedSelectedAction()).toBeUndefined();
    for (let id = 2; id <= 101; id++) store.add(record(id));

    expect(store.actions()).toContain(selected);
    expect(store.retainedSelectedAction()).toBe(selected);
    store.searchValue.set('Selected');
    expect(store.retainedSelectedAction()).toBeUndefined();
  });

  it('does not replace a missing baseline with a later snapshot', () => {
    store.add(record(1));
    store.select(1);
    for (let id = 2; id <= 250; id++) store.add(record(id));

    expect(store.selectedPreviousAction()).toBeUndefined();
  });

  it.each(['clear', 'reset'] as const)(
    '%s releases a selection outside the history',
    (method) => {
      store.add(record(0));
      store.add(record(1));
      store.select(1);
      for (let id = 2; id <= 250; id++) store.add(record(id));
      store[method]();

      expect(store.selectedAction()).toBeUndefined();
      expect(store.selectedPreviousAction()).toBeUndefined();
      expect(store.retainedSelectedAction()).toBeUndefined();
      expect(store.latestVisibleAction()).toBeUndefined();
    },
  );

  it('bounds highlight bookkeeping and timers during a burst', () => {
    for (let id = 1; id <= 3000; id++) store.add(record(id));

    expect(store.newIds().size).toBe(200);
    expect(store.newIds().has(1)).toBe(false);
    expect(store.newIds().has(3000)).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(2300);
    expect(store.newIds().size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('expires highlights without shortening the lifetime of later events', () => {
    store.add(record(1));
    vi.advanceTimersByTime(1000);
    store.add(record(2));
    vi.advanceTimersByTime(1300);

    expect([...store.newIds()]).toEqual([2]);
    vi.advanceTimersByTime(1000);
    expect(store.newIds().size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('refreshes a repeated ID instead of expiring its newer highlight', () => {
    store.add(record(1));
    vi.advanceTimersByTime(1000);
    store.add(record(1));
    vi.advanceTimersByTime(1300);

    expect(store.newIds().has(1)).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(store.newIds().size).toBe(0);
  });

  it('coalesces nearby expirations without keeping a polling timer alive', () => {
    const schedule = vi.spyOn(globalThis, 'setTimeout');
    try {
      for (let id = 1; id <= 200; id++) {
        store.add(record(id));
        vi.advanceTimersByTime(1);
      }
      vi.advanceTimersByTime(2350);

      expect(store.newIds().size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(schedule.mock.calls.length).toBeLessThanOrEqual(6);
    } finally {
      schedule.mockRestore();
    }
  });

  it.each(['clear', 'reset', 'ngOnDestroy'] as const)(
    '%s cancels pending highlight work',
    (method) => {
      store.add(record(1));
      store[method]();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('keeps captured comparisons but prevents diffs across a capture gap', () => {
    const first = record(1);
    const second = record(2);
    store.add(first);
    store.add(second);
    store.select(2);
    store.markCaptureGap();
    expect(store.selectedPreviousAction()).toBe(first);
    const resumed = record(3);
    store.add(resumed);
    store.select(3);
    expect(store.selectedPreviousAction()).toBeUndefined();
    store.add(record(4));
    store.select(4);
    expect(store.selectedPreviousAction()).toBe(resumed);
    store.select(2);
    expect(store.selectedPreviousAction()).toBe(first);
    store.select(3);
    expect(store.selectedPreviousAction()).toBeUndefined();
  });

  it('does not turn a pre-pause snapshot preserved by Clear into a valid baseline', () => {
    store.add(record(1));
    store.markCaptureGap();
    store.clear();
    store.add(record(2));
    store.select(2);
    expect(store.selectedPreviousAction()).toBeUndefined();
  });
});

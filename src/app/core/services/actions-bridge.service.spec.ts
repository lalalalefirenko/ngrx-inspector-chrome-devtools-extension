import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionsBridgeService } from './actions-bridge.service';
import { ActionsStore } from './actions-store.service';
import { SettingsStoreService } from './settings-store.service';

function chromeEvent<Args extends unknown[]>() {
  const listeners = new Set<(...args: Args) => void>();
  return {
    addListener: vi.fn((listener: (...args: Args) => void) =>
      listeners.add(listener),
    ),
    removeListener: vi.fn((listener: (...args: Args) => void) =>
      listeners.delete(listener),
    ),
    emit: (...args: Args) =>
      [...listeners].forEach((listener) => listener(...args)),
    size: () => listeners.size,
  };
}

function createPort() {
  return {
    onMessage: chromeEvent<[unknown]>(),
    onDisconnect: chromeEvent<[]>(),
    postMessage: vi.fn(),
    disconnect: vi.fn(),
  };
}

describe('ActionsBridgeService', () => {
  const validAction = {
    id: 1,
    type: 'Increment',
    state: { count: 1 },
    payload: null,
    timestamp: 1,
  };
  let port: ReturnType<typeof createPort>;
  let navigated: ReturnType<typeof chromeEvent<[string]>>;
  let connect: ReturnType<typeof vi.fn>;
  let store: ActionsStore;

  beforeEach(() => {
    vi.useFakeTimers();
    port = createPort();
    connect = vi.fn(() => port);
    navigated = chromeEvent<[string]>();
    vi.stubGlobal('chrome', {
      runtime: { connect },
      devtools: {
        inspectedWindow: { tabId: 12 },
        network: { onNavigated: navigated },
      },
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsStoreService, useValue: { filters: signal([]) } },
      ],
    });
    store = TestBed.inject(ActionsStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('retries after INIT fails on an already created port', () => {
    const replacement = createPort();
    port.postMessage.mockImplementationOnce(() => {
      throw new Error('Disconnected');
    });
    connect.mockReturnValueOnce(port).mockReturnValue(replacement);
    TestBed.inject(ActionsBridgeService);

    vi.advanceTimersByTime(1000);

    expect(connect).toHaveBeenCalledTimes(2);
    expect(port.disconnect).toHaveBeenCalledOnce();
    expect(replacement.postMessage).toHaveBeenCalledWith({
      type: 'INIT',
      tabId: 12,
    });
    replacement.onMessage.emit({ type: 'NGRX_ACTION', payload: validAction });
    expect(store.actions()).toEqual([validAction]);
  });

  it('continues retrying after successive connection errors', () => {
    connect
      .mockImplementationOnce(() => {
        throw new Error('Unavailable');
      })
      .mockImplementationOnce(() => {
        throw new Error('Unavailable');
      });
    TestBed.inject(ActionsBridgeService);
    vi.advanceTimersByTime(2000);

    expect(connect).toHaveBeenCalledTimes(3);
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'INIT', tabId: 12 });
  });

  it('reconnects on disconnect and keeps one navigation listener', () => {
    TestBed.inject(ActionsBridgeService);
    port.onDisconnect.emit();
    vi.advanceTimersByTime(1000);

    expect(connect).toHaveBeenCalledTimes(2);
    expect(navigated.size()).toBe(1);
  });

  it('cancels pending reconnects and listeners when destroyed', () => {
    const bridge = TestBed.inject(ActionsBridgeService);
    port.onDisconnect.emit();
    bridge.ngOnDestroy();
    vi.advanceTimersByTime(5000);

    expect(connect).toHaveBeenCalledOnce();
    expect(navigated.size()).toBe(0);
    expect(port.onMessage.size()).toBe(0);
  });

  it('does not publish delayed mock actions after destruction outside DevTools', async () => {
    vi.stubGlobal('chrome', undefined);
    const bridge = TestBed.inject(ActionsBridgeService);
    expect(() => bridge.ngOnDestroy()).not.toThrow();
    await import('../mocks/actions.mock');
    vi.runAllTimers();

    expect(store.actions()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fully resets history, selection, search, pins and highlights on navigation', () => {
    TestBed.inject(ActionsBridgeService);
    port.onMessage.emit({ type: 'NGRX_ACTION', payload: validAction });
    store.select(validAction.id);
    store.searchValue.set('Increment');
    store.pinNode(['count']);
    navigated.emit('https://next-page.example');

    expect(store.actions()).toEqual([]);
    expect(store.selectedAction()).toBeUndefined();
    expect(store.pinnedPath()).toBeNull();
    expect(store.searchValue()).toBe('');
    expect(store.newIds().size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    const next = { ...validAction, state: { count: 0 } };
    port.onMessage.emit({ type: 'NGRX_ACTION', payload: next });
    expect(store.actions()).toEqual([next]);
  });

  it.each([
    null,
    {},
    { type: 'NGRX_ACTION', payload: null },
    { type: 'NGRX_ACTION', payload: {} },
    { type: 'OTHER', payload: validAction },
    { type: 'NGRX_ACTION', payload: { ...validAction, type: 123 } },
    { type: 'NGRX_ACTION', payload: { ...validAction, type: '  ' } },
    { type: 'NGRX_ACTION', payload: { ...validAction, id: NaN } },
    { type: 'NGRX_ACTION', payload: { ...validAction, timestamp: Infinity } },
    { type: 'NGRX_ACTION', payload: { ...validAction, isMeta: 'true' } },
    { type: 'NGRX_ACTION', payload: { ...validAction, isNew: 1 } },
    {
      type: 'NGRX_ACTION',
      payload: { id: 1, type: 'Missing state', timestamp: 1 },
    },
  ])('ignores malformed or unrelated message %j', (message) => {
    TestBed.inject(ActionsBridgeService);
    expect(() => port.onMessage.emit(message)).not.toThrow();
    expect(store.actions()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('accepts a valid action with null state and no payload', () => {
    TestBed.inject(ActionsBridgeService);
    const action = { id: 2, type: 'Reset', timestamp: 2, state: null };
    port.onMessage.emit({ type: 'NGRX_ACTION', payload: action });

    expect(store.actions()).toEqual([action]);
  });
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { ActionsStore } from './core/services/actions-store.service';
import { SettingsStoreService } from './core/services/settings-store.service';
import { ActionDetailsComponent } from './layout/components/action-details/action-details.component';

function chromeEvent<Args extends unknown[]>() {
  const listeners = new Set<(...args: Args) => void>();
  return {
    addListener: (listener: (...args: Args) => void) => listeners.add(listener),
    removeListener: (listener: (...args: Args) => void) =>
      listeners.delete(listener),
    emit: (...args: Args) =>
      [...listeners].forEach((listener) => listener(...args)),
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

describe('App connection recovery', () => {
  let fixture: ComponentFixture<App>;
  let port: ReturnType<typeof createPort>;
  let connect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    port = createPort();
    connect = vi.fn(() => port);
    vi.stubGlobal('chrome', {
      runtime: { connect },
      devtools: {
        inspectedWindow: { tabId: 12 },
        network: { onNavigated: chromeEvent<[string]>() },
      },
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsStoreService, useValue: { filters: signal([]) } },
      ],
    });
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('announces a transport interruption while preserving inspection and prevents a diff across the gap', () => {
    const store = TestBed.inject(ActionsStore);
    const status = () =>
      fixture.nativeElement.querySelector('.connection-status');
    expect(status().textContent.trim()).toBe('Waiting for NgRx');
    port.onMessage.emit({
      type: 'NGRX_ACTION',
      payload: {
        id: 1,
        type: 'Before disconnect',
        timestamp: 1,
        state: { count: 1 },
      },
    });
    store.select(1);
    fixture.detectChanges();
    expect(status().textContent.trim()).toBe('Connected');
    expect(status().getAttribute('role')).toBe('status');

    port.onDisconnect.emit();
    fixture.detectChanges();
    expect(status().textContent.trim()).toBe('Reconnecting…');
    expect(
      fixture.nativeElement.querySelector('.selected-action-type').textContent,
    ).toBe('Before disconnect');
    const replacement = createPort();
    connect.mockReturnValue(replacement);
    vi.advanceTimersByTime(1000);
    replacement.onMessage.emit({
      type: 'NGRX_ACTION',
      payload: {
        id: 2,
        type: 'After reconnect',
        timestamp: 2,
        state: { count: 10 },
      },
    });
    store.select(2);
    const details = fixture.debugElement.query(
      By.directive(ActionDetailsComponent),
    ).componentInstance as ActionDetailsComponent;
    details.currentTab.set('diff');
    fixture.detectChanges();

    expect(status().textContent.trim()).toBe('Connected');
    expect(store.actions()).toHaveLength(2);
    expect(
      fixture.nativeElement.querySelector('.selected-action-type').textContent,
    ).toBe('After reconnect');
    expect(
      fixture.nativeElement.querySelector('action-diff').textContent,
    ).toContain('previous state is unavailable');
    expect(fixture.nativeElement.querySelector('.before')).toBeNull();
  });
});

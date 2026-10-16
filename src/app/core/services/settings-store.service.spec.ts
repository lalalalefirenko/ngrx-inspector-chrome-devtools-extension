import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionFilter } from '../models/filter.model';
import { SettingsStoreService } from './settings-store.service';

describe('SettingsStoreService default filter migration', () => {
  let get: ReturnType<typeof vi.fn>;
  let set: ReturnType<typeof vi.fn>;
  const ngrx: ActionFilter = {
    id: 'default-ngrx',
    pattern: '@ngrx',
    enabled: true,
    readonly: true,
  };
  const custom: ActionFilter = {
    id: 'custom-router',
    pattern: '[Router]',
    enabled: true,
  };

  beforeEach(() => {
    get = vi.fn();
    set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', {
      runtime: {},
      devtools: {},
      storage: { local: { get, set } },
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  async function load(saved?: ActionFilter[]): Promise<SettingsStoreService> {
    get.mockResolvedValue({ actionFilters: saved });
    const store = TestBed.inject(SettingsStoreService);
    await get.mock.results[0].value;
    return store;
  }

  it('installs only the disabled @ngrx preset for new users', async () => {
    const store = await load();
    expect(store.filters()).toEqual([{ ...ngrx, enabled: false }]);
    expect(set).toHaveBeenCalledWith({ actionFilters: store.filters() });
  });

  it('removes all retired preset IDs while preserving custom prefixes and @ngrx settings', async () => {
    const retired = [
      'default-router',
      'default-screen-width',
      'default-websocket',
    ].map((id) => ({ id, pattern: 'Legacy', enabled: true, readonly: true }));
    const store = await load([ngrx, ...retired, custom]);
    expect(store.filters()).toEqual([ngrx, custom]);
    expect(set).toHaveBeenCalledWith({ actionFilters: [ngrx, custom] });
  });

  it('persists a migration even if removing a preset and adding @ngrx leaves the same count', async () => {
    const store = await load([
      {
        id: 'default-router',
        pattern: '[Router]',
        enabled: false,
        readonly: true,
      },
    ]);
    expect(store.filters()).toEqual([{ ...ngrx, enabled: false }]);
    expect(set).toHaveBeenCalledOnce();
  });

  it('does not rewrite saved settings when no migration is needed', async () => {
    const store = await load([ngrx, custom]);
    expect(store.filters()).toEqual([ngrx, custom]);
    expect(set).not.toHaveBeenCalled();
  });

  it('uses only @ngrx in the standalone mock UI', () => {
    vi.stubGlobal('chrome', undefined);
    const store = TestBed.inject(SettingsStoreService);
    expect(store.filters()).toEqual([{ ...ngrx, enabled: false }]);
    expect(get).not.toHaveBeenCalled();
  });
});

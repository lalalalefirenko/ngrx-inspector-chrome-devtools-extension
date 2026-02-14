import { Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { ActionFilter } from '../models/filter.model';
import { isDevToolsEnv } from '../utils/dev-mode.utils';
import { DEFAULT_FILTERS } from '../constants/settings.constants';

/**
 * Key for storing saved filters in Chrome DevTools.
 */
const STORAGE_KEY = 'actionFilters';

/**
 * Store service for managing NgRx action filtering.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStoreService {
  //region Fields

  /**
   * NgRx action filters.
   */
  filters: WritableSignal<ActionFilter[]> = signal<ActionFilter[]>([]);

  //endregion
  //region Constructor

  constructor() {
    if (isDevToolsEnv()) {
      this.load();
    } else {
      this._initMockMode();
    }
  }
  //endregion

  //region Public

  /**
   * Loads filters from storage.
   */
  async load(): Promise<void> {
    if (!isDevToolsEnv()) return;

    // @ts-ignore
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const saved: ActionFilter[] = data[STORAGE_KEY];

    if (!saved || saved.length === 0) {
      this.filters.set(DEFAULT_FILTERS);
      await this.save();
      return;
    }

    const merged: ActionFilter[] = this._mergeWithDefaults(saved);
    this.filters.set(merged);
  }

  /**
   * Saves filters to storage.
   */
  async save(): Promise<void> {
    if (!isDevToolsEnv()) return;
    // @ts-ignore
    await chrome.storage.local.set({ [STORAGE_KEY]: this.filters() });
  }

  /**
   * Adds a new filter.
   */
  add(pattern: string): void {
    this.filters.update((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        pattern,
        enabled: true,
      },
    ]);
    this.save();
  }

  /**
   * Toggles a filter on or off.
   */
  toggle(id: string): void {
    this.filters.update((list: ActionFilter[]): ActionFilter[] =>
      list.map(
        (f: ActionFilter): ActionFilter =>
          f.id === id ? { ...f, enabled: !f.enabled } : f,
      ),
    );

    this.save();
  }

  /**
   * Removes a filter.
   */
  remove(id: string): void {
    this.filters.update((list: ActionFilter[]): ActionFilter[] =>
      list.filter((f: ActionFilter): boolean =>
        Boolean(f.id !== id || f.readonly),
      ),
    );

    this.save();
  }

  //endregion

  //region Private

  /**
   * Initializes data for dev mode.
   */
  private _initMockMode(): void {
    // simply sets default filters into the signal
    this.filters.set(DEFAULT_FILTERS);
  }

  /**
   * Merges saved filters with default filters (new ones are added automatically).
   */
  private _mergeWithDefaults(saved: ActionFilter[]): ActionFilter[] {
    const map = new Map(saved.map((f: ActionFilter) => [f.id, f]));
    for (const def of DEFAULT_FILTERS) {
      if (!map.has(def.id)) {
        map.set(def.id, def);
      }
    }
    return Array.from(map.values());
  }

  //endregion
}

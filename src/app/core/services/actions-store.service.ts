import {
  computed,
  inject,
  Injectable,
  OnDestroy,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { NgrxActionRecord } from '../models/ngrx-action-record.model';
import { Nullable } from '../types/nullable.type';
import { SettingsStoreService } from './settings-store.service';
import { ActionFilter } from '../models/filter.model';
import { containsSearchWords, normalize } from '../utils/string.utils';
import { SelectedActionContext } from '../models/selected-action-context.model';

/**
 * Store service for managing NgRx action history.
 * Provides storage, highlighting of new actions, and virtualized list management.
 */
@Injectable({
  providedIn: 'root',
})
export class ActionsStore implements OnDestroy {
  //region Fields

  /**
   * Signal storing the list of NgRx actions.
   */
  private readonly _actionsSig: WritableSignal<NgrxActionRecord[]> = signal([]);

  /**
   * Service for managing NgRx action filtering.
   */
  private readonly _settingsStore: SettingsStoreService =
    inject(SettingsStoreService);

  /**
   * Records retained for inspection until selection changes or the session clears.
   */
  private readonly _selection: WritableSignal<
    SelectedActionContext | undefined
  > = signal(undefined);

  private readonly _captureStarts = new WeakSet<NgrxActionRecord>();

  private _captureInterrupted = false;

  /**
   * Path to the pinned node in the state.
   */
  private readonly _pinnedPath: WritableSignal<Nullable<string[]>> =
    signal(null);

  /**
   * Signal containing the set of IDs for new NgRx actions to highlight.
   * Using a signal ensures OnPush components react to changes.
   */
  private readonly _newIdsSig: WritableSignal<ReadonlySet<number>> = signal(
    new Set<number>(),
  );

  /** Deadlines retain IDs only, bounded by the records still in history. */
  private readonly _highlightExpiries = new Map<number, number>();

  private _highlightTimer: ReturnType<typeof setTimeout> | undefined;

  //endregion
  //region Constants

  /**
   * Maximum number of NgRx actions stored in history.
   */
  private readonly MAX_ACTIONS: number = 200;

  /**
   * Duration of new action highlight in milliseconds.
   */
  private readonly NEW_DURATION: number = 2300;

  /** Coalesce nearby expirations without polling while the list is idle. */
  private readonly HIGHLIGHT_BATCH_DELAY: number = 50;

  /**
   * Number of latest NgRx actions displayed in the virtual list.
   */
  private readonly VISIBLE_ACTIONS_LIMIT: number = 100;

  //endregion
  //region Public

  /**
   * Readonly signal containing all NgRx actions.
   */
  readonly actions: Signal<NgrxActionRecord[]> = this._actionsSig.asReadonly();

  /**
   * Path of the pinned node (for UI).
   */
  readonly pinnedPath: Signal<Nullable<string[]>> =
    this._pinnedPath.asReadonly();

  /**
   * Signal containing the set of IDs for new NgRx actions to highlight.
   */
  readonly newIds: Signal<ReadonlySet<number>> = this._newIdsSig.asReadonly();

  /**
   * Value of the search string.
   */
  readonly searchValue: WritableSignal<string> = signal('');

  /**
   * Signal containing information about the selected action.
   */
  readonly selectedAction: Signal<Nullable<NgrxActionRecord>> = computed(
    () => this._selection()?.action,
  );

  /**
   * The predecessor captured at selection time, even if history later evicts it.
   */
  readonly selectedPreviousAction: Signal<Nullable<NgrxActionRecord>> =
    computed(() => this._selection()?.previousAction);

  /**
   * Actions after applying filters.
   */
  readonly filteredActions: Signal<NgrxActionRecord[]> = computed(
    (): NgrxActionRecord[] => {
      const filters: ActionFilter[] = this._settingsStore
        .filters()
        .filter((f: ActionFilter): boolean => f.enabled);

      const searchValue: string = this.searchValue();

      if (!filters.length && searchValue === '') {
        return this._actionsSig();
      }

      return this._actionsSig().filter((action: NgrxActionRecord): boolean => {
        if (action.isMeta) {
          return true;
        }

        const matchesSearch: boolean =
          searchValue === '' || containsSearchWords(action.type, searchValue);

        const inFilters: boolean = filters.some((f: ActionFilter): boolean =>
          normalize(action.type).startsWith(normalize(f.pattern)),
        );

        return !inFilters && matchesSearch;
      });
    },
  );

  /**
   * Signal containing the latest actions for display in a virtual scroll.
   * Optimizes performance for a large number of NgRx actions.
   */
  public readonly visibleActions: Signal<NgrxActionRecord[]> = computed(
    (): NgrxActionRecord[] =>
      this.filteredActions()
        ?.filter((action: NgrxActionRecord): boolean => !action.isMeta)
        .slice(-this.VISIBLE_ACTIONS_LIMIT),
  );

  /** Selected record displayed separately when it is outside the current list. */
  readonly retainedSelectedAction: Signal<Nullable<NgrxActionRecord>> =
    computed(() => {
      const selected = this.selectedAction();
      return selected && !this.visibleActions().includes(selected)
        ? selected
        : undefined;
    });

  readonly latestVisibleAction: Signal<Nullable<NgrxActionRecord>> = computed(
    () => this.visibleActions().at(-1),
  );

  //endregion
  //region Public Methods

  /**
   * Adds a new action to the store.
   * Removes oldest actions if maximum limit is exceeded.
   * Automatically marks new actions for highlighting and sets a timer
   * to remove the highlight after the specified interval.
   *
   * @param action NgRx action record to add
   */
  add(action: NgrxActionRecord): void {
    if (this._captureInterrupted) {
      this._captureStarts.add(action);
      this._captureInterrupted = false;
    }
    const list = this._actionsSig();
    const evicted = list.length >= this.MAX_ACTIONS ? list[0] : undefined;
    const next = evicted ? list.slice(1) : list.slice();
    next.push(action);
    this._actionsSig.set(next);

    if (evicted && !next.some((record) => record.id === evicted.id)) {
      this._highlightExpiries.delete(evicted.id);
    }
    this._highlightExpiries.set(action.id, Date.now() + this.NEW_DURATION);
    this._newIdsSig.set(new Set(this._highlightExpiries.keys()));
    this._scheduleHighlightExpiry();
  }

  /**
   * Selects an action by its ID.
   *
   * @param id ID of the action to select
   */
  select(id: number): void {
    const actions = this._actionsSig();
    const index = actions.findIndex(
      (action) => action.id === id && !action.isMeta,
    );
    if (index < 0 || this.selectedAction() === actions[index]) return;

    this._selection.set({
      action: actions[index],
      previousAction:
        index > 0 && !this._captureStarts.has(actions[index])
          ? actions[index - 1]
          : undefined,
    });
  }

  /** The next action cannot be compared with a snapshot from before a pause. */
  markCaptureGap(): void {
    this._captureInterrupted = true;
  }

  /**
   * Clears visible history while preserving the last snapshot as a diff baseline.
   * Also clears selection, search, pins and highlight timers.
   */
  clear(): void {
    if (this._actionsSig().length > 0) {
      this._clearAllExceptLastAction();
    } else {
      this._actionsSig.set([]);
    }

    this._selection.set(undefined);
    this.searchValue.set('');
    this.unpinNode();
    this._newIdsSig.set(new Set());
    this._clearAllHighlightTimers();
  }

  /** Starts a new page session without retaining a previous state snapshot. */
  reset(): void {
    this._actionsSig.set([]);
    this.clear();
  }

  ngOnDestroy(): void {
    this._clearAllHighlightTimers();
  }

  /**
   * Pins a node from the state.
   *
   * @param path Path to the node in the state to pin.
   */
  pinNode(path: string[]): void {
    this._pinnedPath.set(['Store', ...path]);
  }

  /**
   * Unpins the currently pinned node.
   */
  unpinNode(): void {
    this._pinnedPath.set(null);
  }

  //endregion
  //region Private Methods

  /** One scheduler expires highlights without closing over snapshots. */
  private _scheduleHighlightExpiry(): void {
    if (this._highlightTimer !== undefined || !this._highlightExpiries.size)
      return;

    const nextExpiry = Math.min(...this._highlightExpiries.values());
    const delay = Math.max(nextExpiry - Date.now(), this.HIGHLIGHT_BATCH_DELAY);

    this._highlightTimer = setTimeout(() => {
      this._highlightTimer = undefined;
      const now = Date.now();
      let changed = false;
      for (const [id, expiry] of this._highlightExpiries) {
        if (expiry <= now) {
          this._highlightExpiries.delete(id);
          changed = true;
        }
      }
      if (changed) this._newIdsSig.set(new Set(this._highlightExpiries.keys()));
      this._scheduleHighlightExpiry();
    }, delay);
  }

  /**
   * Clears all active highlight timers.
   */
  private _clearAllHighlightTimers(): void {
    clearTimeout(this._highlightTimer);
    this._highlightTimer = undefined;
    this._highlightExpiries.clear();
  }

  /**
   * Clears all actions except the last one, marking it as a meta action.
   * Uses the raw actions list (not filtered) to always get the true last action.
   */
  private _clearAllExceptLastAction(): void {
    const actions: NgrxActionRecord[] = this._actionsSig();
    const lastAction: NgrxActionRecord = {
      ...actions[actions.length - 1],
      isMeta: true,
    };

    this._actionsSig.set([lastAction]);
  }

  //endregion
}

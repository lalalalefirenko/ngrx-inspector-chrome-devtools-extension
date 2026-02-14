import {
  computed,
  inject,
  Injectable,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { NgrxActionRecord } from '../models/ngrx-action-record.model';
import { Nullable } from '../types/nullable.type';
import { SettingsStoreService } from './settings-store.service';
import { ActionFilter } from '../models/filter.model';
import { StringUtils } from '../utils/string.utils';

/**
 * Interface for configuring timers that clear highlights for new NgRx actions.
 */
interface HighlightTimer {
  /** Timer identifier */
  id: ReturnType<typeof setTimeout>;
  /** ID of the action for which the timer is set */
  actionId: number;
}

/**
 * Store service for managing NgRx action history.
 * Provides storage, highlighting of new actions, and virtualized list management.
 */
@Injectable({
  providedIn: 'root',
})
export class ActionsStore {
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
   * Signal storing the ID of the selected action.
   */
  private readonly _selectedId: WritableSignal<Nullable<number>> = signal(null);

  /**
   * Path to the pinned node in the state.
   */
  private readonly _pinnedPath: WritableSignal<Nullable<string[]>> =
    signal(null);

  /**
   * Set of IDs for new NgRx actions to highlight.
   */
  private readonly _newIds: Set<number> = new Set();

  /**
   * Array of active timers for clearing highlights of new NgRx actions.
   */
  private readonly _highlightTimers: HighlightTimer[] = [];

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
   * Set of IDs for new NgRx actions to highlight.
   */
  readonly newIds: Set<number> = this._newIds;

  /**
   * Value of the search string.
   */
  readonly searchValue: WritableSignal<string> = signal('');

  /**
   * Signal containing information about the selected action.
   */
  readonly selectedAction: Signal<Nullable<NgrxActionRecord>> = computed(
    (): Nullable<NgrxActionRecord> =>
      this.filteredActions().find(
        (action: NgrxActionRecord): boolean => action.id === this._selectedId(),
      ),
  );

  /**
   * Signal containing the index of the selected action in the list.
   */
  readonly selectedActionIndex: Signal<number> = computed((): number =>
    this.filteredActions().findIndex(
      (action: NgrxActionRecord): boolean => action.id === this._selectedId(),
    ),
  );

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
          searchValue === '' ||
          StringUtils.containsSearchWords(action.type, searchValue);

        const inFilters: boolean = filters.some((f: ActionFilter): boolean =>
          StringUtils.normalize(action.type).startsWith(
            StringUtils.normalize(f.pattern),
          ),
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
    this._actionsSig.update((list: NgrxActionRecord[]): NgrxActionRecord[] => {
      const newList: NgrxActionRecord[] = [...list, action];

      if (newList.length > this.MAX_ACTIONS) {
        newList.splice(0, newList.length - this.MAX_ACTIONS);
      }

      return newList;
    });

    // Mark the new action for highlighting
    this._newIds.add(action.id);

    // Set a timer to remove the highlight
    const timerId: ReturnType<typeof setTimeout> = setTimeout((): void => {
      this._newIds.delete(action.id);
      this._removeHighlightTimer(action.id);
    }, this.NEW_DURATION);

    // Store the timer for possible cleanup
    this._highlightTimers.push({
      id: timerId,
      actionId: action.id,
    });
  }

  /**
   * Selects an action by its ID.
   *
   * @param id ID of the action to select
   */
  select(id: number): void {
    this._selectedId.set(id);
  }

  /**
   * Clears the entire store: removes all actions, clears selection,
   * clears the set of new IDs, and cancels all active highlight timers.
   */
  clear(): void {
    if (this._actionsSig().length > 0) {
      this._clearAllExceptLastAction();
    } else {
      this._actionsSig.set([]);
    }

    this._selectedId.set(null);
    this.searchValue.set('');
    this.unpinNode();
    this._newIds.clear();
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

  /**
   * Removes the highlight timer for a given action.
   *
   * @param actionId ID of the action whose timer should be removed
   *
   * @private
   */
  private _removeHighlightTimer(actionId: number): void {
    const timerIndex: number = this._highlightTimers.findIndex(
      (timer: HighlightTimer): boolean => timer.actionId === actionId,
    );

    if (timerIndex !== -1) {
      const [removedTimer]: HighlightTimer[] = this._highlightTimers.splice(
        timerIndex,
        1,
      );
      clearTimeout(removedTimer.id);
    }
  }

  /**
   * Clears all active highlight timers.
   */
  private _clearAllHighlightTimers(): void {
    this._highlightTimers.forEach((timer: HighlightTimer): void => {
      clearTimeout(timer.id);
    });

    this._highlightTimers.length = 0; // Clear array
  }

  private _clearAllExceptLastAction(): void {
    const actions: NgrxActionRecord[] = this.filteredActions();
    const lastAction: NgrxActionRecord = {
      ...actions[actions.length - 1],
      isMeta: true,
    };

    this._actionsSig.set([lastAction]);
  }

  //endregion
}

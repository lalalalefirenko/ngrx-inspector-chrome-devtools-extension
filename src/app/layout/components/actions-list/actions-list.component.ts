import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  OutputEmitterRef,
  Signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';

import { ActionsStore } from '../../../core/services/actions-store.service';
import { NgrxActionRecord } from '../../../core/models/ngrx-action-record.model';
import { Nullable } from '../../../core/types/nullable.type';

type ActionListRow = Readonly<Pick<NgrxActionRecord, 'id' | 'type'>>;

/**
 * Component displaying the list of NgRx actions (with virtualization).
 * Shows the latest actions from {@link ActionsStore} and allows selecting an action on click.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'actions-list',
  standalone: true,
  templateUrl: 'actions-list.component.html',
  styleUrl: 'actions-list.component.scss',
  imports: [CommonModule, ScrollingModule],
})
export class ActionsListComponent {
  //region DI

  private readonly _store: ActionsStore = inject(ActionsStore);

  //endregion
  //region Outputs

  /**
   * Event emitted when an action is clicked.
   */
  readonly actionClicked: OutputEmitterRef<void> = output();

  //endregion
  //region Fields

  /** CDK caches view contexts, so they must not reference full state snapshots. */
  private readonly _rows = new WeakMap<NgrxActionRecord, ActionListRow>();

  protected readonly visibleRows = computed(() =>
    this._store.visibleActions().map(action => this._rowFor(action)),
  );

  /**
   * The currently selected action.
   */
  protected readonly selectedRow: Signal<Nullable<ActionListRow>> = computed(() => {
    const action = this._store.selectedAction();
    return action ? this._rowFor(action) : undefined;
  });

  /**
   * Signal with the set of IDs of new (highlighted) actions.
   */
  protected readonly newIds: Signal<ReadonlySet<number>> = this._store.newIds;

  protected readonly retainedSelectedAction = this._store.retainedSelectedAction;

  protected readonly latestVisibleAction = this._store.latestVisibleAction;

  private readonly _viewport = viewChild(CdkVirtualScrollViewport);

  //endregion
  //region Events

  /**
   * Handles clicking on an action.
   *
   * @param action NgRx action that was clicked.
   */
  actionClickHandler(action: ActionListRow): void {
    this._store.select(action.id);
    this.actionClicked.emit();
  }

  selectLatestAction(): void {
    const latest = this.latestVisibleAction();
    if (!latest) return;

    this._store.select(latest.id);
    this._viewport()?.scrollToIndex(this.visibleRows().length - 1);
    this.actionClicked.emit();
  }

  //endregion
  //region Public

  /**
   * TrackBy function for the virtual list (optimizes re-rendering).
   *
   * @param index Index of the element in the list.
   * @param action NgRx action.
   * @returns The unique identifier of the action.
   */
  trackById(index: number, action: ActionListRow): number {
    return action.id;
  }

  private _rowFor(action: NgrxActionRecord): ActionListRow {
    let row = this._rows.get(action);
    if (!row) {
      row = { id: action.id, type: action.type };
      this._rows.set(action, row);
    }
    return row;
  }

  //endregion
}

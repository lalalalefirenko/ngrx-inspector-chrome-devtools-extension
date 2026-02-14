import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { ActionsStore } from '../../../core/services/actions-store.service';
import { NgrxActionRecord } from '../../../core/models/ngrx-action-record.model';

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

  /**
   * NgRx actions store.
   */
  readonly store: ActionsStore = inject(ActionsStore);

  //endregion
  //region Outputs

  /**
   * Event emitted when an action is clicked.
   */
  readonly actionClicked: OutputEmitterRef<void> = output();

  //endregion
  //region Events

  /**
   * Handles clicking on an action.
   *
   * @param action NgRx action that was clicked.
   */
  actionClickHandler(action: NgrxActionRecord): void {
    this.store.select(action.id);
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
  trackById(index: number, action: NgrxActionRecord): number {
    return action.id;
  }

  //endregion
}

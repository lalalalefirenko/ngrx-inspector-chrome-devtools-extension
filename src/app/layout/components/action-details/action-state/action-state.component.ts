import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { NgrxActionRecord } from '../../../../core/models/ngrx-action-record.model';
import {
  buildJsonTree,
  buildPinnedJsonTree,
} from '../../../../core/utils/json-tree.utils';
import { JsonTreeComponent } from '../../json-tab/json-tree.component';
import { JsonTreeNode } from '../../../../core/models/json-tree-node.model';
import { Nullable } from '../../../../core/types/nullable.type';
import { PinnedActionPathComponent } from '../pinned-action-path/pinned-action-path.component';

/**
 * Component for displaying the state of the current NgRx action.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'action-state',
  standalone: true,
  imports: [JsonTreeComponent, PinnedActionPathComponent],
  templateUrl: 'action-state.component.html',
  styleUrl: 'action-state.component.scss',
})
export class ActionStateComponent {
  //region Inputs

  /**
   * The current NgRx action whose state should be displayed.
   */
  readonly action: InputSignal<NgrxActionRecord> = input.required();

  /**
   * Path to the pinned node in the state.
   */
  readonly pinnedPath: InputSignal<Nullable<string[]>> = input.required();

  //endregion
  //region Outputs

  /**
   * Event requesting to pin a state node.
   */
  readonly pinNode: OutputEmitterRef<string[]> = output();

  /**
   * Event requesting to unpin a state node.
   */
  readonly unpinNode: OutputEmitterRef<void> = output();

  /**
   * Event requesting to select a new path.
   */
  readonly setNewPath: OutputEmitterRef<Nullable<string[]>> = output();

  //endregion
  //region Fields

  /**
   * Tree to display, or null when the pinned path is absent in this snapshot.
   */
  readonly jsonTreeFromAction: Signal<Nullable<JsonTreeNode>> = computed(
    (): Nullable<JsonTreeNode> => {
      const path = this.pinnedPath();
      const state = this.action().state;
      return path?.length
        ? buildPinnedJsonTree(state, path.slice(1))
        : buildJsonTree(state);
    },
  );

  //endregion
}

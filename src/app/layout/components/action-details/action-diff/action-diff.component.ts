import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { NgrxActionRecord } from '../../../../core/models/ngrx-action-record.model';
import { StateTreeDiffNode } from '../../../../core/models/tree-diff-node.model';
import { ActionsStore } from '../../../../core/services/actions-store.service';
import {
  computeStateTreeDiff,
  groupTreeDiffByFeature,
} from '../../../../core/utils/tree-diff.utils';
import { DiffTreeComponent } from '../../diff-tree/diff-tree.component';
import { Nullable } from '../../../../core/types/nullable.type';

/**
 * Component for displaying the diff between the previous and current state
 * of a selected NgRx action.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'action-diff',
  standalone: true,
  imports: [DiffTreeComponent],
  templateUrl: 'action-diff.component.html',
  styleUrl: 'action-diff.component.scss',
})
export class ActionDiffComponent {
  //region Inputs

  /**
   * The current NgRx action whose state diff should be displayed.
   */
  readonly action: InputSignal<NgrxActionRecord> = input.required();

  //endregion
  //region DI

  /**
   * NgRx actions store.
   */
  private readonly _store: ActionsStore = inject(ActionsStore);

  //endregion
  //region Fields

  /**
   * List of diff nodes grouped by feature (top-level state keys).
   * Returns an empty array if there is no previous state or states are identical.
   */
  readonly features: Signal<StateTreeDiffNode[]> = computed(
    (): StateTreeDiffNode[] => {
      const currentAction: NgrxActionRecord = this.action();

      const actions: NgrxActionRecord[] = this._store.filteredActions();
      const index: number = this._store.selectedActionIndex();

      if (index <= 0) return [];

      const prevState: unknown = actions[index - 1]?.state;
      const currState: unknown = currentAction.state;

      if (prevState === null || prevState === undefined) return [];
      if (currState === null || currState === undefined) return [];

      if (prevState === currState) return [];

      const root: Nullable<StateTreeDiffNode> = computeStateTreeDiff(
        prevState,
        currState,
        'root',
      );

      if (!root) return [];

      return groupTreeDiffByFeature(root);
    },
  );

  //endregion
}

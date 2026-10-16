import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { NgrxActionRecord } from '../../../../core/models/ngrx-action-record.model';
import { StateTreeDiffNode } from '../../../../core/models/tree-diff-node.model';
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
  /** Previous record captured together with the selected action. */
  readonly previousAction: InputSignal<Nullable<NgrxActionRecord>> = input.required();

  //region Fields

  readonly hasPreviousState: Signal<boolean> = computed(() => !!this.previousAction());

  /**
   * List of diff nodes grouped by feature (top-level state keys).
   * Uses the captured predecessor so incoming events cannot change the comparison.
   */
  readonly features: Signal<StateTreeDiffNode[]> = computed(
    (): StateTreeDiffNode[] => {
      const currentAction: NgrxActionRecord = this.action();

      const previousAction = this.previousAction();
      if (!previousAction) return [];

      const prevState: unknown = previousAction.state;
      const currState: unknown = currentAction.state;

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

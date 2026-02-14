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
import { buildJsonTree } from '../../../../core/utils/json-tree.utils';
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

  /**
   * The full JSON tree built from the entire state.
   */
  readonly fullTree: Signal<JsonTreeNode> = computed(
    (): JsonTreeNode => buildJsonTree(this.action()?.state),
  );

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
   * Returns the JsonTreeNode for the pinned path.
   */
  private readonly pinnedNode: Signal<Nullable<JsonTreeNode>> = computed(
    (): Nullable<JsonTreeNode> => {
      const path = this.pinnedPath();
      const root = this.fullTree();

      if (!path?.length) return null;

      const pathExceptRoot: string[] = path.slice(1);

      let current: Nullable<JsonTreeNode> = root;

      for (const segment of pathExceptRoot) {
        current = current?.children?.find(
          (c: JsonTreeNode): boolean => String(c.key) === String(segment),
        );

        if (!current) return null;
      }

      /**
       * IMPORTANT:
       * We do NOT rebuild the node.
       * We just make a shallow copy and turn it into root.
       */
      return {
        ...current,
        isRoot: true,
        isPinned: true,
        isPinnable: false,
      };
    },
  );

  /**
   * State of the current NgRx action transformed into a JSON tree.
   */
  readonly jsonTreeFromAction: Signal<JsonTreeNode> = computed(
    (): JsonTreeNode => this.pinnedNode() ?? this.fullTree(),
  );

  //endregion
}

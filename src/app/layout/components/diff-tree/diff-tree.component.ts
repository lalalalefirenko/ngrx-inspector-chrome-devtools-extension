import {
  Component,
  input,
  InputSignal,
  signal,
  WritableSignal,
  ChangeDetectionStrategy,
  Signal,
  computed,
  EffectRef,
  effect,
} from '@angular/core';
import { StateTreeDiffNode } from '../../../core/models/tree-diff-node.model';
import { previewNodeValue } from '../../../core/utils/tree.utils';

/**
 * Component for displaying the state difference tree of the application before and after an action is dispatched.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'diff-tree',
  standalone: true,
  templateUrl: 'diff-tree.component.html',
  styleUrl: 'diff-tree.component.scss',
})
export class DiffTreeComponent {
  //region Inputs

  /**
   * The current tree node.
   */
  readonly node: InputSignal<StateTreeDiffNode> = input.required();

  //endregion
  //region Fields

  /**
   * Whether the current node is collapsed.
   */
  collapsed: WritableSignal<boolean> = signal(false);

  /**
   * Preview of the collapsed value of the current tree node.
   */
  readonly previewNodeValue: Signal<string> = computed((): string =>
    previewNodeValue(this.node()),
  );

  /**
   * Formatted "before" value of the current node (if it has no children).
   */
  readonly formattedNodeBeforeValue: Signal<string> = computed((): string =>
    this._format(this.node().before),
  );

  /**
   * Formatted "after" value of the current node (if it has no children).
   */
  readonly formattedNodeAfterValue: Signal<string> = computed((): string =>
    this._format(this.node().after),
  );

  //endregion
  //region Effects

  /**
   * Automatically expand the node if it is the root.
   */
  readonly showRootEffect: EffectRef = effect((): void => {
    this.collapsed.set(!this.node().isRoot);
  });

  //endregion
  //region Public

  /**
   * Toggle the collapsed state of the node.
   */
  toggle(): void {
    if (!this.node().isRoot && this.node()?.children?.length) {
      this.collapsed.update((v: boolean): boolean => !v);
    }
  }

  //endregion
  //region Private

  /**
   * Formats the value of the current node (if it has no child nodes).
   *
   * @param value The value to format.
   * @returns Formatted string representation of the value.
   */
  private _format(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '[]';
      } else {
        return `[${this._format(value[0])},...]`;
      }
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);

      if (!entries.length) return '{}';

      const [firstKey, firstVal] = entries[0];

      const first = `${firstKey}: ${this._format(firstVal)}`;

      return `{${first}${entries.length > 1 ? ',...' : ''}}`;
    }

    return String(value);
  }

  //endregion
}

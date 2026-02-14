import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  EffectRef,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { JsonTreeNode } from '../../../core/models/json-tree-node.model';
import { previewNodeValue } from '../../../core/utils/tree.utils';

/**
 * Component for displaying data as a JSON tree with expandable/collapsible nodes.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'json-tree',
  standalone: true,
  templateUrl: 'json-tree.component.html',
  styleUrl: 'json-tree.component.scss',
})
export class JsonTreeComponent {
  //region Inputs

  /**
   * The current tree node.
   */
  readonly node: InputSignal<JsonTreeNode> = input.required();

  /**
   * Whether pinning functionality is enabled for nodes.
   */
  readonly isPinningEnabled: InputSignal<boolean> = input(false);

  //endregion
  //region Outputs

  /**
   * Event emitted to pin a node in the state tree.
   */
  readonly pinNode: OutputEmitterRef<string[]> = output();

  /**
   * Event emitted to unpin a node in the state tree.
   */
  readonly unpinNode: OutputEmitterRef<void> = output();

  //endregion
  //region Fields

  /**
   * Whether the current node is collapsed.
   */
  readonly collapsed: WritableSignal<boolean> = signal(false);

  /**
   * Preview of the collapsed value of the current tree node.
   */
  readonly previewNodeValue: Signal<string> = computed((): string =>
    previewNodeValue(this.node()),
  );

  /**
   * Formatted value of the current tree node (if it has no child nodes).
   */
  readonly formattedNodeValue: Signal<string> = computed((): string =>
    this._format(this.node().value),
  );

  //endregion
  //region Effects

  /**
   * Automatically expands the node if it is the root.
   */
  readonly showRootEffect: EffectRef = effect((): void => {
    this.collapsed.set(!this.node().isRoot);
  });

  //endregion
  //region Events

  /**
   * Emits an event to pin the node and stops event propagation.
   */
  pinNodeHandler(event: MouseEvent): void {
    event.stopPropagation();
    this.pinNode.emit(this.node().path);
  }

  /**
   * Emits an event to unpin the node and stops event propagation.
   */
  unpinNodeHandler(event: MouseEvent): void {
    event.stopPropagation();
    this.unpinNode.emit();
  }

  //endregion
  //region Public

  /**
   * Toggles the collapsed/expanded state of the current node.
   */
  toggle(): void {
    if (this.node()?.children?.length) {
      this.collapsed.update((v: boolean): boolean => !v);
    }
  }

  //endregion
  //region Private

  /**
   * Formats the value of the current tree node (if it has no child nodes).
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

    return '';
  }

  //endregion
}

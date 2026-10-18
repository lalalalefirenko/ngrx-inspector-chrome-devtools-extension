import { TreeNode } from './tree-node.model';

/**
 * Type of changes in a node after an action occurs.
 */
export type DiffKind = 'changed' | 'added' | 'removed' | 'unchanged';

/**
 * Data model for a tree node representing the difference between previous and current state.
 */
export interface StateTreeDiffNode extends TreeNode<StateTreeDiffNode> {
  /**
   * Type of changes in the node after an action occurs.
   */
  kind: DiffKind;

  /**
   * State before the action occurred.
   */
  before?: unknown;

  /**
   * State after the action occurred.
   */
  after?: unknown;

  /** Stable array identity and positions; moved excludes ordinary insert/delete shifts. */
  arrayItem?: {
    id: string | number;
    previousIndex?: number;
    currentIndex?: number;
    moved?: boolean;
  };
}

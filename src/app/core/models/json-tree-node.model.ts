import { TreeNode } from './tree-node.model';

/**
 * Data model for a tree node representing a JSON object.
 */
export interface JsonTreeNode extends TreeNode<JsonTreeNode> {
  /**
   * Value of the node.
   */
  value: unknown;

  /** Immediate children only; their nodes have not been built yet. */
  childCount: number;

  /**
   * Can the node be pinned?
   */
  isPinnable: boolean;

  /**
   * Is the node pinned?
   */
  isPinned?: boolean;

  /**
   * Path to the node in the state.
   */
  path: string[];
}

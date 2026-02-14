import { TreeNode } from './tree-node.model';

/**
 * Data model for a tree node representing a JSON object.
 */
export interface JsonTreeNode extends TreeNode<JsonTreeNode> {
  /**
   * Value of the node.
   */
  value?: unknown;

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

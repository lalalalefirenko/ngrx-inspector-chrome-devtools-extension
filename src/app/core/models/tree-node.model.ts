/**
 * Base element of a tree node.
 */
export interface TreeNode<T> {
  /**
   * Node key.
   */
  key: string;

  /**
   * Child nodes.
   */
  children?: T[];

  /**
   * Is this the root node?
   */
  isRoot?: boolean;
}

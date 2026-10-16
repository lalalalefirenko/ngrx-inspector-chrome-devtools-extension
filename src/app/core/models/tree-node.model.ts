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

  /** Container type, including containers with no children. */
  containerType?: 'array' | 'object';

  /**
   * Is this the root node?
   */
  isRoot?: boolean;
}

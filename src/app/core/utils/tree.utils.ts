import { TreeNode } from '../models/tree-node.model';

/**
 * Generates a preview string for the value of the current tree node (if the node has children).
 *
 * @param node The node to generate a preview for.
 * @returns A string representing the preview of the node's value.
 */
export const previewNodeValue = <T extends TreeNode<T>>(node: T): string => {
  if (!node.children?.length) {
    if (node.containerType === 'array') return '[]';
    if (node.containerType === 'object') return '{}';
    return '';
  }

  const isArrayNode: boolean = node.containerType === 'array' || (
    node.containerType === undefined && node.children.every(c => c.key.startsWith('['))
  );

  // ARRAY (keys like [0], [1])
  if (isArrayNode) {
    const shown: number = Math.min(node.children.length, 5);
    const items: unknown[] = Array(shown).fill('{…}');

    return `[${items.join(', ')}${node.children.length > 5 ? ', ...' : ''}]`;
  }

  // OBJECT
  return '{...}';
};

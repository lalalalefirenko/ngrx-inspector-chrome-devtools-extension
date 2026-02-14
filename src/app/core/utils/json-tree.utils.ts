import { JsonTreeNode } from '../models/json-tree-node.model';

/**
 * Builds a tree from values for displaying in JSON format.
 *
 * @param value The value to parse for JSON representation.
 * @param key The key of the node.
 * @param isRoot Is the current node the root?
 * @param parentPath The path to the parent of the current node.
 * @param isForPinnableNode Is the tree being built for a pinnable node?
 *
 * @return Node obtained by transforming @value.
 */
export function buildJsonTree(
  value: unknown,
  key: string = 'value',
  isRoot: boolean = true,
  parentPath: string[] = [],
  isForPinnableNode: boolean = false,
): JsonTreeNode {
  const path: string[] = isRoot ? [] : [...parentPath, normalizeKey(key)];

  if (value === null || value === undefined) {
    return { key, value, isRoot, isPinnable: true, path };
  }

  if (typeof value !== 'object') {
    return { key, value, isRoot, isPinnable: true, path };
  }

  if (Array.isArray(value)) {
    return {
      key,
      path,
      children: value.map((v, i) =>
        buildJsonTree(v, i.toString(), false, path),
      ),
      isRoot,
      isPinnable: true,
    };
  }

  const children: JsonTreeNode[] = Object.entries(value).map(([k, v]) =>
    buildJsonTree(v, k, false, path),
  );

  if (isRoot && !isForPinnableNode) {
    return {
      isRoot,
      key: '',
      children,
      path: [],
      isPinnable: false,
    };
  }

  return {
    isRoot,
    key,
    children,
    isPinnable: !isForPinnableNode,
    path,
    isPinned: isForPinnableNode,
  };
}

/**
 * Normalizes a key for path.
 *
 * "[3]" -> "3"
 *
 * @param key The key to normalize.
 * @returns The normalized key.
 */
function normalizeKey(key: string): string {
  if (key.startsWith('[') && key.endsWith(']')) {
    return key.slice(1, -1);
  }

  return key;
}

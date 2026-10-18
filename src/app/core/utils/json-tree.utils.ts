import { JsonTreeNode } from '../models/json-tree-node.model';

/** Describes one value without recursively visiting its descendants. */
export function buildJsonTree(
  value: unknown,
  key: string = 'value',
  isRoot: boolean = true,
  parentPath: string[] = [],
): JsonTreeNode {
  const containerType =
    value !== null && typeof value === 'object'
      ? Array.isArray(value)
        ? 'array'
        : 'object'
      : undefined;

  return {
    key: isRoot && containerType === 'object' ? '' : key,
    value,
    containerType,
    childCount:
      containerType === 'array'
        ? (value as unknown[]).length
        : containerType === 'object'
          ? Object.keys(value as object).length
          : 0,
    path: isRoot ? [] : [...parentPath, key],
    isRoot,
    isPinnable: !(isRoot && containerType === 'object'),
  };
}

/** Materializes a single expanded level; nested containers stay shallow. */
export function buildJsonTreeChildren(node: JsonTreeNode): JsonTreeNode[] {
  if (node.containerType === 'array') {
    return Array.from(node.value as unknown[], (value, index) =>
      buildJsonTree(value, String(index), false, node.path),
    );
  }
  if (node.containerType === 'object') {
    return Object.entries(node.value as Record<string, unknown>).map(
      ([key, value]) => buildJsonTree(value, key, false, node.path),
    );
  }
  return [];
}

/** Resolves only the pinned path, distinguishing absent properties from undefined. */
export function buildPinnedJsonTree(
  state: unknown,
  path: string[],
): JsonTreeNode | null {
  let value = state;
  for (const key of path) {
    if (
      value === null ||
      typeof value !== 'object' ||
      !Object.hasOwn(value, key)
    ) {
      return null;
    }
    value = (value as Record<string, unknown>)[key];
  }

  const node = path.length
    ? buildJsonTree(value, path.at(-1)!, false, path.slice(0, -1))
    : buildJsonTree(value);
  return { ...node, isRoot: true, isPinned: true, isPinnable: false };
}

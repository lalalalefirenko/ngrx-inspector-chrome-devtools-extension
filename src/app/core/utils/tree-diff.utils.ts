import { StateTreeDiffNode } from '../models/tree-diff-node.model';

/**
 * Groups a diff tree by features (first-level nodes).
 * Returns only the features that actually changed.
 *
 * @param root The root of the state diff tree.
 * @returns Array of top-level changed features.
 */
export function groupTreeDiffByFeature(
  root: StateTreeDiffNode,
): StateTreeDiffNode[] {
  if (!root.children?.length) return [];

  return root.children
    .filter(
      (child) =>
        child.kind === 'added' ||
        child.kind === 'removed' ||
        child.kind === 'changed',
    )
    .map((featureNode) => ({
      ...featureNode,
      isRoot: true,
    }));
}

/**
 * Computes a diff between previous and current state.
 *
 * @param prev Previous state.
 * @param curr Current state.
 * @param key Key for the current node.
 * @returns A {@link StateTreeDiffNode} representing the differences, or null if no change.
 */
export function computeStateTreeDiff(
  prev: unknown,
  curr: unknown,
  key: string,
): StateTreeDiffNode | null {
  if (prev === curr) return null;

  if (isNullOrUndefined(prev) && !isNullOrUndefined(curr))
    return { key, kind: 'added', after: curr };
  if (!isNullOrUndefined(prev) && isNullOrUndefined(curr))
    return { key, kind: 'removed', before: prev };

  if (Array.isArray(prev) && Array.isArray(curr))
    return diffArrays(prev, curr, key);

  if (!isObject(prev) || !isObject(curr))
    return { key, kind: 'changed', before: prev, after: curr };

  const prevObj = prev as Record<string, unknown>;
  const currObj = curr as Record<string, unknown>;

  const keys = new Set([...Object.keys(prevObj), ...Object.keys(currObj)]);
  const children: StateTreeDiffNode[] = [];

  keys.forEach((childKey) => {
    const prevVal = prevObj[childKey];
    const currVal = currObj[childKey];

    // Skip if both undefined
    if (prevVal === undefined && currVal === undefined) return;

    const child = computeStateTreeDiff(prevVal, currVal, childKey);
    if (child) children.push(child);
  });

  if (!children.length) return null;

  // Only children; no before/after on the parent
  return { key, kind: 'changed', children };
}

/**
 * Computes a diff between two arrays.
 *
 * @param prev Previous array.
 * @param curr Current array.
 * @param key Key for the current node.
 * @returns A {@link StateTreeDiffNode} representing the differences, or null if no change.
 */
function diffArrays(
  prev: unknown[],
  curr: unknown[],
  key: string,
): StateTreeDiffNode | null {
  const children: StateTreeDiffNode[] = [];
  const max = Math.max(prev.length, curr.length);

  for (let i = 0; i < max; i++) {
    const before = prev[i];
    const after = curr[i];

    // Skip empty slots in both arrays
    if (before === undefined && after === undefined) continue;

    if (i >= prev.length) {
      children.push({ key: `[${i}]`, kind: 'added', after });
      continue;
    }

    if (i >= curr.length) {
      children.push({ key: `[${i}]`, kind: 'removed', before });
      continue;
    }

    const child = computeStateTreeDiff(before, after, `[${i}]`);
    if (child) children.push(child);
  }

  if (!children.length) return null;

  return { key, kind: 'changed', children };
}

/**
 * Checks if a value is an object (excluding arrays).
 *
 * @param value Value to check.
 * @returns True if value is an object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks if a value is null or undefined.
 *
 * @param value Value to check.
 * @returns True if value is null or undefined.
 */
function isNullOrUndefined(value: unknown): boolean {
  return value === null || value === undefined;
}

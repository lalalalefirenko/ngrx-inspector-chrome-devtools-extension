import { StateTreeDiffNode } from '../models/tree-diff-node.model';

type Id = string | number;
type Item = { index: number; value: Record<string, unknown> };
type Compare = (
  prev: unknown,
  curr: unknown,
  key: string,
) => StateTreeDiffNode | null;

function indexById(values: unknown[]): Map<Id, Item> | null {
  const items = new Map<Id, Item>();
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !Object.hasOwn(value, 'id')
    )
      return null;
    const id = (value as Record<string, unknown>)['id'];
    if (
      !(typeof id === 'string' && id.length > 0) &&
      !(typeof id === 'number' && Number.isFinite(id))
    )
      return null;
    if (items.has(id as Id)) return null;
    items.set(id as Id, { index, value: value as Record<string, unknown> });
  }
  return items;
}

/** Previous indices of a maximal stable subsequence, in O(n log n). */
function longestIncreasingSubsequence(indices: number[]): Set<number> {
  const tails: number[] = [];
  const predecessor = new Int32Array(indices.length).fill(-1);
  for (let index = 0; index < indices.length; index++) {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (indices[tails[middle]] < indices[index]) low = middle + 1;
      else high = middle;
    }
    if (low > 0) predecessor[index] = tails[low - 1];
    tails[low] = index;
  }
  const stable = new Set<number>();
  for (let index = tails.at(-1) ?? -1; index >= 0; index = predecessor[index]) {
    stable.add(indices[index]);
  }
  return stable;
}

/** Keep fixed-position anchors, then find ordered runs between them in O(n log n). */
function stableIndices(previous: number[], current: number[]): Set<number> {
  const stable = new Set<number>();
  let start = 0;
  let lower = -1;
  for (let end = 0; end <= previous.length; end++) {
    if (end < previous.length && previous[end] !== current[end]) continue;
    const upper = previous[end] ?? Infinity;
    if (start < end) {
      const candidates: number[] = [];
      for (let index = start; index < end; index++) {
        if (previous[index] > lower && previous[index] < upper) {
          candidates.push(previous[index]);
        }
      }
      for (const index of longestIncreasingSubsequence(candidates))
        stable.add(index);
    }
    if (end < previous.length) stable.add(upper);
    lower = upper;
    start = end + 1;
  }
  return stable;
}

/** Undefined requests positional fallback; null means equal identified arrays. */
export function diffArraysById(
  prev: unknown[],
  curr: unknown[],
  key: string,
  compare: Compare,
): StateTreeDiffNode | null | undefined {
  const before = indexById(prev);
  const after = indexById(curr);
  if (!before || !after) return undefined;

  const previousIndices: number[] = [];
  const currentIndices: number[] = [];
  for (const [id, current] of after) {
    const previous = before.get(id);
    if (previous) {
      previousIndices.push(previous.index);
      currentIndices.push(current.index);
    }
  }
  const stable = stableIndices(previousIndices, currentIndices);
  const children: StateTreeDiffNode[] = [];
  const itemKey = (id: Id) => `[id: ${JSON.stringify(id)}]`;

  for (const [id, current] of after) {
    const previous = before.get(id);
    if (!previous) {
      children.push({
        key: itemKey(id),
        kind: 'added',
        after: current.value,
        arrayItem: { id, currentIndex: current.index },
      });
      continue;
    }
    const change = compare(previous.value, current.value, itemKey(id));
    const moved = !stable.has(previous.index);
    if (change || moved) {
      children.push({
        ...(change ?? { key: itemKey(id), kind: 'changed' }),
        arrayItem: {
          id,
          previousIndex: previous.index,
          currentIndex: current.index,
          moved,
        },
      });
    }
  }
  for (const [id, previous] of before) {
    if (!after.has(id))
      children.push({
        key: itemKey(id),
        kind: 'removed',
        before: previous.value,
        arrayItem: { id, previousIndex: previous.index },
      });
  }
  return children.length
    ? { key, kind: 'changed', containerType: 'array', children }
    : null;
}

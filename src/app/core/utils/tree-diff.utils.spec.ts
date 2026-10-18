import { describe, expect, it } from 'vitest';
import {
  computeStateTreeDiff,
  groupTreeDiffByFeature,
} from './tree-diff.utils';

describe('state tree diff', () => {
  it('reports only the removed entity when deleting the first identified array item', () => {
    const result = computeStateTreeDiff(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [{ id: 2 }, { id: 3 }],
      'items',
    );
    expect(result?.children).toEqual([
      expect.objectContaining({ kind: 'removed', before: { id: 1 } }),
    ]);
  });

  it('reports only the added entity when inserting at the start', () => {
    const result = computeStateTreeDiff(
      [{ id: 2 }],
      [{ id: 1 }, { id: 2 }],
      'items',
    );
    expect(result?.children).toEqual([
      expect.objectContaining({ kind: 'added', after: { id: 1 } }),
    ]);
  });

  it('distinguishes reordering from changes inside the matched entity', () => {
    const result = computeStateTreeDiff(
      [
        { id: 'a', name: 'Ada' },
        { id: 'b', name: 'Bob' },
        { id: 'c', name: 'Cal' },
      ],
      [
        { id: 'b', name: 'Bob' },
        { id: 'c', name: 'Cal' },
        { id: 'a', name: 'Anna' },
      ],
      'items',
    );
    expect(result?.children).toHaveLength(1);
    expect(result?.children?.[0]).toMatchObject({
      arrayItem: { id: 'a', previousIndex: 0, currentIndex: 2, moved: true },
      children: [
        { key: 'name', kind: 'changed', before: 'Ada', after: 'Anna' },
      ],
    });
  });

  it('keeps a pure move visible even when all entity values are equal', () => {
    const result = computeStateTreeDiff(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [{ id: 2 }, { id: 3 }, { id: 1 }],
      'items',
    );
    expect(result?.children).toEqual([
      expect.objectContaining({
        arrayItem: { id: 1, previousIndex: 0, currentIndex: 2, moved: true },
      }),
    ]);
    expect(groupTreeDiffByFeature(result!)).toHaveLength(1);
  });

  it('keeps numeric and string ids distinct and gives them distinct display keys', () => {
    const result = computeStateTreeDiff(
      [
        { id: 1, name: 'number' },
        { id: '1', name: 'string' },
      ],
      [
        { id: '1', name: 'new string' },
        { id: 1, name: 'new number' },
      ],
      'items',
    );
    const children = result?.children ?? [];
    expect(children).toHaveLength(2);
    expect(new Set(children.map((child) => child.key)).size).toBe(2);
    expect(children.map((child) => child.children?.[0])).toEqual([
      { key: 'name', kind: 'changed', before: 'string', after: 'new string' },
      { key: 'name', kind: 'changed', before: 'number', after: 'new number' },
    ]);
  });

  it('does not label a stationary item as moving to its own index', () => {
    const result = computeStateTreeDiff(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [{ id: 3 }, { id: 2 }, { id: 1 }],
      'items',
    );
    expect(result?.children?.some((child) => child.arrayItem?.id === 2)).toBe(
      false,
    );
  });

  it('keeps reordering visible when insertions and removals leave another item at its old index', () => {
    const result = computeStateTreeDiff(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [{ id: 4 }, { id: 2 }, { id: 1 }],
      'items',
    );
    expect(result?.children).toEqual([
      expect.objectContaining({
        kind: 'added',
        arrayItem: { id: 4, currentIndex: 0 },
      }),
      expect.objectContaining({
        arrayItem: { id: 1, previousIndex: 0, currentIndex: 2, moved: true },
      }),
      expect.objectContaining({
        kind: 'removed',
        arrayItem: { id: 3, previousIndex: 2 },
      }),
    ]);
  });

  it('reports both sides of a reversal while preserving its stationary middle item', () => {
    const result = computeStateTreeDiff(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [{ id: 3 }, { id: 2 }, { id: 1 }],
      'items',
    );
    expect(result?.children?.map((child) => child.arrayItem)).toEqual([
      { id: 3, previousIndex: 2, currentIndex: 0, moved: true },
      { id: 1, previousIndex: 0, currentIndex: 2, moved: true },
    ]);
  });

  it('keeps the unreported items in relative order for every small permutation', () => {
    const permutations = (values: number[]): number[][] =>
      values.length === 0
        ? [[]]
        : values.flatMap((value, index) =>
            permutations(values.filter((_, i) => i !== index)).map((rest) => [
              value,
              ...rest,
            ]),
          );
    for (const order of permutations([0, 1, 2, 3, 4])) {
      const previous = [0, 1, 2, 3, 4].map((id) => ({ id }));
      for (const next of [order, [5, ...order.slice(1)]]) {
        const result = computeStateTreeDiff(
          previous,
          next.map((id) => ({ id })),
          'items',
        );
        const moves =
          result?.children?.filter((child) => child.arrayItem?.moved) ?? [];
        expect(
          moves.every(
            (child) =>
              child.arrayItem!.previousIndex !== child.arrayItem!.currentIndex,
          ),
        ).toBe(true);
        const movedIds = new Set(moves.map((child) => child.arrayItem!.id));
        const stableIds = next.filter((id) => id < 5 && !movedIds.has(id));
        expect(stableIds).toEqual([...stableIds].sort((a, b) => a - b));
      }
    }
  });

  it.each([
    {
      prev: [
        { id: 1, value: 1 },
        { id: 1, value: 2 },
      ],
      curr: [{ id: 1, value: 2 }],
    },
    { prev: [{ id: 1 }], curr: [{ id: 1 }, { id: 1 }] },
    { prev: [{ id: 1 }, { value: 2 }], curr: [{ value: 2 }] },
    { prev: [1, 2, 3], curr: [2, 3] },
    { prev: [{ id: '' }, { id: 2 }], curr: [{ id: 2 }] },
  ])(
    'falls back to indices when identity is ambiguous: $prev',
    ({ prev, curr }) => {
      const children =
        computeStateTreeDiff(prev, curr, 'items')?.children ?? [];
      expect(children.length).toBeGreaterThan(0);
      expect(children.every((child) => /^\[\d+\]$/.test(child.key))).toBe(true);
      expect(children.every((child) => !('arrayItem' in child))).toBe(true);
    },
  );

  it('uses identity when one identified array is empty', () => {
    const added = computeStateTreeDiff([], [{ id: 0 }], 'items');
    expect(added?.children?.[0]).toMatchObject({
      kind: 'added',
      arrayItem: { id: 0, currentIndex: 0 },
    });
    const removed = computeStateTreeDiff([{ id: 0 }], [], 'items');
    expect(removed?.children?.[0]).toMatchObject({
      kind: 'removed',
      arrayItem: { id: 0, previousIndex: 0 },
    });
  });

  it('reports a newly added null property', () => {
    expect(computeStateTreeDiff({}, { user: null }, 'root')?.children).toEqual([
      { key: 'user', kind: 'added', after: null },
    ]);
  });

  it('reports removal of a null property', () => {
    expect(computeStateTreeDiff({ user: null }, {}, 'root')?.children).toEqual([
      { key: 'user', kind: 'removed', before: null },
    ]);
  });

  it('treats null as a value when a property changes', () => {
    expect(
      computeStateTreeDiff({ user: { id: 1 } }, { user: null }, 'root')
        ?.children,
    ).toEqual([
      { key: 'user', kind: 'changed', before: { id: 1 }, after: null },
    ]);
  });

  it('keeps changes to a scalar or null root visible', () => {
    const root = computeStateTreeDiff(null, { user: null }, 'root');
    expect(root).not.toBeNull();
    expect(groupTreeDiffByFeature(root!)).toEqual([
      {
        key: 'root',
        kind: 'changed',
        before: null,
        after: { user: null },
        isRoot: true,
      },
    ]);
  });

  it('does not report identical nested snapshots as changed', () => {
    expect(
      computeStateTreeDiff(
        { items: [1, null, { enabled: false }] },
        { items: [1, null, { enabled: false }] },
        'root',
      ),
    ).toBeNull();
  });
});

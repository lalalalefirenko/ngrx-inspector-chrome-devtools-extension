import { describe, expect, it } from 'vitest';
import {
  computeStateTreeDiff,
  groupTreeDiffByFeature,
} from './tree-diff.utils';

describe('state tree diff', () => {
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

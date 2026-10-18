import { describe, expect, it } from 'vitest';
import { buildJsonTree } from './json-tree.utils';

describe('JSON tree construction', () => {
  it('can describe a deeply nested snapshot without recursively traversing it', () => {
    let state: unknown = { value: 'deep leaf' };
    for (let depth = 0; depth < 10_000; depth++) state = { nested: state };

    expect(() => buildJsonTree(state)).not.toThrow();
  });
});

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { computeStateTreeDiff } from '../../../core/utils/tree-diff.utils';
import { DiffTreeComponent } from './diff-tree.component';

describe('identified array diff presentation', () => {
  it('names the removed entity and its previous index without showing shifted entities', () => {
    const fixture = TestBed.createComponent(DiffTreeComponent);
    const node = computeStateTreeDiff(
      [{ id: 1 }, { id: 2 }],
      [{ id: 2 }],
      'items',
    );
    fixture.componentRef.setInput('node', { ...node, isRoot: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('[id: 1]');
    expect(fixture.nativeElement.textContent).toContain('Removed from [0]');
    expect(fixture.nativeElement.textContent).not.toContain('[id: 2]');
  });

  it('shows a move and lets the user expand the changed fields', () => {
    const fixture = TestBed.createComponent(DiffTreeComponent);
    const node = computeStateTreeDiff(
      [{ id: 1, name: 'Ada' }, { id: 2 }, { id: 3 }],
      [{ id: 2 }, { id: 3 }, { id: 1, name: 'Anna' }],
      'items',
    );
    fixture.componentRef.setInput('node', { ...node, isRoot: true });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.item-move').textContent,
    ).toContain('Moved [0] → [2]');

    fixture.nativeElement
      .querySelector('.item-move')
      .closest('.node-header')
      .click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.before').textContent).toBe(
      '"Ada"',
    );
    expect(fixture.nativeElement.querySelector('.after').textContent).toBe(
      '"Anna"',
    );
  });
});

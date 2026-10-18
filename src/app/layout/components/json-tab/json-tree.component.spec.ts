import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { buildJsonTree } from '../../../core/utils/json-tree.utils';
import { JsonTreeComponent } from './json-tree.component';

describe('JsonTreeComponent', () => {
  it('reads only the expanded level and leaves deeper collapsed branches untouched', () => {
    const readBranch = vi.fn(() => ({
      get value() {
        return readLeaf();
      },
    }));
    const readLeaf = vi.fn(() => 42);
    const fixture = TestBed.createComponent(JsonTreeComponent);
    fixture.componentRef.setInput(
      'node',
      buildJsonTree({
        feature: {
          get nested() {
            return readBranch();
          },
        },
      }),
    );
    fixture.detectChanges();

    expect(readBranch).not.toHaveBeenCalled();
    expect(readLeaf).not.toHaveBeenCalled();

    fixture.nativeElement.querySelector('json-tree .node-header').click();
    fixture.detectChanges();
    expect(readBranch).toHaveBeenCalledOnce();
    expect(readLeaf).not.toHaveBeenCalled();

    fixture.nativeElement
      .querySelector('json-tree json-tree .node-header')
      .click();
    fixture.detectChanges();
    expect(readLeaf).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('42');
  });

  it('resets expanded branches when the snapshot changes', () => {
    const fixture = TestBed.createComponent(JsonTreeComponent);
    fixture.componentRef.setInput(
      'node',
      buildJsonTree({ feature: { old: 1 } }),
    );
    fixture.detectChanges();
    fixture.nativeElement.querySelector('json-tree .node-header').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('old');

    fixture.componentRef.setInput(
      'node',
      buildJsonTree({ feature: { next: 2 } }),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('old');
    expect(
      fixture.nativeElement.querySelector('json-tree .preview'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('next');

    fixture.nativeElement.querySelector('json-tree .node-header').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('next');
  });

  it.each([
    { value: [], expected: '[]' },
    { value: {}, expected: '{}' },
  ])('renders empty root container as $expected', ({ value, expected }) => {
    const fixture = TestBed.createComponent(JsonTreeComponent);
    fixture.componentRef.setInput('node', buildJsonTree(value));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.value')?.textContent).toBe(
      expected,
    );
  });

  it('distinguishes nested empty arrays from empty objects', () => {
    const fixture = TestBed.createComponent(JsonTreeComponent);
    fixture.componentRef.setInput(
      'node',
      buildJsonTree({ list: [], options: {} }),
    );
    fixture.detectChanges();
    const values = [...fixture.nativeElement.querySelectorAll('.value')].map(
      (element: Element) => element.textContent,
    );

    expect(values).toEqual(['[]', '{}']);
  });

  it('previews a nonempty array as an array', () => {
    const fixture = TestBed.createComponent(JsonTreeComponent);
    fixture.componentRef.setInput('node', buildJsonTree({ list: [1, 2] }));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.preview')?.textContent.trim(),
    ).toMatch(/^\[/);
  });

  it('preserves literal property names when pinning', () => {
    const fixture = TestBed.createComponent(JsonTreeComponent);
    const pinned = vi.fn();
    fixture.componentRef.setInput('node', buildJsonTree({ '[user]': [] }));
    fixture.componentRef.setInput('isPinningEnabled', true);
    fixture.componentInstance.pinNode.subscribe(pinned);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.pin-button').click();

    expect(pinned).toHaveBeenCalledWith(['[user]']);
  });
});

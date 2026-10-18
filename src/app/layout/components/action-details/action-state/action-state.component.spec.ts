import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionStateComponent } from './action-state.component';

describe('ActionStateComponent pinned paths', () => {
  let fixture: ComponentFixture<ActionStateComponent>;

  function render(
    state: unknown,
    path: string[] | null = ['Store', 'user', 'profile'],
  ): void {
    fixture.componentRef.setInput('action', {
      id: 1,
      type: 'Action',
      timestamp: 1,
      state,
    });
    fixture.componentRef.setInput('pinnedPath', path);
    fixture.detectChanges();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(ActionStateComponent);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows the full state when there is no pin', () => {
    render({ count: 1 }, null);

    expect(
      fixture.nativeElement.querySelector('json-tree').textContent,
    ).toContain('count');
    expect(fixture.nativeElement.querySelector('action-path')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

  it('resolves a pin without reading unrelated state or collapsed descendants', () => {
    const readUnrelated = vi.fn(() => ({ large: [1, 2, 3] }));
    const readDescendant = vi.fn(() => 'not expanded');
    render({
      user: {
        profile: {
          details: {
            get hidden() {
              return readDescendant();
            },
          },
        },
      },
      get unrelated() {
        return readUnrelated();
      },
    });

    expect(readUnrelated).not.toHaveBeenCalled();
    expect(readDescendant).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('json-tree').textContent,
    ).toContain('details');
    expect(
      fixture.nativeElement.querySelector('json-tree').textContent,
    ).not.toContain('unrelated');
  });

  it('preserves literal keys and full paths inside a pinned subtree', () => {
    const pin = vi.fn();
    fixture.componentInstance.pinNode.subscribe(pin);
    render({ '[users]': [{ 'first.name': { value: 'Ada' } }] }, [
      'Store',
      '[users]',
      '0',
    ]);
    fixture.nativeElement.querySelector('.pin-button').click();

    expect(pin).toHaveBeenCalledWith(['[users]', '0', 'first.name']);
    expect(
      fixture.nativeElement.querySelector('json-tree').textContent,
    ).toContain('first.name');
  });

  it('shows a missing-path message without falling back to the full state or releasing the pin', () => {
    render({ user: null, unrelated: 'Other state' });

    expect(
      fixture.nativeElement.querySelector('[role="status"]').textContent,
    ).toContain("The pinned path is not present in this action's state.");
    expect(fixture.nativeElement.querySelector('json-tree')).toBeNull();
    expect(fixture.componentInstance.pinnedPath()).toEqual([
      'Store',
      'user',
      'profile',
    ]);
    expect(
      fixture.nativeElement.querySelector('action-path').textContent,
    ).toContain('profile');
  });

  it('emits an unpin request from the missing-path message', () => {
    const unpin = vi.fn();
    fixture.componentInstance.unpinNode.subscribe(unpin);
    render({});
    fixture.nativeElement.querySelector('[role="status"] button').click();

    expect(unpin).toHaveBeenCalledOnce();
  });

  it.each([
    { value: null, expected: 'null' },
    { value: undefined, expected: 'undefined' },
    { value: false, expected: 'false' },
    { value: 0, expected: '0' },
    { value: '', expected: '""' },
    { value: [], expected: '[]' },
    { value: {}, expected: '{}' },
  ])(
    'treats an existing $expected value as a valid pinned node',
    ({ value, expected }) => {
      render({ user: { profile: value } });

      expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
      expect(
        fixture.nativeElement.querySelector('json-tree .value').textContent,
      ).toBe(expected);
    },
  );

  it('handles a missing array index and allows an existing ancestor to be displayed', () => {
    render({ users: [{ name: 'Ada' }] }, ['Store', 'users', '2']);
    expect(
      fixture.nativeElement.querySelector('[role="status"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('json-tree')).toBeNull();

    fixture.componentRef.setInput('pinnedPath', ['Store', 'users']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('json-tree')).not.toBeNull();
  });
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NgrxActionRecord } from '../../../core/models/ngrx-action-record.model';
import { ActionsStore } from '../../../core/services/actions-store.service';
import { SettingsStoreService } from '../../../core/services/settings-store.service';
import { ActionDetailsComponent } from './action-details.component';

describe('ActionDetailsComponent retained inspection', () => {
  let fixture: ComponentFixture<ActionDetailsComponent>;
  let store: ActionsStore;

  const record = (id: number): NgrxActionRecord => ({
    id,
    type: `Action ${id}`,
    state: { count: id },
    payload: { id },
    timestamp: id,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsStoreService, useValue: { filters: signal([]) } },
      ],
    });
    store = TestBed.inject(ActionsStore);
    fixture = TestBed.createComponent(ActionDetailsComponent);
    fixture.componentRef.setInput('canDisplayDetails', true);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps both selected values and diff after both snapshots leave the history', () => {
    store.add(record(1));
    store.add(record(2));
    store.select(2);
    fixture.componentInstance.currentTab.set('diff');
    fixture.detectChanges();
    for (let id = 3; id <= 250; id++) store.add(record(id));
    store.searchValue.set('Unrelated');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.selected-action-type').textContent,
    ).toBe('Action 2');
    expect(
      fixture.nativeElement.querySelector('.selection-status').textContent,
    ).toContain('Outside current list');
    expect(fixture.nativeElement.querySelector('.before').textContent).toBe(
      '1',
    );
    expect(fixture.nativeElement.querySelector('.after').textContent).toBe('2');
    expect(fixture.nativeElement.textContent).not.toContain(
      'previous state is unavailable',
    );
  });

  it('retains payload and state when switching tabs after eviction', () => {
    store.add(record(1));
    store.select(1);
    for (let id = 2; id <= 250; id++) store.add(record(id));
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('action-payload').textContent,
    ).toContain('1');
    fixture.componentInstance.currentTab.set('state');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('action-state').textContent,
    ).toContain('count');
    expect(
      fixture.nativeElement.querySelector('action-state').textContent,
    ).toContain('1');
  });

  it.each(['clear', 'reset'] as const)(
    '%s closes the inspected record',
    (method) => {
      store.add(record(1));
      store.select(1);
      fixture.detectChanges();
      store[method]();
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('.selected-action-header'),
      ).toBeNull();
      expect(fixture.nativeElement.querySelector('.tab-content')).toBeNull();
    },
  );

  it('keeps a missing pin and restores its branch when the original action is selected', () => {
    store.add({ ...record(1), state: { user: { profile: { name: 'Ada' } } } });
    store.add({ ...record(2), state: { user: null } });
    store.select(1);
    store.pinNode(['user', 'profile']);
    fixture.componentInstance.currentTab.set('state');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('json-tree').textContent,
    ).toContain('Ada');

    store.select(2);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="status"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('json-tree')).toBeNull();
    expect(store.pinnedPath()).toEqual(['Store', 'user', 'profile']);

    store.select(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('json-tree').textContent,
    ).toContain('Ada');
    expect(store.pinnedPath()).toEqual(['Store', 'user', 'profile']);
  });

  it('unpins a missing branch and displays the full selected state', () => {
    store.add(record(1));
    store.select(1);
    store.pinNode(['user', 'profile']);
    fixture.componentInstance.currentTab.set('state');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[role="status"] button').click();
    fixture.detectChanges();

    expect(store.pinnedPath()).toBeNull();
    expect(store.selectedAction()?.id).toBe(1);
    expect(fixture.nativeElement.querySelector('action-path')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('json-tree').textContent,
    ).toContain('count');
  });
});

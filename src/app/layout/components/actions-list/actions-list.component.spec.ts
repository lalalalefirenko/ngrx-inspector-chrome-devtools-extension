import { CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionFilter } from '../../../core/models/filter.model';
import { NgrxActionRecord } from '../../../core/models/ngrx-action-record.model';
import { ActionsStore } from '../../../core/services/actions-store.service';
import { SettingsStoreService } from '../../../core/services/settings-store.service';
import { ActionsListComponent } from './actions-list.component';

describe('ActionsListComponent', () => {
  const filters = signal<ActionFilter[]>([]);
  let fixture: ComponentFixture<ActionsListComponent>;
  let store: ActionsStore;

  const record = (id: number, type = 'Increment'): NgrxActionRecord => ({
    id,
    type,
    payload: null,
    state: { count: id },
    timestamp: id,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    filters.set([]);
    TestBed.configureTestingModule({
      providers: [{ provide: SettingsStoreService, useValue: { filters } }],
    });
    store = TestBed.inject(ActionsStore);
    fixture = TestBed.createComponent(ActionsListComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('shows the selected action separately after history evicts it', () => {
    const selected = record(1, '[Users] Load Success');
    store.add(selected);
    store.select(selected.id);
    for (let id = 2; id <= 250; id++) store.add(record(id));
    fixture.detectChanges();

    const retained = fixture.nativeElement.querySelector('.retained-selection');
    expect(retained.textContent).toContain(selected.type);
    expect(retained.textContent).toContain('Outside current list');
    expect(store.selectedAction()).toBe(selected);
  });

  it('does not duplicate an action that is still visible', () => {
    store.add(record(1));
    store.select(1);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.retained-selection'),
    ).toBeNull();
  });

  it('selects and scrolls to the latest matching action once', () => {
    const selected = record(3, 'Keep current');
    const predecessor = record(2, 'Hidden intermediate');
    [
      record(1, 'Keep initial'),
      predecessor,
      selected,
      record(4, 'Hidden latest'),
    ].forEach((action) => store.add(action));
    store.select(1);
    filters.set([{ id: 'hidden', pattern: 'Hidden', enabled: true }]);
    fixture.detectChanges();
    const viewport = fixture.debugElement.query(
      By.directive(CdkVirtualScrollViewport),
    ).componentInstance as CdkVirtualScrollViewport;
    const scroll = vi
      .spyOn(viewport, 'scrollToIndex')
      .mockImplementation(() => {});
    const clicked = vi.fn();
    fixture.componentInstance.actionClicked.subscribe(clicked);
    fixture.nativeElement.querySelector('.latest-action').click();

    expect(store.selectedAction()).toBe(selected);
    expect(store.selectedPreviousAction()).toBe(predecessor);
    expect(scroll).toHaveBeenCalledWith(1);
    expect(clicked).toHaveBeenCalledOnce();
    store.add(record(5, 'Keep newer'));
    expect(store.selectedAction()).toBe(selected);
  });

  it('disables Latest action when there are no matching events', () => {
    store.add(record(1));
    store.select(1);
    store.searchValue.set('No matching action');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.latest-action').disabled).toBe(
      true,
    );
    expect(
      fixture.nativeElement.querySelector('.retained-selection'),
    ).not.toBeNull();
  });

  it('removes retained selection when history is cleared', () => {
    store.add(record(1));
    store.select(1);
    store.searchValue.set('Hidden');
    fixture.detectChanges();
    store.clear();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.retained-selection'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.latest-action').disabled).toBe(
      true,
    );
  });

  it('passes only lightweight metadata to the virtual view cache', () => {
    const first = record(1, 'First');
    store.add(first);
    fixture.detectChanges();
    const repeater = fixture.debugElement
      .queryAllNodes(By.directive(CdkVirtualForOf))[0]
      .injector.get(CdkVirtualForOf);
    const firstRows = [...(repeater.cdkVirtualForOf as Iterable<unknown>)];

    expect(firstRows).toEqual([{ id: 1, type: 'First' }]);
    expect(firstRows[0]).not.toBe(first);
    store.add(record(2));
    fixture.detectChanges();
    const updatedRows = [...(repeater.cdkVirtualForOf as Iterable<unknown>)];
    expect(updatedRows[0]).toBe(firstRows[0]);
  });
});

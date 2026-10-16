import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionFilter } from '../../../../core/models/filter.model';
import { NgrxActionRecord } from '../../../../core/models/ngrx-action-record.model';
import { ActionsStore } from '../../../../core/services/actions-store.service';
import { SettingsStoreService } from '../../../../core/services/settings-store.service';
import { ActionDiffComponent } from './action-diff.component';

describe('ActionDiffComponent', () => {
  const filters = signal<ActionFilter[]>([]);
  let fixture: ComponentFixture<ActionDiffComponent>;
  let store: ActionsStore;

  const record = (
    id: number,
    type: string,
    count: number,
  ): NgrxActionRecord => ({
    id,
    type,
    state: { count },
    payload: null,
    timestamp: id,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    filters.set([]);
    TestBed.configureTestingModule({
      providers: [{ provide: SettingsStoreService, useValue: { filters } }],
    });
    store = TestBed.inject(ActionsStore);
    fixture = TestBed.createComponent(ActionDiffComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function select(action: NgrxActionRecord): void {
    store.select(action.id);
    fixture.componentRef.setInput('action', action);
    fixture.componentRef.setInput('previousAction', store.selectedPreviousAction());
    fixture.detectChanges();
  }

  it('compares with the preceding raw action when a prefix filter hides it', () => {
    const current = record(3, 'Increment', 11);
    [record(1, 'Initial', 1), record(2, 'Hidden tick', 10), current].forEach(
      (action) => store.add(action),
    );
    select(current);
    filters.set([{ id: 'hidden', pattern: 'Hidden', enabled: true }]);

    expect(fixture.componentInstance.features()).toEqual([
      expect.objectContaining({ key: 'count', before: 10, after: 11 }),
    ]);
  });

  it('preserves the diff when search returns only the selected action', () => {
    const current = record(2, 'Increment', 11);
    store.add(record(1, 'Initial', 10));
    store.add(current);
    store.searchValue.set('Increment');
    select(current);

    expect(fixture.componentInstance.features()).toEqual([
      expect.objectContaining({ before: 10, after: 11 }),
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('states are equal');
  });

  it('distinguishes an unavailable baseline from equal states', () => {
    const current = record(1, 'Initial', 10);
    store.add(current);
    select(current);

    expect(fixture.nativeElement.textContent).toContain(
      'previous state is unavailable',
    );
    expect(fixture.nativeElement.textContent).not.toContain('states are equal');
  });

  it('shows equal states when a previous snapshot really is equal', () => {
    const current = record(2, 'Unchanged', 10);
    store.add(record(1, 'Initial', 10));
    store.add(current);
    select(current);

    expect(fixture.nativeElement.textContent).toContain('states are equal');
  });

  it('retains the baseline after a manual clear', () => {
    store.add(record(1, 'Initial', 10));
    store.clear();
    const current = record(2, 'Increment', 11);
    store.add(current);
    select(current);

    expect(store.visibleActions()).toEqual([current]);
    expect(fixture.componentInstance.features()).toEqual([
      expect.objectContaining({ before: 10, after: 11 }),
    ]);
  });

  it('reports a missing baseline for the oldest retained action', () => {
    for (let id = 1; id <= 201; id++) store.add(record(id, 'Increment', id));
    select(store.actions()[0]);

    expect(store.actions()).toHaveLength(200);
    expect(fixture.nativeElement.textContent).toContain(
      'previous state is unavailable',
    );
  });
});

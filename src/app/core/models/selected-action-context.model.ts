import { NgrxActionRecord } from './ngrx-action-record.model';

/** The two records needed to inspect an action independently of the live history. */
export interface SelectedActionContext {
  readonly action: NgrxActionRecord;
  readonly previousAction: NgrxActionRecord | undefined;
}

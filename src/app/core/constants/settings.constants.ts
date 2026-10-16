import { ActionFilter } from '../models/filter.model';

export const DEFAULT_FILTERS: ActionFilter[] = [
  {
    id: 'default-ngrx',
    pattern: '@ngrx',
    enabled: false,
    readonly: true,
  },
];

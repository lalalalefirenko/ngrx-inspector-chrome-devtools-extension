import { ActionFilter } from '../models/filter.model';

export const DEFAULT_FILTERS: ActionFilter[] = [
  {
    id: 'default-ngrx',
    pattern: '@ngrx',
    enabled: false,
    readonly: true,
  },
  {
    id: 'default-router',
    pattern: '[Router]',
    enabled: false,
    readonly: true,
  },
  {
    id: 'default-screen-width',
    pattern: '[Screen width]',
    enabled: false,
    readonly: true,
  },
  {
    id: 'default-websocket',
    pattern: '[WebSocket connection]',
    enabled: false,
    readonly: true,
  },
];

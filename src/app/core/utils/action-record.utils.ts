import { RuntimeMessage } from '../models/chrome-runtime-message.model';
import { NgrxActionRecord } from '../models/ngrx-action-record.model';

/** Validates serialized records at the Chrome runtime boundary. */
export function isNgrxActionRecord(value: unknown): value is NgrxActionRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record['id'] === 'number' &&
    Number.isFinite(record['id']) &&
    typeof record['type'] === 'string' &&
    record['type'].trim().length > 0 &&
    typeof record['timestamp'] === 'number' &&
    Number.isFinite(record['timestamp']) &&
    Object.hasOwn(record, 'state') &&
    (record['isMeta'] === undefined || typeof record['isMeta'] === 'boolean') &&
    (record['isNew'] === undefined || typeof record['isNew'] === 'boolean')
  );
}

export function isNgrxActionMessage(
  value: unknown,
): value is RuntimeMessage<NgrxActionRecord> {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    message['type'] === 'NGRX_ACTION' && isNgrxActionRecord(message['payload'])
  );
}

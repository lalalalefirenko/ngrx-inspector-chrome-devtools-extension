/**
 * Data model for displaying details of an NgRx action.
 */
export interface NgrxActionRecord {
  /**
   * Action identifier.
   */
  id: number;

  /**
   * Action type.
   */
  type: string;

  /**
   * Action payload.
   */
  payload: unknown;

  /**
   * Application state after this action occurred.
   */
  state: unknown;

  /**
   * Timestamp when the action occurred.
   */
  timestamp: number;

  /**
   * Is the action newly added?
   */
  isNew?: boolean;

  /**
   * Should the action be treated as metadata (not displayed)?
   */
  isMeta?: boolean;
}

/**
 * Data model for a rule used to filter NgRx actions.
 */
export interface ActionFilter {
  /**
   * Identifier.
   */
  id: string;

  /**
   * Rule for filtering NgRx actions.
   */
  pattern: string;

  /**
   * Is the rule enabled?
   */
  enabled: boolean;

  /**
   * Is the rule read-only (cannot be deleted)?
   */
  readonly?: boolean;
}

/**
 * Type of message received from the Chrome runtime port.
 */
export interface RuntimeMessage<T = unknown> {
  /**
   * Type of the message (e.g., "NGRX_ACTION")
   */
  type: string;

  /**
   * Payload
   */
  payload: T;
}

/**
 * Checks if the application is running in development mode.
 *
 * @return true if the application cannot see the `chrome` object
 *         (not registered in the DevTools panel), otherwise false.
 */
export function isDevToolsEnv(): boolean {
  return (
    // @ts-expect-error
    typeof chrome !== 'undefined' &&
    // @ts-expect-error
    Boolean(chrome.runtime) &&
    // @ts-expect-error
    Boolean(chrome.devtools)
  );
}

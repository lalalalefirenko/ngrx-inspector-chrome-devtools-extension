/**
 * Checks if the application is running in development mode.
 *
 * @return true if the application cannot see the `chrome` object
 *         (not registered in the DevTools panel), otherwise false.
 */
export function isDevToolsEnv(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.runtime) &&
    Boolean(chrome.devtools)
  );
}

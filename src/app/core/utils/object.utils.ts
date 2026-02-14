import { Nullable } from '../types/nullable.type';

/**
 * Is the value null or undefined?
 *
 * @param value The value to check.
 *
 * @return true if null or undefined.
 */
export const isNullOrUndefined = (value: unknown): boolean =>
  value === null || value === undefined;

/**
 * Is the value an object?
 *
 * @param value The value to check.
 *
 * @return true if the value is an object, otherwise false.
 */
export const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;

/**
 * Gets the value of a property by the specified path.
 *
 * @param object The object from which to get the node value.
 * @param path The path in the state to the node's value.
 */
export const getValueByPath = (
  object: unknown,
  path: Nullable<string[]>,
): unknown => {
  if (isNullOrUndefined(object) || isNullOrUndefined(path)) {
    return null;
  }

  return path?.reduce(
    // @ts-ignore
    (obj: unknown, key: string) => obj?.[key],
    object,
  );
};

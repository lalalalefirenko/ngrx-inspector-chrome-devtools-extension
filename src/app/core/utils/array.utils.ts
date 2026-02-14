import { Nullable } from '../types/nullable.type';

/**
 * Utilities for arrays.
 */
export class ArrayUtils {
  //region Public static

  /**
   * Is the array empty?
   *
   * @param array The array.
   *
   * @return Yes/No.
   */
  static isEmpty<T>(array: T[]): boolean {
    return array === undefined || array === null || array?.length === 0;
  }

  /**
   * Is the array not empty?
   *
   * @param array The array.
   *
   * @return Yes/No.
   */
  static isNotEmpty<T>(array: T[]): boolean {
    return !ArrayUtils.isEmpty(array);
  }

  /**
   * Returns the last element of the array.
   *
   * @param array The array.
   *
   * @return The last element of the array or <code>undefined</code> if the array is empty.
   */
  static last<T>(array: Nullable<T[]>): T | undefined {
    return array?.at(-1);
  }

  //endregion
}

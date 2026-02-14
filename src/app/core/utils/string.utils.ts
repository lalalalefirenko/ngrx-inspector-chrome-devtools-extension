import { Injectable } from '@angular/core';
import { ArrayUtils } from './array.utils';

/**
 * Utilities for working with strings.
 */
@Injectable({
  providedIn: 'root',
})
export class StringUtils {
  //region Public static

  /**
   * Checks if words or parts of words overlap between the source and search string.
   *
   * @param source The source string.
   * @param search The search string.
   *
   * @return Yes/No.
   */
  static containsSearchWords(source: string, search: string): boolean {
    const sourceWords: string[] = StringUtils.splitByWords(source);
    const searchWords: string[] = StringUtils.splitByWords(search);

    if (ArrayUtils.isEmpty(searchWords)) {
      return true;
    }

    return sourceWords.some((sourceWord: string): boolean =>
      searchWords.some((searchWord: string): boolean =>
        sourceWord.includes(searchWord),
      ),
    );
  }

  /**
   * Splits the source string into words and {@link StringUtils.normalize normalizes} them.
   *
   * @param source The source string.
   *
   * @return Array of {@link StringUtils.normalize normalized} words.
   */
  static splitByWords(source: string): string[] {
    return StringUtils.normalize(source).split(/\s/).filter(Boolean);
  }

  /**
   * Converts the string to lowercase, trims leading/trailing spaces,
   * and replaces "ё" with "е".
   *
   * @param target The source string.
   *
   * @return The transformed string.
   */
  static normalize(target: string): string {
    return target.trim().replace(/ё/gi, 'е').toLowerCase();
  }

  //endregion
}

import { ArrayUtils } from './array.utils';

/**
 * Checks if words or parts of words overlap between the source and search string.
 *
 * @param source The source string.
 * @param search The search string.
 *
 * @return Yes/No.
 */
export function containsSearchWords(source: string, search: string): boolean {
  const sourceWords: string[] = splitByWords(source);
  const searchWords: string[] = splitByWords(search);

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
 * Splits the source string into words and {@link normalize normalizes} them.
 *
 * @param source The source string.
 *
 * @return Array of {@link normalize normalized} words.
 */
export function splitByWords(source: string): string[] {
  return normalize(source).split(/\s/).filter(Boolean);
}

/**
 * Converts the string to lowercase, trims leading/trailing spaces,
 * and replaces "ё" with "е".
 *
 * @param target The source string.
 *
 * @return The transformed string.
 */
export function normalize(target: string): string {
  return target.trim().replace(/ё/gi, 'е').toLowerCase();
}

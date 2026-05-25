/**
 * Returns a new array with duplicates removed, preserving the order of
 * first occurrence.
 *
 * Useful for deduping path lists, IDs, etc. while keeping precedence
 * stable.
 */
export function dedupePreserveOrder<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

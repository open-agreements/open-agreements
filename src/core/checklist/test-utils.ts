/**
 * Convert an array of items into a Record keyed by a specified ID field.
 * Used to transform test fixtures from array format to Record format
 * for the array-to-record schema migration.
 */
export function arrayToRecord<T extends Record<string, unknown>>(
  items: T[],
  idField: keyof T,
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const item of items) {
    result[item[idField] as string] = item;
  }
  return result;
}

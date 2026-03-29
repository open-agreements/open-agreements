/**
 * Bridge between Concerto-structured data and the flat fill pipeline.
 *
 * Concerto models use nested concepts (e.g., party_1.name, terms.purpose).
 * The fill pipeline expects flat keys (e.g., party_1_name, purpose).
 *
 * This module flattens Concerto instances into fill-compatible records,
 * stripping $class annotations and joining nested keys with underscores.
 */

/**
 * Flatten a Concerto-validated object into a flat key-value record
 * suitable for the fill pipeline.
 *
 * Example:
 *   { party_1: { name: "Acme" }, terms: { purpose: "Eval" } }
 *   → { party_1_name: "Acme", purpose: "Eval" }
 */
export function flattenConcertoInstance(
  instance: Record<string, unknown>,
): Record<string, string> {
  const result: Record<string, string> = {};

  function walk(obj: Record<string, unknown>, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      // Skip Concerto metadata fields
      if (key === '$class') continue;

      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Nested concept — recurse with prefix
        walk(value as Record<string, unknown>, prefix ? `${prefix}_${key}` : key);
      } else {
        // Leaf value — flatten to string
        const flatKey = prefix ? `${prefix}_${key}` : key;
        result[flatKey] = value instanceof Date ? value.toISOString() : String(value ?? '');
      }
    }
  }

  walk(instance, '');
  return result;
}

/**
 * Map between Concerto concept field paths and fill pipeline flat keys.
 *
 * Some templates use a naming convention where the section prefix is dropped
 * for readability (e.g., terms.purpose → "purpose", not "terms_purpose").
 * This map handles those overrides.
 */
export interface FlattenMapping {
  /** Concerto dot-path (e.g., "terms.purpose") */
  from: string;
  /** Fill pipeline flat key (e.g., "purpose") */
  to: string;
}

/**
 * Flatten a Concerto instance using explicit field mappings.
 * Falls back to underscore-joined paths for unmapped fields.
 */
export function flattenWithMapping(
  instance: Record<string, unknown>,
  mappings: FlattenMapping[],
): Record<string, string> {
  const overrides = new Map(mappings.map(m => [m.from, m.to]));
  const result: Record<string, string> = {};

  function walk(obj: Record<string, unknown>, dotPath: string, underscorePath: string): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key === '$class') continue;

      const newDotPath = dotPath ? `${dotPath}.${key}` : key;
      const newUnderscorePath = underscorePath ? `${underscorePath}_${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        walk(value as Record<string, unknown>, newDotPath, newUnderscorePath);
      } else {
        // Check for explicit mapping, otherwise use underscore path
        const flatKey = overrides.get(newDotPath) ?? newUnderscorePath;
        result[flatKey] = value instanceof Date ? value.toISOString() : String(value ?? '');
      }
    }
  }

  walk(instance, '', '');
  return result;
}

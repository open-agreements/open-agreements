/**
 * Shared parsing logic for replacement key syntax extensions.
 *
 * Key formats:
 *   - Simple:  "search text" → replaces all occurrences
 *   - Context: "context > placeholder" → in tables, replaces placeholder in rows
 *     where label matches; in paragraphs, replaces first placeholder after context
 */

/** A replacement value: either a plain string or an object with value + formatting. */
export type ReplacementValue = string | { value: string; format?: Record<string, unknown> };

/** Extract the plain string value from a ReplacementValue. */
export function resolveReplacementValue(rv: ReplacementValue): string {
  return typeof rv === 'string' ? rv : rv.value;
}

export type ParsedKey =
  | { type: 'simple'; searchText: string; value: string }
  | { type: 'context'; context: string; searchText: string; value: string };

/**
 * Parse a replacement key string into its typed representation.
 */
export function parseReplacementKey(key: string, value: string): ParsedKey {
  // Check for context qualifier: "context > placeholder"
  const contextSep = key.indexOf(' > ');
  if (contextSep !== -1) {
    return {
      type: 'context',
      context: key.slice(0, contextSep),
      searchText: key.slice(contextSep + 3),
      value,
    };
  }

  return { type: 'simple', searchText: key, value };
}

/**
 * Extract the actual search text from a replacement key.
 * Used by the verifier and validators to check for leftover placeholders.
 */
export function extractSearchText(key: string): string {
  const contextSep = key.indexOf(' > ');
  if (contextSep !== -1) {
    return key.slice(contextSep + 3);
  }

  return key;
}

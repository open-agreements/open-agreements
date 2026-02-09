/**
 * Shared parsing logic for replacement key syntax extensions.
 *
 * Key formats:
 *   - Simple:  "search text" → replaces all occurrences
 *   - Context: "label > placeholder" → replaces placeholder only in table rows where label cell matches
 *   - Nth:     "text#N" → replaces only the Nth occurrence across the document
 */

export type ParsedKey =
  | { type: 'simple'; searchText: string; value: string }
  | { type: 'context'; context: string; searchText: string; value: string }
  | { type: 'nth'; searchText: string; n: number; value: string };

/**
 * Parse a replacement key string into its typed representation.
 */
export function parseReplacementKey(key: string, value: string): ParsedKey {
  // Check for context qualifier: "label > placeholder"
  const contextSep = key.indexOf(' > ');
  if (contextSep !== -1) {
    return {
      type: 'context',
      context: key.slice(0, contextSep),
      searchText: key.slice(contextSep + 3),
      value,
    };
  }

  // Check for nth occurrence: "text#N" where N is a positive integer
  const nthMatch = key.match(/#(\d+)$/);
  if (nthMatch) {
    const n = parseInt(nthMatch[1], 10);
    if (n > 0) {
      return {
        type: 'nth',
        searchText: key.slice(0, -nthMatch[0].length),
        n,
        value,
      };
    }
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

  const nthMatch = key.match(/#(\d+)$/);
  if (nthMatch && parseInt(nthMatch[1], 10) > 0) {
    return key.slice(0, -nthMatch[0].length);
  }

  return key;
}

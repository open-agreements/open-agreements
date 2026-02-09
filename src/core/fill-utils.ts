/**
 * Shared utilities for the fill stage of recipe and external pipelines.
 */

/**
 * Visible placeholder rendered for fields the user hasn't filled yet.
 * Makes it obvious what still needs attention in the output document.
 */
export const BLANK_PLACEHOLDER = '_______';

/**
 * Detect fields whose replacement values place a literal `$` immediately
 * before the `{field_name}` template tag (e.g. `${purchase_amount}`).
 * For those fields, strip a leading `$` from the user-provided value
 * to prevent double-dollar output like `$$1,000,000`.
 *
 * Returns a new values object (does not mutate the input).
 */
export function sanitizeCurrencyValues(
  values: Record<string, string>,
  replacements: Record<string, string>
): Record<string, string> {
  // Find fields where the replacement value has $ immediately before {field_name}
  const dollarPrefixedFields = new Set<string>();
  for (const replValue of Object.values(replacements)) {
    const matches = replValue.matchAll(/\$\{(\w+)\}/g);
    for (const m of matches) {
      dollarPrefixedFields.add(m[1]);
    }
  }

  if (dollarPrefixedFields.size === 0) return values;

  const sanitized = { ...values };
  for (const field of dollarPrefixedFields) {
    if (sanitized[field] && sanitized[field].startsWith('$')) {
      sanitized[field] = sanitized[field].slice(1);
    }
  }
  return sanitized;
}

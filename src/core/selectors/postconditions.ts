/**
 * Selector postconditions, surfaced as recipe `VerifyCheck` entries after fill.
 *
 * Phase 1 supports three:
 *  - `no_unresolved_placeholder` — the field's `{field_id}` tag did not survive
 *    to the output (every occurrence filled).
 *  - `all_occurrences_identical` — the field renders one value everywhere: its
 *    value is present and no selector-owned source anchor for the field remains
 *    (a remaining anchor means an occurrence rendered differently → divergence).
 *  - `no_double_dollar` — no `$$` / `$ $` artifact in the output.
 */
import type { VerifyCheck } from '../recipe/types.js';
import type { FieldSelectorManifest } from './manifest-schema.js';

export interface PostconditionInput {
  /** Full extracted text of the filled output. */
  outputText: string;
  manifests: FieldSelectorManifest[];
  /** Filled value per field_id (for `all_occurrences_identical`). */
  fieldValues: Record<string, string>;
  /** Selector-owned source anchor strings per field_id (migrated-key search texts). */
  migratedAnchorsByField: Record<string, string[]>;
}

const DOUBLE_DOLLAR = /\$\s*\$/;

export function evaluatePostconditions(input: PostconditionInput): VerifyCheck[] {
  const { outputText, manifests, fieldValues, migratedAnchorsByField } = input;
  const checks: VerifyCheck[] = [];

  for (const manifest of manifests) {
    const fieldId = manifest.field_id;
    for (const postcondition of manifest.postconditions) {
      if (postcondition === 'no_unresolved_placeholder') {
        const tag = `{${fieldId}}`;
        const present = outputText.includes(tag);
        checks.push({
          name: `selector:${fieldId}:no_unresolved_placeholder`,
          passed: !present,
          details: present ? `Unrendered tag ${tag} remains in output` : undefined,
        });
      } else if (postcondition === 'all_occurrences_identical') {
        const value = fieldValues[fieldId];
        if (typeof value !== 'string' || value.trim() === '') {
          // Nothing to compare when no value was supplied.
          checks.push({ name: `selector:${fieldId}:all_occurrences_identical`, passed: true });
          continue;
        }
        const anchors = migratedAnchorsByField[fieldId] ?? [];
        const leftover = anchors.filter((a) => outputText.includes(a));
        const valuePresent = outputText.includes(value);
        const passed = valuePresent && leftover.length === 0;
        checks.push({
          name: `selector:${fieldId}:all_occurrences_identical`,
          passed,
          details: passed
            ? undefined
            : leftover.length > 0
              ? `Divergent occurrence(s): source anchor(s) still present: ${leftover.join(', ')}`
              : `Field value "${value}" not found in output`,
        });
      } else if (postcondition === 'no_double_dollar') {
        const lines = outputText.split('\n').filter((l) => DOUBLE_DOLLAR.test(l));
        checks.push({
          name: `selector:${fieldId}:no_double_dollar`,
          passed: lines.length === 0,
          details: lines.length > 0 ? `Double-dollar artifact on ${lines.length} line(s)` : undefined,
        });
      }
    }
  }

  return checks;
}

/**
 * Selector postconditions, surfaced as fieldSelector `VerifyCheck` entries after fill.
 *
 * Phase 1 supports four:
 *  - `no_unresolved_placeholder` — the field's `{field_id}` tag did not survive
 *    to the output (every occurrence filled).
 *  - `all_occurrences_identical` — the field renders one value everywhere: its
 *    value is present and no selector-owned source anchor for the field remains
 *    (a remaining anchor means an occurrence rendered differently → divergence).
 *  - `no_double_dollar` — no doubled currency sigil in the output.
 *  - `no_double_percent` — no doubled percent sigil in the output. The
 *    trailing-sigil twin of `no_double_dollar`: recipes disagree about whether
 *    the replacement key absorbs the source percent sign, so a sign-carrying
 *    value that is correct for one template doubles the sign in another
 *    (issue #719).
 *
 * `no_double_percent` is deliberately unwired in this repo: the
 * `specify_percentage` manifests live under `templates/nvca-*`, which is
 * replaced wholesale by the daily legal-explainer forward sync (see
 * `.openagreements-managed-paths.json`), so setting it here would be reverted.
 * The wiring is an upstream follow-up; the engine support lands first.
 */
import type { VerifyCheck } from '../field-selector/types.js';
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
const DOUBLE_PERCENT = /%\s*%/;

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
      } else if (postcondition === 'no_double_percent') {
        const lines = outputText.split('\n').filter((l) => DOUBLE_PERCENT.test(l));
        checks.push({
          name: `selector:${fieldId}:no_double_percent`,
          passed: lines.length === 0,
          details: lines.length > 0 ? `Double-percent artifact on ${lines.length} line(s)` : undefined,
        });
      }
    }
  }

  return checks;
}

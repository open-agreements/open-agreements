/**
 * Selector-contract engine (Phase 1).
 *
 * Deterministic, drift-detecting field resolution for fieldSelectors, built on the
 * `@usejunior/docx-core` `resolveLocator` primitive. Opt-in per field via
 * `field-selectors/<id>/fields/<field_id>.json`; cutover from the legacy
 * `replacements.json` path is declared in `template-manifest.json.migrated_keys`.
 *
 * Code lives under `src/core/selectors/` (NOT `src/core/selector.ts`, the
 * existing radio/checkbox selection engine).
 */
export * from './manifest-schema.js';
export * from './loader.js';
export * from './resolve.js';
export * from './patch.js';
export * from './postconditions.js';

import { resolveSelectorContracts, type FieldResolution } from './resolve.js';
import { buildPatchOps, applySelectorPatches, serializeSelectorDoc, type PatchOp } from './patch.js';
import type { FieldSelectorManifest } from './manifest-schema.js';

export interface ApplySelectorResult {
  fields: FieldResolution[];
  /** Non-blocking messages for fields whose `failure_behavior` is `warn`. */
  warnings: string[];
  ops: PatchOp[];
}

/**
 * Resolve, gate, patch, and serialize selector contracts against a cleaned DOCX.
 *
 * Fill-time failure dispatch is governed SOLELY by each manifest's
 * `failure_behavior` (the RFC-2119 legal level is never consulted here — it lives
 * in legal-explainer):
 *  - `block_render_and_request_review` → throw (no output)
 *  - `warn` → collect a warning and continue
 *  - `skip` → continue silently
 *
 * Resolved occurrences are always patched; only unresolved occurrences / failed
 * assertions trigger the gate.
 */
export async function applySelectorContracts(
  cleanedDocxPath: string,
  outputDocxPath: string,
  manifests: FieldSelectorManifest[],
): Promise<ApplySelectorResult> {
  const { doc, fields } = await resolveSelectorContracts(cleanedDocxPath, manifests);
  const manifestById = new Map(manifests.map((m) => [m.field_id, m]));
  const warnings: string[] = [];

  for (const field of fields) {
    const manifest = manifestById.get(field.field_id);
    if (!manifest) continue;
    const problems: string[] = [];
    if (field.unresolved) problems.push('unresolved occurrence(s)');
    if (field.assertionFailures.length > 0) {
      problems.push(`${field.assertionFailures.length} assertion failure(s)`);
    }
    if (problems.length === 0) continue;

    const message = `selector field '${field.field_id}': ${problems.join('; ')}`;
    switch (manifest.failure_behavior) {
      case 'block_render_and_request_review':
        throw new Error(`Selector contract blocked render — ${message}. Review required.`);
      case 'warn':
        warnings.push(message);
        break;
      case 'skip':
        break;
    }
  }

  const ops = buildPatchOps(fields);
  applySelectorPatches(doc, ops);
  await serializeSelectorDoc(doc, outputDocxPath);
  return { fields, warnings, ops };
}

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadFieldSelectorMetadata, loadCleanConfig, loadNormalizeConfig } from '../metadata.js';
import { loadSelectionsConfig } from '../selector.js';
import { resolveFieldSelectorDir } from '../../utils/paths.js';
import { verifyOutput, extractAllText } from './verifier.js';
import { extractSearchText } from './replacement-keys.js';
import { loadSelectorContracts, evaluatePostconditions } from '../selectors/index.js';
import { ensureSourceDocx } from './downloader.js';
import {
  loadComputedProfile,
  evaluateComputedProfile,
  buildComputedArtifact,
  buildPassthroughArtifact,
  writeComputedArtifact,
} from './computed.js';
import { normalizeBracketArtifacts } from './bracket-normalizer.js';
import { runFillPipeline } from '../unified-pipeline.js';
import type { FieldSelectorRunOptions, FieldSelectorRunResult } from './types.js';
import type { ComputedValueMap } from './computed.js';

function toComputedValueMap(values: Record<string, unknown>): ComputedValueMap {
  const computedValues: ComputedValueMap = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string' || typeof value === 'boolean') {
      computedValues[key] = value;
      continue;
    }
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
      computedValues[key] = [...value];
    }
  }
  return computedValues;
}

/**
 * Run the full fieldSelector pipeline: clean → patch → fill → verify.
 * If no inputPath is provided, auto-downloads the source document from source_url.
 */
export async function runFieldSelector(options: FieldSelectorRunOptions): Promise<FieldSelectorRunResult> {
  const { fieldSelectorId, outputPath, values, keepIntermediate, computedOutPath } = options;
  const fieldSelectorDir = resolveFieldSelectorDir(fieldSelectorId);

  const metadata = loadFieldSelectorMetadata(fieldSelectorDir);
  const cleanConfig = loadCleanConfig(fieldSelectorDir);
  const normalizeConfig = loadNormalizeConfig(fieldSelectorDir);

  // Load selectionsConfig if selections.json exists (mirrors engine.ts template path)
  const selectionsPath = join(fieldSelectorDir, 'selections.json');
  const selectionsConfig = existsSync(selectionsPath)
    ? loadSelectionsConfig(selectionsPath)
    : undefined;

  // Resolve input: explicit path or auto-download
  const inputPath = options.inputPath ?? await ensureSourceDocx(fieldSelectorId, metadata);

  // Load replacements.json
  const replacementsPath = join(fieldSelectorDir, 'replacements.json');
  const replacements: Record<string, string | { value: string; format?: Record<string, unknown> }> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));
  const replacementFieldNames = new Set<string>();
  for (const rawReplacement of Object.values(replacements)) {
    const replacement = typeof rawReplacement === 'string' ? rawReplacement : rawReplacement.value;
    for (const match of replacement.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
      replacementFieldNames.add(match[1]);
    }
  }

  // Selector contracts (opt-in per field via fields/<field_id>.json). The
  // declarative migrated_keys list — NOT inference — determines which legacy
  // keys the selector engine owns. Those are removed from the dict handed to
  // the legacy patcher only; the verifier still receives the FULL key set.
  const metadataFieldNames = metadata.fields.map((f) => f.name);
  const { manifests: selectorManifests, templateManifest } = loadSelectorContracts(fieldSelectorDir, metadataFieldNames);
  const migratedKeys = new Set(templateManifest?.migrated_keys ?? []);
  const patchReplacements: typeof replacements = {};
  for (const [key, value] of Object.entries(replacements)) {
    if (migratedKeys.has(key)) continue;
    patchReplacements[key] = value;
  }
  // Map each selector field to the source anchors of its migrated keys
  // (for the all_occurrences_identical postcondition).
  const migratedAnchorsByField: Record<string, string[]> = {};
  for (const key of migratedKeys) {
    const raw = replacements[key];
    if (raw === undefined) continue;
    const valueStr = typeof raw === 'string' ? raw : raw.value;
    const fieldMatch = valueStr.match(/\{([a-zA-Z0-9_]+)\}/);
    if (!fieldMatch) continue;
    const fieldId = fieldMatch[1];
    (migratedAnchorsByField[fieldId] ??= []).push(extractSearchText(key));
  }

  const inputValues = { ...values };
  const computedInputValues = toComputedValueMap(inputValues);
  const computedProfile = loadComputedProfile(fieldSelectorDir);
  const computedEvaluation = computedProfile
    ? evaluateComputedProfile(computedProfile, computedInputValues)
    : null;
  const effectiveValues = computedEvaluation
    ? { ...inputValues, ...computedEvaluation.fillValues }
    : inputValues;
  const verificationValues: Record<string, string> = {};
  for (const field of metadata.fields) {
    if (!replacementFieldNames.has(field.name)) {
      continue;
    }
    const value = effectiveValues[field.name];
    if (typeof value === 'string') {
      verificationValues[field.name] = value;
    }
  }
  const computedArtifact = computedEvaluation && computedProfile
    ? buildComputedArtifact({
      fieldSelectorId,
      inputValues: computedInputValues,
      evaluated: computedEvaluation,
      profileVersion: computedProfile.version,
    })
    : (computedOutPath ? buildPassthroughArtifact({ fieldSelectorId, inputValues: computedInputValues }) : undefined);

  if (computedOutPath && computedArtifact) {
    writeComputedArtifact(computedOutPath, computedArtifact);
  }

  const shouldNormalizeBracketArtifacts =
    options.normalizeBracketArtifacts ?? normalizeConfig.paragraph_rules.length > 0;

  const result = await runFillPipeline({
    inputPath,
    outputPath,
    values: effectiveValues,
    fields: metadata.fields,
    priorityFieldNames: metadata.priority_fields,
    cleanPatch: { cleanConfig, replacements: patchReplacements },
    selectorManifests,
    selectionsConfig,
    postProcess: shouldNormalizeBracketArtifacts
      ? async (outputDocPath: string) => {
        await normalizeBracketArtifacts(outputDocPath, outputDocPath, {
          rules: normalizeConfig.paragraph_rules,
          fieldValues: effectiveValues,
        });
      }
      : undefined,
    verify: async (p, cleanedSourcePath) => {
      // Verifier receives the FULL replacements key set (incl. migrated keys) so
      // a selector occurrence that failed to fill is still caught as a leftover
      // source placeholder — coverage is preserved after migration.
      // cleanedSourcePath baselines pre-existing formatting anomalies so only
      // fill-introduced ones are reported.
      const base = await verifyOutput(p, verificationValues, replacements, cleanConfig, cleanedSourcePath);
      if (selectorManifests.length === 0) return base;
      const fieldValues: Record<string, string> = {};
      for (const manifest of selectorManifests) {
        const v = effectiveValues[manifest.field_id];
        if (typeof v === 'string') fieldValues[manifest.field_id] = v;
      }
      const postconditionChecks = evaluatePostconditions({
        outputText: extractAllText(p),
        manifests: selectorManifests,
        fieldValues,
        migratedAnchorsByField,
      });
      return {
        passed: base.passed && postconditionChecks.every((c) => c.passed),
        checks: [...base.checks, ...postconditionChecks],
      };
    },
    keepIntermediate,
  });

  return {
    outputPath: result.outputPath,
    metadata,
    fieldsUsed: result.fieldsUsed,
    providedFieldsUsed: result.providedFieldsUsed,
    fillCommandCount: result.fillCommandCount,
    warnings: result.warnings,
    stages: result.stages!,
    computedArtifact,
    computedOutPath,
  };
}

export { cleanDocument } from './cleaner.js';
export type { CleanResult, CleanOptions } from './cleaner.js';
export { patchDocument } from './patcher.js';
export type { PatchResult } from './patcher.js';
export { verifyOutput, normalizeText, extractAllText, countFormattingAnomalies } from './verifier.js';
export { ensureSourceDocx } from './downloader.js';
export { checkFieldSelectorSourceDrift, checkSelectorDrift, computeSourceStructureSignature } from './source-drift.js';
export { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';
export type { OoxmlTextParts } from './ooxml-parts.js';
export type { FieldSelectorRunOptions, FieldSelectorRunResult, VerifyResult, VerifyCheck } from './types.js';
export type { ComputedArtifact, ComputedProfile } from './computed.js';

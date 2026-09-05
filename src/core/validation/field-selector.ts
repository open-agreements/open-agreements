import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateFieldSelectorMetadata, loadFieldSelectorMetadata } from '../metadata.js';
import { CleanConfigSchema } from '../metadata.js';
import { NormalizeConfigSchema } from '../metadata.js';
import { parseReplacementKey } from '../field-selector/replacement-keys.js';
import { ComputedProfileSchema, type ComputedProfile } from '../field-selector/computed.js';
import type { NormalizeConfig } from '../metadata.js';
import { SelectionsConfigSchema, type SelectionsConfig } from '../selector.js';
import { loadSelectorContracts } from '../selectors/loader.js';
import { AnchoredParagraphBindingsConfigSchema, type AnchoredParagraphBindingsConfig } from '../field-selector/anchored-paragraph-bindings.js';
import { RepeatableTablesConfigSchema, type RepeatableTablesConfig } from '../field-selector/repeatable-tables.js';
import { ReferenceFieldsConfigSchema } from '../field-selector/reference-fields.js';

export interface FieldSelectorValidationResult {
  fieldSelectorId: string;
  valid: boolean;
  scaffold: boolean;
  errors: string[];
  warnings: string[];
}

/** Pattern for valid template tags within replacement values */
const TAG_RE = /\{[a-z_][a-z0-9_]*\}/g;
/** Pattern for any curly-brace token (to detect control tags) */
const ANY_BRACE_RE = /\{[^}]+\}/g;
/** Only simple identifiers inside braces are allowed */
const SAFE_TAG_RE = /^\{[a-z_][a-z0-9_]*\}$/;

/**
 * Validate a fieldSelector directory:
 * - No .docx files (copyrighted content must not be committed)
 * - metadata.yaml validates against schema
 * - For non-scaffold fieldSelectors: replacements.json present and valid
 * - Replacement values may be literal text, empty cleanup replacements, or
 *   valid {identifier} tags
 * - In strict mode: scaffolds are errors, all files required
 */
export function validateFieldSelector(
  fieldSelectorDir: string,
  fieldSelectorId: string,
  options?: { strict?: boolean }
): FieldSelectorValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const strict = options?.strict ?? false;

  // Check for .docx files (forbidden in fieldSelector dirs)
  const files = readdirSync(fieldSelectorDir);
  const docxFiles = files.filter((f) => f.toLowerCase().endsWith('.docx'));
  if (docxFiles.length > 0) {
    errors.push(`Copyrighted .docx file(s) found: ${docxFiles.join(', ')}. FieldSelectors must not contain source documents.`);
  }

  // Validate metadata
  const metaResult = validateFieldSelectorMetadata(fieldSelectorDir);
  if (!metaResult.valid) {
    errors.push(...metaResult.errors.map((e) => `metadata: ${e}`));
    return { fieldSelectorId, valid: false, scaffold: false, errors, warnings };
  }

  // Scaffold detection: if only metadata.yaml exists, this is a scaffold
  const metadata = loadFieldSelectorMetadata(fieldSelectorDir);
  const metadataFieldNames = new Set(metadata.fields.map((field) => field.name));
  const computedPath = join(fieldSelectorDir, 'computed.json');
  const hasReplacements = existsSync(join(fieldSelectorDir, 'replacements.json'));
  const isScaffold = !hasReplacements;

  // Inputs for the binding-reachability rule (issue #621). Any parse failure
  // below records its own error and clears this flag so the reachability rule
  // does not cascade spurious "unbound field" errors on top of a parse error.
  let reachabilityInputsOk = true;
  let computedProfile: ComputedProfile | undefined;
  let normalizeConfig: NormalizeConfig | undefined;
  let selectionsConfig: SelectionsConfig | undefined;
  let anchoredBindingsConfig: AnchoredParagraphBindingsConfig | undefined;
  let repeatableTablesConfig: RepeatableTablesConfig | undefined;
  let replacementsRecord: Record<string, unknown> | undefined;
  /** Field names referenced by at least one {tag} in a replacements.json value. */
  const replacementBoundFields = new Set<string>();

  // Validate computed.json if present
  let computedSetFillFields: Set<string> | undefined;
  if (existsSync(computedPath)) {
    try {
      const raw = readFileSync(computedPath, 'utf-8');
      const profile = ComputedProfileSchema.parse(JSON.parse(raw));
      computedProfile = profile;

      // Collect all fields targeted by defaults or set_fill rules
      computedSetFillFields = new Set<string>();
      for (const field of Object.keys(profile.defaults)) {
        computedSetFillFields.add(field);
      }
      for (const rule of profile.rules) {
        for (const field of Object.keys(rule.set_fill)) {
          computedSetFillFields.add(field);
        }
      }

      // Validate: computed set_fill fields must not have non-empty metadata defaults.
      // When computed.json owns a field, metadata should declare default: "" (or omit it)
      // so that the computed rule is the single source of truth for that field's value.
      for (const field of computedSetFillFields) {
        const metaField = metadata.fields.find((f) => f.name === field);
        if (metaField && metaField.default !== undefined && metaField.default !== '') {
          errors.push(
            `computed/metadata conflict: field "${field}" is set by computed.json set_fill ` +
            `but has non-empty metadata default "${metaField.default}". ` +
            `Computed-owned fields must use default: "" to avoid conflicting values.`
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'invalid format';
      errors.push(`computed.json: ${message}`);
      reachabilityInputsOk = false;
    }
  }

  if (isScaffold) {
    if (strict) {
      errors.push('Scaffold fieldSelector (metadata-only): not runnable. Use non-strict mode to allow scaffolds.');
    } else {
      warnings.push('Scaffold fieldSelector (metadata-only): not runnable');
    }
    return { fieldSelectorId, valid: errors.length === 0, scaffold: true, errors, warnings };
  }

  // Validate replacements.json for runnable fieldSelectors.
  try {
    const raw = readFileSync(join(fieldSelectorDir, 'replacements.json'), 'utf-8');
    const replacements = JSON.parse(raw);
    if (typeof replacements !== 'object' || replacements === null) {
      errors.push('replacements.json must be a JSON object');
      reachabilityInputsOk = false;
    } else {
      replacementsRecord = replacements as Record<string, unknown>;
      const unknownTargets = new Set<string>();
      for (const [key, rawValue] of Object.entries(replacements)) {
        // Value can be a string or { value: string, format?: object }
        let value: string;
        if (typeof rawValue === 'string') {
          value = rawValue;
        } else if (typeof rawValue === 'object' && rawValue !== null && typeof (rawValue as Record<string, unknown>).value === 'string') {
          value = (rawValue as Record<string, unknown>).value as string;
        } else {
          errors.push(`replacements.json: value for "${key}" must be a string or { value: string, format?: object }`);
          continue;
        }

        // All curly-brace tokens in value must be safe identifiers (no control tags)
        const allBraces = value.match(ANY_BRACE_RE);
        if (allBraces) {
          for (const token of allBraces) {
            if (!SAFE_TAG_RE.test(token)) {
              errors.push(
                `replacements.json: unsafe tag "${token}" in value for "${key}". Only {identifier} tags allowed.`
              );
              continue;
            }
            const fieldName = token.slice(1, -1);
            replacementBoundFields.add(fieldName);
            if (!metadataFieldNames.has(fieldName)) {
              unknownTargets.add(fieldName);
            }
          }
        }

        // Value must not contain the source key (infinite loop prevention)
        // For qualified keys, check against the searchText, not the full key.
        const parsed = parseReplacementKey(key, value);
        if (parsed.type === 'simple' && value.includes(parsed.searchText)) {
          errors.push(
            `replacements.json: value for "${key}" contains the key itself (would cause infinite loop)`
          );
        } else if (parsed.type === 'context' && value.includes(parsed.searchText)) {
          errors.push(
            `replacements.json: value for "${key}" contains the search text "${parsed.searchText}" (would cause infinite loop)`
          );
        }
      }
      for (const fieldName of unknownTargets) {
        warnings.push(`Replacement target {${fieldName}} not found in metadata fields`);
      }
    }
  } catch (err) {
    errors.push(`replacements.json: ${(err as Error).message}`);
    reachabilityInputsOk = false;
  }

  // Validate clean.json if present
  const referenceFieldsPath = join(fieldSelectorDir, 'reference-fields.json');
  if (existsSync(referenceFieldsPath)) {
    try {
      ReferenceFieldsConfigSchema.parse(JSON.parse(readFileSync(referenceFieldsPath, 'utf-8')));
    } catch (err) {
      errors.push(`reference-fields.json: ${err instanceof Error ? err.message : 'invalid format'}`);
    }
  }

  // Validate clean.json if present
  const cleanPath = join(fieldSelectorDir, 'clean.json');
  if (existsSync(cleanPath)) {
    try {
      const raw = readFileSync(cleanPath, 'utf-8');
      CleanConfigSchema.parse(JSON.parse(raw));
    } catch {
      errors.push(`clean.json: invalid format`);
    }
  }

  // Validate normalize.json if present
  const normalizePath = join(fieldSelectorDir, 'normalize.json');
  if (existsSync(normalizePath)) {
    try {
      const raw = readFileSync(normalizePath, 'utf-8');
      normalizeConfig = NormalizeConfigSchema.parse(JSON.parse(raw));
    } catch {
      errors.push('normalize.json: invalid format');
      reachabilityInputsOk = false;
    }
  }

  // Validate selections.json if present (needed as a reachability input:
  // a selections trigger is a document-affecting binding).
  const selectionsPath = join(fieldSelectorDir, 'selections.json');
  if (existsSync(selectionsPath)) {
    try {
      const raw = readFileSync(selectionsPath, 'utf-8');
      selectionsConfig = SelectionsConfigSchema.parse(JSON.parse(raw));
    } catch {
      errors.push('selections.json: invalid format');
      reachabilityInputsOk = false;
    }
  }

  const anchoredBindingsPath = join(fieldSelectorDir, 'anchored-paragraph-bindings.json');
  if (existsSync(anchoredBindingsPath)) {
    try {
      anchoredBindingsConfig = AnchoredParagraphBindingsConfigSchema.parse(
        JSON.parse(readFileSync(anchoredBindingsPath, 'utf-8')),
      );
    } catch {
      errors.push('anchored-paragraph-bindings.json: invalid format');
      reachabilityInputsOk = false;
    }
  }

  const repeatableTablesPath = join(fieldSelectorDir, 'repeatable-tables.json');
  if (existsSync(repeatableTablesPath)) {
    try {
      repeatableTablesConfig = RepeatableTablesConfigSchema.parse(
        JSON.parse(readFileSync(repeatableTablesPath, 'utf-8')),
      );
    } catch {
      errors.push('repeatable-tables.json: invalid format');
      reachabilityInputsOk = false;
    }
  }

  // Load selector contracts (fields/*.json + template-manifest.json). The
  // loader schema already enforces that every recipe declares at least one
  // occurrence locator, so a loaded recipe is a nonempty selector manifest.
  let selectorRecipeFields = new Set<string>();
  let migratedKeys: string[] = [];
  let contractsOk = true;
  try {
    const { manifests, templateManifest } = loadSelectorContracts(fieldSelectorDir, metadataFieldNames);
    selectorRecipeFields = new Set(manifests.map((m) => m.field_id));
    migratedKeys = templateManifest?.migrated_keys ?? [];
  } catch (err) {
    errors.push(`selector contracts: ${(err as Error).message}`);
    reachabilityInputsOk = false;
    contractsOk = false;
  }

  // --- Binding reachability (issue #621) ---
  // Every field published in metadata.yaml must reach a document-affecting
  // binding: metadata field → (optional computed.json transformation chain) →
  // terminal binding, where a terminal binding is a replacements.json value
  // {tag}, a fields/<name>.json selector recipe, a selections.json trigger,
  // or a normalize.json replacement value {tag}. A field mentioned only in a
  // computed predicate whose rule leads nowhere, or only in an audit-only
  // (set_audit) assignment, is NOT reachable.
  if (reachabilityInputsOk && replacementsRecord) {
    const reachable = new Set<string>(replacementBoundFields);
    for (const fieldId of selectorRecipeFields) {
      reachable.add(fieldId);
    }
    if (selectionsConfig) {
      for (const group of selectionsConfig.groups) {
        for (const option of group.options) {
          if (typeof option.trigger === 'object' && option.trigger !== null) {
            reachable.add(option.trigger.field);
          }
          if (option.replaceWith) {
            for (const tag of option.replaceWith.match(TAG_RE) ?? []) {
              reachable.add(tag.slice(1, -1));
            }
          }
        }
      }
    }
    if (normalizeConfig) {
      for (const rule of normalizeConfig.paragraph_rules) {
        for (const value of Object.values(rule.replacements ?? {})) {
          for (const tag of value.match(TAG_RE) ?? []) {
            reachable.add(tag.slice(1, -1));
          }
        }
      }
    }
    for (const group of anchoredBindingsConfig?.groups ?? []) {
      for (const binding of group.bindings) reachable.add(binding.field);
    }
    for (const table of repeatableTablesConfig?.tables ?? []) {
      reachable.add(table.rows_field);
    }

    // Propagate reachability backwards through computed.json to a fixpoint.
    // A rule with at least one reachable set_fill target makes two kinds of
    // inputs document-affecting:
    //   1. the fields its when_all/when_any predicates read (they gate the
    //      assignment), and
    //   2. the fields referenced via ${name} interpolation inside a REACHABLE
    //      target's assigned value (the evaluator's interpolate() substitutes
    //      them into the value that reaches the document).
    // set_audit assignments do not propagate (audit-only), interpolation refs
    // in an UNreachable target's value do not count, and defaults are applied
    // verbatim (never interpolated), so they have no input fields to propagate to.
    if (computedProfile) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const rule of computedProfile.rules) {
          const reachableAssignments = Object.entries(rule.set_fill)
            .filter(([target]) => reachable.has(target));
          if (reachableAssignments.length === 0) continue;
          for (const predicate of [...rule.when_all, ...rule.when_any]) {
            if (!reachable.has(predicate.field)) {
              reachable.add(predicate.field);
              changed = true;
            }
          }
          for (const [, assigned] of reachableAssignments) {
            if (typeof assigned !== 'string') continue;
            for (const match of assigned.matchAll(/\$\{([A-Za-z0-9_]+)\}/g)) {
              if (!reachable.has(match[1])) {
                reachable.add(match[1]);
                changed = true;
              }
            }
          }
        }
      }
    }

    // Only top-level metadata.fields are checked: nested `items` sub-fields
    // exist for {FOR}-loop collections in ordinary redistributable templates
    // (validated by validation/template.ts) and are not independently bindable
    // field-selector inputs — a field-selector binds the collection field's
    // own {tag}, which this loop covers.
    for (const field of metadata.fields) {
      if (!reachable.has(field.name)) {
        errors.push(
          `unbound field "${field.name}": published in metadata.yaml but reaches no ` +
          `document-affecting binding (no replacements.json value tag, ` +
          `fields/${field.name}.json selector recipe, selections.json trigger, ` +
          `normalize.json replacement tag, or computed.json chain ending in one). ` +
          `Wire it to a binding or unpublish it (issue #621).`
        );
      }
    }
  }

  // --- Migrated-key integrity (issue #621, stricter selector-template rule) ---
  // Every template-manifest.json migrated key must (a) exist in
  // replacements.json and (b) map to a field with a nonempty selector
  // manifest — otherwise the key is withheld from the legacy patcher but no
  // selector recipe writes it, so the fill silently no-ops (#607 class).
  if (contractsOk && replacementsRecord) {
    for (const key of migratedKeys) {
      const rawValue = replacementsRecord[key];
      if (rawValue === undefined) {
        errors.push(
          `template-manifest.json: migrated key "${key}" not found in replacements.json — ` +
          `the selector engine owns a key that no replacement declares`
        );
        continue;
      }
      const value = typeof rawValue === 'string'
        ? rawValue
        : (typeof rawValue === 'object' && rawValue !== null && typeof (rawValue as Record<string, unknown>).value === 'string'
          ? (rawValue as Record<string, unknown>).value as string
          : undefined);
      if (value === undefined) continue; // malformed value already reported above
      const tagFields = (value.match(TAG_RE) ?? []).map((tag) => tag.slice(1, -1));
      // Literal and empty replacements are handled by the legacy patcher and
      // therefore have no selector field whose ownership can be checked.
      if (tagFields.length === 0) continue;
      const missingRecipes = tagFields.filter((f) => !selectorRecipeFields.has(f));
      for (const fieldName of missingRecipes) {
        errors.push(
          `template-manifest.json: migrated key "${key}" maps to field "${fieldName}" ` +
          `which has no fields/${fieldName}.json selector recipe — the key is withheld ` +
          `from the legacy patcher but nothing else writes it`
        );
      }
    }
  }

  // Warn if source_sha256 is missing (fill will skip integrity verification)
  if (!metadata.source_sha256) {
    warnings.push('No source_sha256 in metadata — fill will skip integrity verification');
  }

  return { fieldSelectorId, valid: errors.length === 0, scaffold: false, errors, warnings };
}

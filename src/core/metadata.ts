import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export const LicenseEnum = z.enum(['CC-BY-4.0', 'CC0-1.0', 'CC-BY-ND-4.0']);
export type License = z.infer<typeof LicenseEnum>;

const FieldTypeEnum = z.enum(['string', 'date', 'number', 'boolean', 'enum', 'array']);
export type FieldType = z.infer<typeof FieldTypeEnum>;

export interface FieldDefinition {
  name: string;
  type: FieldType;
  description: string;
  default?: string;
  default_value_rationale?: string;
  options?: string[];
  section?: string;
  items?: FieldDefinition[];
}

export const FieldDefinitionSchema: z.ZodType<FieldDefinition> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: FieldTypeEnum,
    description: z.string(),
    default: z.string().optional(),
    default_value_rationale: z.string().optional(),
    options: z.array(z.string()).optional(),
    section: z.string().optional(),
    items: z.array(FieldDefinitionSchema).nonempty().optional(),
  }).superRefine((field, ctx) => {
    if (field.type === 'enum' && (field.options === undefined || field.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Fields with type "enum" must have a non-empty options array',
      });
    }

    if (field.items !== undefined && field.type !== 'array') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'Only fields with type "array" may define nested items',
      });
    }

    if (field.default !== undefined) {
      if (field.type === 'number' && isNaN(Number(field.default))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['default'],
          message: 'Default value must be valid for the declared field type',
        });
      }

      if (field.type === 'boolean' && field.default !== 'true' && field.default !== 'false') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['default'],
          message: 'Default value must be valid for the declared field type',
        });
      }
    }
  })
);

function validatePriorityFields(
  fields: FieldDefinition[],
  priorityFields: string[],
  ctx: z.RefinementCtx
): void {
  const fieldNames = new Set(fields.map((field) => field.name));
  const seen = new Set<string>();

  priorityFields.forEach((fieldName, index) => {
    if (seen.has(fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priority_fields', index],
        message: `Duplicate priority field "${fieldName}"`,
      });
      return;
    }
    seen.add(fieldName);
    if (!fieldNames.has(fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priority_fields', index],
        message: `Priority field "${fieldName}" is not defined in fields`,
      });
    }
  });
}

const TemplateMetadataBaseSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  source_url: z.string().url(),
  version: z.string(),
  license: LicenseEnum,
  allow_derivatives: z.boolean(),
  attribution_text: z.string(),
  fields: z.array(FieldDefinitionSchema),
  priority_fields: z.array(z.string()).default([]),
});

export const TemplateMetadataSchema = TemplateMetadataBaseSchema.superRefine((meta, ctx) => {
  validatePriorityFields(meta.fields, meta.priority_fields, ctx);
});
export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

// --- External template schemas ---

export const ExternalMetadataSchema = TemplateMetadataBaseSchema.extend({
  source_sha256: z.string(),
}).superRefine((meta, ctx) => {
  validatePriorityFields(meta.fields, meta.priority_fields, ctx);
});
export type ExternalMetadata = z.infer<typeof ExternalMetadataSchema>;

// --- Recipe schemas ---

export const CleanConfigSchema = z.object({
  removeFootnotes: z.boolean().default(false),
  removeBeforePattern: z.string().optional(),
  removeParagraphPatterns: z.array(z.string()).default([]),
  removeRanges: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })).default([]),
  clearParts: z.array(z.string()).default([]),
});
export type CleanConfig = z.infer<typeof CleanConfigSchema>;

export const DeclarativeParagraphNormalizeRuleSchema = z.object({
  id: z.string(),
  section_heading: z.string(),
  section_heading_any: z.array(z.string()).optional(),
  ignore_heading: z.boolean().optional(),
  paragraph_contains: z.string(),
  paragraph_end_contains: z.string().optional(),
  replacements: z.record(z.string(), z.string()).optional(),
  trim_unmatched_trailing_bracket: z.boolean().optional(),
  expected_min_matches: z.number().int().nonnegative().optional(),
});
export type DeclarativeParagraphNormalizeRule = z.infer<typeof DeclarativeParagraphNormalizeRuleSchema>;

export const NormalizeConfigSchema = z.object({
  paragraph_rules: z.array(DeclarativeParagraphNormalizeRuleSchema).default([]),
});
export type NormalizeConfig = z.infer<typeof NormalizeConfigSchema>;

export const GuidanceEntrySchema = z.object({
  source: z.enum(['footnote', 'pattern', 'range']),
  part: z.string(),
  index: z.number(),
  text: z.string(),
  groupId: z.string().optional(),
});
export type GuidanceEntry = z.infer<typeof GuidanceEntrySchema>;

export const GuidanceOutputSchema = z.object({
  extractedFrom: z.object({
    sourceHash: z.string(),
    configHash: z.string(),
  }),
  entries: z.array(GuidanceEntrySchema),
});
export type GuidanceOutput = z.infer<typeof GuidanceOutputSchema>;

const MarketDataCitationSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string().optional(),
});

export const RecipeMetadataSchema = z.object({
  name: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  source_url: z.string().url(),
  source_version: z.string(),
  license_note: z.string(),
  optional: z.boolean().default(false),
  source_sha256: z.string().optional(),
  fields: z.array(FieldDefinitionSchema).default([]),
  priority_fields: z.array(z.string()).default([]),
  market_data_citations: z.array(MarketDataCitationSchema).optional(),
}).superRefine((meta, ctx) => {
  validatePriorityFields(meta.fields, meta.priority_fields, ctx);
});
export type RecipeMetadata = z.infer<typeof RecipeMetadataSchema>;

// --- legal-context sidecar ---
//
// When a template has a sibling metadata.legal-context.yaml, it is a GENERATED
// artifact carrying curated defaults and rationales for a specific subset of
// field keys (see docs/two-sidecar-metadata-ownership.md).
//
// The sidecar may only set these keys per field, chosen so legal-context owns
// the research-derived values and nothing else:
//   - default
//   - default_value_rationale
//   - options
//   - display
//
// Merge contract (per-field, owned-key replace — NOT a deep merge):
//   * Fields present in both files: sidecar REPLACES those four keys on
//     metadata.yaml's field object; every other key (name, type, description,
//     section, items, etc.) comes from metadata.yaml unchanged.
//   * Fields present only in metadata.yaml: pass through unchanged (this is
//     how fields not yet under editorial ownership keep their hand-authored
//     shape).
//   * Fields present only in the sidecar (i.e. name doesn't match any
//     metadata.yaml field): THROWS. Silently dropping them would hide a real
//     field rename or stale sidecar entry, re-creating the drift the two-file
//     split is meant to prevent.
//
// Single-ownership rule: if the sidecar sets an owned key for a field, the
// sibling metadata.yaml MUST NOT also set that same key on that field. This
// rule is checked at merge time here and by the open-agreements CI lint at
// scripts/validate_metadata_sidecar.mjs. Violating it means two files claim
// ownership of the same value — the exact ambiguity this architecture exists
// to prevent.
//
// After merge, the effective metadata is re-validated against the full
// TemplateMetadataSchema so a sidecar can't inject values that violate the
// field's declared type (e.g. a string default on a boolean-typed field).

const OWNED_SIDECAR_KEYS = ['default', 'default_value_rationale', 'options', 'display'] as const;
type OwnedSidecarKey = typeof OWNED_SIDECAR_KEYS[number];

const SidecarFieldSchema = z.object({
  name: z.string(),
  default: z.string().optional(),
  default_value_rationale: z.string().optional(),
  options: z.array(z.string()).optional(),
  display: z.record(z.string(), z.unknown()).optional(),
}).strict();

const SidecarSchema = z.object({
  fields: z.array(SidecarFieldSchema).default([]),
}).strict().superRefine((sidecar, ctx) => {
  const seen = new Set<string>();
  sidecar.fields.forEach((entry, idx) => {
    if (seen.has(entry.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fields', idx, 'name'],
        message:
          `Duplicate sidecar entry for field "${entry.name}". ` +
          `Each field may appear at most once in metadata.legal-context.yaml.`,
      });
    }
    seen.add(entry.name);
  });
});

export type LegalContextSidecar = z.infer<typeof SidecarSchema>;

export function loadLegalContextSidecar(templateDir: string): LegalContextSidecar | null {
  const sidecarPath = join(templateDir, 'metadata.legal-context.yaml');
  if (!existsSync(sidecarPath)) {
    return null;
  }
  const raw = readFileSync(sidecarPath, 'utf-8');
  const parsed = yaml.load(raw);
  return SidecarSchema.parse(parsed);
}

function mergeSidecarIntoFields(
  fields: FieldDefinition[],
  sidecar: LegalContextSidecar,
  templateDir: string,
): FieldDefinition[] {
  const overrides = new Map<string, Record<OwnedSidecarKey, unknown>>();
  for (const entry of sidecar.fields) {
    const owned: Partial<Record<OwnedSidecarKey, unknown>> = {};
    for (const key of OWNED_SIDECAR_KEYS) {
      if (entry[key] !== undefined) {
        owned[key] = entry[key];
      }
    }
    overrides.set(entry.name, owned as Record<OwnedSidecarKey, unknown>);
  }

  const conflicts: string[] = [];
  const applied = new Set<string>();
  const fieldNames = new Set(fields.map((f) => f.name));
  const merged = fields.map((field) => {
    const override = overrides.get(field.name);
    if (!override) return field;
    // Single-ownership rule: metadata.yaml must not also set an owned key
    // for a field that the sidecar is managing. We don't "silently prefer
    // the sidecar"; that would mask dead data in metadata.yaml and re-open
    // the drift surface the two-file split exists to prevent.
    for (const key of OWNED_SIDECAR_KEYS) {
      if (Object.prototype.hasOwnProperty.call(field, key)) {
        conflicts.push(`${field.name}.${key}`);
      }
    }
    applied.add(field.name);
    const mergedField: Record<string, unknown> = { ...field };
    for (const [k, v] of Object.entries(override)) {
      mergedField[k] = v;
    }
    return mergedField as unknown as FieldDefinition;
  });

  if (conflicts.length > 0) {
    throw new Error(
      `Single-ownership violation in ${templateDir}: ` +
      `metadata.yaml declares owned key(s) for sidecar-managed field(s): ` +
      `${conflicts.join(', ')}. Remove these keys from metadata.yaml; the ` +
      `sidecar is authoritative for them. See docs/two-sidecar-metadata-ownership.md.`,
    );
  }

  const orphans = [...overrides.keys()].filter((name) => !applied.has(name));
  if (orphans.length > 0) {
    // Sidecar-only fields imply a rename or stale entry. Silently dropping
    // them would mean the template appears to render cleanly while carrying
    // dead sidecar content — exactly the drift we're preventing.
    throw new Error(
      `Sidecar at ${templateDir} references unknown field(s): ` +
      `${orphans.join(', ')}. ` +
      `Existing fields in metadata.yaml: ${[...fieldNames].join(', ')}. ` +
      `Either the field was renamed/removed in metadata.yaml (regenerate the ` +
      `sidecar) or the sidecar carries a stale entry.`,
    );
  }

  return merged;
}

// --- Template loaders ---

export function loadMetadata(templateDir: string): TemplateMetadata {
  const metadataPath = join(templateDir, 'metadata.yaml');
  const raw = readFileSync(metadataPath, 'utf-8');
  const parsed = yaml.load(raw);
  const metadata = TemplateMetadataSchema.parse(parsed);

  const sidecar = loadLegalContextSidecar(templateDir);
  if (!sidecar) {
    return metadata;
  }

  const mergedFields = mergeSidecarIntoFields(metadata.fields, sidecar, templateDir);
  // Re-validate the effective metadata so a sidecar can't inject a value
  // that violates the field's declared type (e.g. a string default on a
  // boolean-typed field). Without this step, TemplateMetadataSchema checks
  // only the raw metadata.yaml and returns success for invalid merged state.
  return TemplateMetadataSchema.parse({ ...metadata, fields: mergedFields });
}

export function validateMetadata(templateDir: string): { valid: boolean; errors: string[] } {
  try {
    loadMetadata(templateDir);
    return { valid: true, errors: [] };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        valid: false,
        errors: err.issues.map(
          (i) => `${i.path.join('.')}: ${i.message}`
        ),
      };
    }
    return { valid: false, errors: [(err as Error).message] };
  }
}

// --- External template loaders ---

export function loadExternalMetadata(externalDir: string): ExternalMetadata {
  const metadataPath = join(externalDir, 'metadata.yaml');
  const raw = readFileSync(metadataPath, 'utf-8');
  const parsed = yaml.load(raw);
  return ExternalMetadataSchema.parse(parsed);
}

export function validateExternalMetadata(externalDir: string): { valid: boolean; errors: string[] } {
  try {
    loadExternalMetadata(externalDir);
    return { valid: true, errors: [] };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        valid: false,
        errors: err.issues.map(
          (i) => `${i.path.join('.')}: ${i.message}`
        ),
      };
    }
    return { valid: false, errors: [(err as Error).message] };
  }
}

// --- Recipe loaders ---

export function loadRecipeMetadata(recipeDir: string): RecipeMetadata {
  const metadataPath = join(recipeDir, 'metadata.yaml');
  const raw = readFileSync(metadataPath, 'utf-8');
  const parsed = yaml.load(raw);
  return RecipeMetadataSchema.parse(parsed);
}

export function loadCleanConfig(recipeDir: string): CleanConfig {
  const cleanPath = join(recipeDir, 'clean.json');
  if (!existsSync(cleanPath)) {
    return { removeFootnotes: false, removeParagraphPatterns: [], removeRanges: [], clearParts: [] };
  }
  const raw = readFileSync(cleanPath, 'utf-8');
  return CleanConfigSchema.parse(JSON.parse(raw));
}

export function loadNormalizeConfig(recipeDir: string): NormalizeConfig {
  const normalizePath = join(recipeDir, 'normalize.json');
  if (!existsSync(normalizePath)) {
    return { paragraph_rules: [] };
  }
  const raw = readFileSync(normalizePath, 'utf-8');
  return NormalizeConfigSchema.parse(JSON.parse(raw));
}

export function validateRecipeMetadata(recipeDir: string): { valid: boolean; errors: string[] } {
  try {
    loadRecipeMetadata(recipeDir);
    return { valid: true, errors: [] };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        valid: false,
        errors: err.issues.map(
          (i) => `${i.path.join('.')}: ${i.message}`
        ),
      };
    }
    return { valid: false, errors: [(err as Error).message] };
  }
}

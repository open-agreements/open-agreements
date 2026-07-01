import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

/**
 * License values accepted by template metadata.
 *
 * CC-BY-4.0 and CC0-1.0 templates may be redistributed as OpenAgreements
 * content. CC-BY-ND-4.0 templates are vendored only when unmodified and must
 * declare `allow_derivatives: false`.
 */
export const LicenseEnum = z.enum(['CC-BY-4.0', 'CC0-1.0', 'CC-BY-ND-4.0']);
export type License = z.infer<typeof LicenseEnum>;

/** Field kinds supported by template, external-template, and fieldSelector metadata. */
const FieldTypeEnum = z.enum(['string', 'date', 'number', 'boolean', 'enum', 'array', 'multiselect']);
export type FieldType = z.infer<typeof FieldTypeEnum>;
const MULTISELECT_OPTION_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Metadata definition for a fillable field.
 *
 * `name`, `type`, and `description` are required. `enum` and `multiselect`
 * fields must declare non-empty `options`; `array` fields may declare nested
 * `items`; `display_label` is a presentation hint and never replaces `name`.
 */
export interface FieldDefinition {
  name: string;
  type: FieldType;
  description: string;
  display_label?: string;
  default?: string;
  default_value_rationale?: string;
  options?: string[];
  derive_booleans?: boolean;
  section?: string;
  items?: FieldDefinition[];
  /**
   * Marks this boolean field as a *statutory compliance representation*: its
   * `true` value asserts a past real-world fact that is a statutory precondition
   * to the agreement's enforceability/validity (e.g. a required advance notice
   * or written advisal that must actually have been given before signing).
   *
   * Deliberately NARROW — opt-in per field and reserved for the few reps that
   * gate enforceability, NOT general representations (a purchase agreement may
   * carry dozens of ordinary reps that should not all demand per-rep
   * confirmation). When set, the field MUST be boolean with `default: 'false'`
   * and MUST declare `authority_url`. A template clause references it via the
   * renderer's `confirm=` directive, which renders the recital clean when the
   * field is true and as a highlighted `[CONFIRM …]` bracket when it is false
   * (never silently dropped). The broad confirmation warning rides in
   * `description`; the short reason shown inside the rendered bracket rides in
   * `confirm_note`.
   */
  statutory_compliance_representation?: boolean;
  /**
   * Statute / practice-note link used as the learn-more reference for a
   * `statutory_compliance_representation` field (surfaced in the field
   * description and the rendered `[CONFIRM …; see <authority_url>]` bracket).
   * Only valid on a `statutory_compliance_representation` field.
   */
  authority_url?: string;
  /**
   * Short, human-readable reason rendered inside the
   * `[CONFIRM before signing: <confirm_note>; see <authority_url>]` bracket of a
   * `statutory_compliance_representation` field. This is the single source of
   * truth for the bracket note — a `confirm=<field>` clause directive resolves
   * it from here rather than restating it. Only valid on (and required for) a
   * `statutory_compliance_representation` field.
   */
  confirm_note?: string;
}

export const FieldDefinitionSchema: z.ZodType<FieldDefinition> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: FieldTypeEnum,
    description: z.string(),
    display_label: z.string().optional(),
    // Accept YAML-native scalar defaults (`default: false`, `default: 5`) by
    // coercing to their string form before validation. Generated template
    // metadata serializes booleans/numbers natively; downstream code already
    // treats `default` as a string (e.g. JSON.parse(field.default), the
    // `=== 'false'` checks), and String(false) === 'false' is value-preserving.
    default: z.preprocess(
      (v) => (typeof v === 'boolean' || typeof v === 'number' ? String(v) : v),
      z.string().optional(),
    ),
    default_value_rationale: z.string().optional(),
    options: z.array(z.string()).optional(),
    derive_booleans: z.boolean().optional(),
    section: z.string().optional(),
    items: z.array(FieldDefinitionSchema).nonempty().optional(),
    statutory_compliance_representation: z.boolean().optional(),
    authority_url: z.string().optional(),
    confirm_note: z.string().optional(),
  }).superRefine((field, ctx) => {
    if (
      (field.type === 'enum' || field.type === 'multiselect') &&
      (field.options === undefined || field.options.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: `Fields with type "${field.type}" must have a non-empty options array`,
      });
    }

    if (field.type === 'multiselect' && field.options) {
      const seenOptions = new Set<string>();
      field.options.forEach((option, index) => {
        if (!MULTISELECT_OPTION_RE.test(option)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['options', index],
            message: 'Multiselect options must be valid identifiers matching /^[A-Za-z_][A-Za-z0-9_]*$/',
          });
        }
        if (seenOptions.has(option)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['options', index],
            message: `Duplicate multiselect option "${option}"`,
          });
          return;
        }
        seenOptions.add(option);
      });
    }

    if (field.derive_booleans !== undefined && field.type !== 'multiselect') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['derive_booleans'],
        message: 'derive_booleans is only valid for fields with type "multiselect"',
      });
    }

    if (field.items !== undefined && field.type !== 'array') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'Only fields with type "array" may define nested items',
      });
    }

    // `statutory_compliance_representation` is a NARROW opt-in category for the
    // few boolean reps whose truth is a statutory precondition to
    // enforceability. Enforce its shape so the renderer's `confirm=` mechanism
    // and the get_template confirmation surface stay sound.
    if (field.statutory_compliance_representation === true) {
      if (field.type !== 'boolean') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['statutory_compliance_representation'],
          message: 'statutory_compliance_representation is only valid on a boolean field',
        });
      }
      if (field.default !== 'false') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['default'],
          message: "statutory_compliance_representation fields must declare default: 'false' (a compliance fact is unconfirmed until a human confirms it)",
        });
      }
      if (field.authority_url === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['authority_url'],
          message: 'statutory_compliance_representation fields must declare an authority_url (statute / practice-note link)',
        });
      } else if (!/^https?:\/\/\S+$/.test(field.authority_url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['authority_url'],
          message: 'authority_url must be an http(s) URL',
        });
      }
      // confirm_note is the SSOT for the rendered `[CONFIRM …]` bracket note, so
      // it must be present and non-empty (after trimming) on these fields.
      if (field.confirm_note === undefined || field.confirm_note.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirm_note'],
          message: 'statutory_compliance_representation fields must declare a non-empty confirm_note (the short reason shown in the rendered [CONFIRM …] bracket)',
        });
      }
    } else {
      // Keep these properties scoped: they have no meaning outside the
      // statutory_compliance_representation category.
      if (field.authority_url !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['authority_url'],
          message: 'authority_url is only valid on a statutory_compliance_representation field',
        });
      }
      if (field.confirm_note !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirm_note'],
          message: 'confirm_note is only valid on a statutory_compliance_representation field',
        });
      }
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

      if (field.type === 'multiselect') {
        let parsedDefault: unknown;
        try {
          parsedDefault = JSON.parse(field.default);
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['default'],
            message: 'Default value must be a JSON-encoded array of strings for multiselect fields',
          });
          return;
        }

        if (!Array.isArray(parsedDefault)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['default'],
            message: 'Default value must be a JSON-encoded array of strings for multiselect fields',
          });
          return;
        }

        const seenDefaults = new Set<string>();
        parsedDefault.forEach((entry) => {
          if (typeof entry !== 'string') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['default'],
              message: 'Default value must be a JSON-encoded array of strings for multiselect fields',
            });
            return;
          }

          if (seenDefaults.has(entry)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['default'],
              message: `Default value contains duplicate multiselect option "${entry}"`,
            });
            return;
          }
          seenDefaults.add(entry);

          if (field.options && !field.options.includes(entry)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['default'],
              message: `Default value references option "${entry}" which is not declared in options`,
            });
          }
        });
      }
    }
  })
);

/** Closed set of provenance roles accepted in template `credits` entries. */
const TemplateCreditRoleEnum = z.enum([
  'drafter',
  'drafting_editor',
  'reviewer',
  'maintainer',
]);

/** Optional template provenance entry surfaced by CLI discovery output. */
const TemplateCreditSchema = z.object({
  name: z.string(),
  role: TemplateCreditRoleEnum,
  profile_url: z.string().url().optional(),
});

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

function validateDerivedBooleanCollisions(fields: FieldDefinition[], ctx: z.RefinementCtx): void {
  const topLevelFieldNames = new Set(fields.map((field) => field.name));
  const derivedKeyOwners = new Map<string, string>();

  fields.forEach((field, fieldIndex) => {
    if (field.type !== 'multiselect' || field.derive_booleans !== true || !field.options) {
      return;
    }

    field.options.forEach((option, optionIndex) => {
      const derivedKey = `${option}_enabled`;

      if (topLevelFieldNames.has(derivedKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', fieldIndex, 'options', optionIndex],
          message: `Derived boolean key "${derivedKey}" from multiselect "${field.name}" collides with another top-level field name`,
        });
      }

      const existingOwner = derivedKeyOwners.get(derivedKey);
      if (existingOwner) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', fieldIndex, 'options', optionIndex],
          message: `Derived boolean key "${derivedKey}" from multiselect "${field.name}" collides with derived key from multiselect "${existingOwner}"`,
        });
        return;
      }

      derivedKeyOwners.set(derivedKey, field.name);
    });
  });
}

/**
 * Base metadata required for first-party and external templates.
 *
 * Template directories must provide `metadata.yaml` with a non-empty display
 * name, source URL, version, license, derivative flag, attribution text, and
 * field definitions. `category` is optional discovery grouping metadata.
 * `priority_fields` reference required fill fields. `credits` records
 * contributor provenance and defaults to an empty array; `derived_from` is
 * expository provenance text and does not affect licensing.
 */
const TemplateMetadataBaseSchema = z.object({
  name: z.string().trim().min(1, 'name must be a non-empty string (used as display_name on list_templates)'),
  description: z.string().optional(),
  category: z.string().optional(),
  source_url: z.string().url(),
  version: z.string(),
  license: LicenseEnum,
  allow_derivatives: z.boolean(),
  attribution_text: z.string(),
  fields: z.array(FieldDefinitionSchema),
  priority_fields: z.array(z.string()).default([]),
  credits: z.array(TemplateCreditSchema).default([]),
  derived_from: z.string().optional(),
});

export const TemplateMetadataSchema = TemplateMetadataBaseSchema.superRefine((meta, ctx) => {
  validatePriorityFields(meta.fields, meta.priority_fields, ctx);
  validateDerivedBooleanCollisions(meta.fields, ctx);
});
export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

// --- External template schemas ---

/**
 * Metadata for vendored external templates.
 *
 * `source_sha256` records the checksum of the unmodified upstream document so
 * validation can verify provenance for no-derivatives templates before local
 * transient fills or CI license checks rely on that source.
 */
export const ExternalMetadataSchema = TemplateMetadataBaseSchema.extend({
  source_sha256: z.string(),
}).superRefine((meta, ctx) => {
  validatePriorityFields(meta.fields, meta.priority_fields, ctx);
  validateDerivedBooleanCollisions(meta.fields, ctx);
});
export type ExternalMetadata = z.infer<typeof ExternalMetadataSchema>;

// --- FieldSelector schemas ---

/** Declarative cleaner configuration for fieldSelector DOCX preprocessing. */
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

/** Machine-readable guidance artifact produced from fieldSelector cleaning inputs. */
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

/**
 * Metadata required for field-selector-based templates.
 *
 * FieldSelectors point at non-redistributable upstream source DOCX files and ship only
 * transformation instructions. Required fields are `name`, `source_url`,
 * `source_version`, and `license_note`; `fields` and `priority_fields` reuse
 * the same field-definition semantics as template metadata and default to
 * empty arrays. `optional` defaults to `false`. `source_sha256` verifies
 * provenance for upstream sources when present. `market_data_citations`
 * records optional external citation metadata used by fieldSelector guidance.
 */
export const FieldSelectorMetadataSchema = z.object({
  name: z.string().trim().min(1, 'name must be a non-empty string (used as display_name on list_templates)'),
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
  validateDerivedBooleanCollisions(meta.fields, ctx);
});
export type FieldSelectorMetadata = z.infer<typeof FieldSelectorMetadataSchema>;

// --- Template loaders ---

export function loadMetadata(templateDir: string): TemplateMetadata {
  const metadataPath = join(templateDir, 'metadata.yaml');
  const raw = readFileSync(metadataPath, 'utf-8');
  const parsed = yaml.load(raw);
  return TemplateMetadataSchema.parse(parsed);
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

// --- FieldSelector loaders ---

export function loadFieldSelectorMetadata(fieldSelectorDir: string): FieldSelectorMetadata {
  const metadataPath = join(fieldSelectorDir, 'metadata.yaml');
  const raw = readFileSync(metadataPath, 'utf-8');
  const parsed = yaml.load(raw);
  return FieldSelectorMetadataSchema.parse(parsed);
}

export function loadCleanConfig(fieldSelectorDir: string): CleanConfig {
  const cleanPath = join(fieldSelectorDir, 'clean.json');
  if (!existsSync(cleanPath)) {
    return { removeFootnotes: false, removeParagraphPatterns: [], removeRanges: [], clearParts: [] };
  }
  const raw = readFileSync(cleanPath, 'utf-8');
  return CleanConfigSchema.parse(JSON.parse(raw));
}

export function loadNormalizeConfig(fieldSelectorDir: string): NormalizeConfig {
  const normalizePath = join(fieldSelectorDir, 'normalize.json');
  if (!existsSync(normalizePath)) {
    return { paragraph_rules: [] };
  }
  const raw = readFileSync(normalizePath, 'utf-8');
  return NormalizeConfigSchema.parse(JSON.parse(raw));
}

export function validateFieldSelectorMetadata(fieldSelectorDir: string): { valid: boolean; errors: string[] } {
  try {
    loadFieldSelectorMetadata(fieldSelectorDir);
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

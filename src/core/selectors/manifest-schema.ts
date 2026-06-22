/**
 * Zod schemas for selector-contract recipe manifests.
 *
 * A `FieldSelectorManifest` (`content/recipes/<id>/fields/<field_id>.json`)
 * models one fillable concept as an ordered list of deterministic locators
 * (`occurrences`), one per place the value is written. A `TemplateManifest`
 * (`content/recipes/<id>/template-manifest.json`) pins the source and declares
 * which legacy `replacements.json` keys the selector engine now owns
 * (`migrated_keys`).
 *
 * The manifest carries NO RFC-2119 `requirement` level: the legal level is owned
 * by legal-explainer's contract-spec requirements and joined to OA fields via
 * `field_id ⟷ template_metadata_fields`, never duplicated here. Schemas are
 * `.strict()` so a stray `requirement` key (or any typo) is rejected.
 */
import { z } from 'zod';
import type { Locator } from '@usejunior/docx-core';

// ── Locator (mirrors @usejunior/docx-core's deterministic locator) ──────

const SectionStep = z
  .object({
    kind: z.literal('section'),
    headingText: z.string().optional(),
    headingRegex: z.string().optional(),
    headingStyleId: z.string().optional(),
    untilLevel: z.number().int().optional(),
  })
  .strict()
  .refine(
    (s) => s.headingText !== undefined || s.headingRegex !== undefined || s.headingStyleId !== undefined,
    { message: 'section step requires one of headingText, headingRegex, or headingStyleId' },
  );

const RegexStep = z
  .object({
    kind: z.literal('regex'),
    pattern: z.string().min(1),
    flags: z.string().optional(),
    group: z.number().int().nonnegative().optional(),
  })
  .strict();

const ContextualStep = z
  .object({
    kind: z.literal('contextual'),
    contextPattern: z.string().min(1),
    targetPattern: z.string().min(1),
    rowLabelPattern: z.string().optional(),
  })
  .strict();

const FingerprintStep = z
  .object({
    kind: z.literal('fingerprint'),
    contentFingerprint: z.string().regex(/^sha256:nfkc:[0-9a-f]{32}$/, 'expected a sha256:nfkc: fingerprint'),
  })
  .strict();

/** A span-producing step: valid as `primary` or as an `assertion` (never `section`). */
const SpanStepSchema = z.discriminatedUnion('kind', [RegexStep, ContextualStep, FingerprintStep]);

/** A scope step: only `section` narrows a region. */
const ScopeStepSchema = SectionStep;

export const LocatorSchema = z
  .object({
    scope: z.array(ScopeStepSchema).optional(),
    primary: SpanStepSchema,
    assertions: z.array(SpanStepSchema).optional(),
  })
  .strict();

// Compile-time guarantee that LocatorSchema stays assignable to docx-core's Locator.
const _locatorTypeCheck: (x: z.infer<typeof LocatorSchema>) => Locator = (x) => x;
void _locatorTypeCheck;

// ── Field selector manifest ─────────────────────────────────────────────

export const POSTCONDITION_NAMES = ['no_unresolved_placeholder', 'all_occurrences_identical', 'no_double_dollar'] as const;
export type PostconditionName = (typeof POSTCONDITION_NAMES)[number];

export const FAILURE_BEHAVIORS = ['block_render_and_request_review', 'warn', 'skip'] as const;
export type FailureBehavior = (typeof FAILURE_BEHAVIORS)[number];

export const FieldSelectorManifestSchema = z
  .object({
    schema_version: z.number().int().positive(),
    field_id: z.string().min(1),
    field_label: z.string().min(1),
    description: z.string(),
    source_template_version: z.string().min(1),
    occurrences: z.array(LocatorSchema).min(1, 'a field must declare at least one occurrence locator'),
    postconditions: z.array(z.enum(POSTCONDITION_NAMES)).default([]),
    failure_behavior: z.enum(FAILURE_BEHAVIORS),
    fixtures: z.array(z.record(z.string(), z.unknown())).default([]),
  })
  .strict();

export type FieldSelectorManifest = z.infer<typeof FieldSelectorManifestSchema>;

// ── Template manifest ───────────────────────────────────────────────────

export const TemplateManifestSchema = z
  .object({
    schema_version: z.number().int().positive(),
    template_id: z.string().min(1),
    template_version: z.string().min(1),
    source_sha256: z.string().regex(/^[0-9a-f]{64}$/, 'expected a 64-hex sha256'),
    part_hashes: z.record(z.string(), z.string()).optional(),
    migrated_keys: z.array(z.string()).default([]),
  })
  .strict();

export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;

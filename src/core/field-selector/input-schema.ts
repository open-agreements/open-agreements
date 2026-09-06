import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import canonicalizeModule from 'canonicalize/lib/canonicalize.js';
import {
  loadFieldSelectorMetadata,
  type FieldDefinition,
  type FieldSelectorMetadata,
} from '../metadata.js';
import { loadComputedProfile, type ComputedProfile } from './computed.js';
import { resolveFieldSelectorDir } from '../../utils/paths.js';
import { assertConditionalInputOwnership } from '../conditional-inputs.js';
import { typedFieldDefault } from '../field-defaults.js';

export const FIELD_SELECTOR_INPUT_SCHEMA_VERSION = 1 as const;
export const FIELD_SELECTOR_SCHEMA_GENERATOR = 'open-agreements field-selector schema' as const;

export interface JsonSchema {
  [key: string]: unknown;
}

export interface FieldSelectorSchemaProvenance {
  field_selector_id: string;
  source_version: string;
  generator: typeof FIELD_SELECTOR_SCHEMA_GENERATOR;
  schema_version: typeof FIELD_SELECTOR_INPUT_SCHEMA_VERSION;
}

export interface FieldSelectorSchemaManifest {
  schema_version: 1;
  generator: 'open-agreements field-selector schema --all';
  package_version: string;
  runtime_revision: string;
  canonicalization: 'RFC8785';
  schemas: Array<{ field_selector_id: string; path: string; sha256: string }>;
}

const SERIES_DESIGNATION_FIELD = /(?:^|_)series_designation$/;
const PERCENTAGE_FIELD = /(?:^|_)(?:percent|percentage)$/;
const PERCENTAGE_DESCRIPTION = /\bpercentage\b/i;

/**
 * Legal value shapes whose surrounding prose is owned by the source form.
 *
 * Series tokens use a stable field-name contract. Percentage inputs use either
 * that name contract or an explicit percentage declaration in canonical field
 * metadata (for example `redemption_interest_rate`). The same helper drives
 * both the published JSON Schema and the pre-fill runtime check, so callers
 * cannot pass a rendered phrase or punctuation that the form adds again.
 */
export function fieldValuePattern(field: FieldDefinition): string | undefined {
  if (field.type !== 'string') return undefined;
  if (SERIES_DESIGNATION_FIELD.test(field.name)) {
    // A designation is one token (A, B, C, Seed, A-1), never "Series A
    // Preferred Stock". Empty remains valid for conditional/optional fields.
    return '^(?:|[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)$';
  }
  if (PERCENTAGE_FIELD.test(field.name) || PERCENTAGE_DESCRIPTION.test(field.description)) {
    // The source owns the percent sign. Accept a bare decimal from 0 through
    // 100, or empty for a conditional/optional field.
    return '^(?:|100(?:\\.0+)?|(?:\\d|[1-9]\\d)(?:\\.\\d+)?)$';
  }
  return undefined;
}

function assertValueShapes(
  values: Record<string, unknown>,
  fields: FieldDefinition[],
  path = '',
): void {
  for (const field of fields) {
    const value = values[field.name];
    if (value === undefined) continue;
    const fieldPath = path ? `${path}.${field.name}` : field.name;
    const pattern = fieldValuePattern(field);
    if (pattern && (typeof value !== 'string' || !new RegExp(pattern).test(value))) {
      const expectation = SERIES_DESIGNATION_FIELD.test(field.name)
        ? 'a designation token such as A, B, or C (not a rendered stock name)'
        : 'a number-only percentage from 0 through 100 without a percent sign';
      throw new Error(`Invalid field-selector input at "${fieldPath}": expected ${expectation}`);
    }
    if (field.type === 'array' && Array.isArray(value)) {
      value.forEach((row, index) => {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
          assertValueShapes(row as Record<string, unknown>, field.items ?? [], `${fieldPath}[${index}]`);
        }
      });
    }
  }
}

/** Fail malformed source-owned token/sigil values before any document work. */
export function assertFieldSelectorInputValueShapes(
  values: Record<string, unknown>,
  fields: FieldDefinition[],
): void {
  assertValueShapes(values, fields);
}

/** Return every metadata field owned by computed.json rather than the caller. */
export function computedFieldNames(profile: ComputedProfile | null): Set<string> {
  const names = new Set<string>();
  if (!profile) return names;
  for (const name of Object.keys(profile.defaults)) names.add(name);
  for (const rule of profile.rules) {
    for (const name of Object.keys(rule.set_fill)) names.add(name);
    for (const name of Object.keys(rule.set_audit)) names.add(name);
  }
  return names;
}

function fieldSchema(field: FieldDefinition): JsonSchema {
  const common: JsonSchema = {
    title: field.display_label ?? field.name,
    description: field.description,
  };
  // Empty defaults are omitted from the schema annotation, even when the
  // declared scalar default has meaning to a conditional controller.
  const defaultValue = field.default === '' ? undefined : typedFieldDefault(field);
  if (defaultValue !== undefined) common.default = defaultValue;
  const pattern = fieldValuePattern(field);
  if (pattern) common.pattern = pattern;

  switch (field.type) {
    case 'boolean': return { ...common, type: 'boolean' };
    case 'number': return { ...common, type: 'number' };
    case 'date': return { ...common, type: 'string', format: 'date' };
    case 'enum': return { ...common, type: 'string', enum: [...(field.options ?? [])] };
    case 'multiselect':
      return {
        ...common,
        type: 'array',
        uniqueItems: true,
        items: { type: 'string', enum: [...(field.options ?? [])] },
      };
    case 'array': {
      const items = field.items ?? [];
      return {
        ...common,
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(items.map((item) => [item.name, fieldSchema(item)])),
          required: items.map((item) => item.name),
        },
      };
    }
    default: return { ...common, type: 'string' };
  }
}

export function buildFieldSelectorInputSchema(
  fieldSelectorId: string,
  metadata: FieldSelectorMetadata,
  computedProfile: ComputedProfile | null,
): JsonSchema {
  const computed = computedFieldNames(computedProfile);
  assertConditionalInputOwnership(metadata.fields, computed);
  const fields = metadata.fields.filter((field) => !computed.has(field.name));
  const inputNames = new Set(fields.map((field) => field.name));
  const required = metadata.priority_fields.filter((name) => inputNames.has(name));
  const conditions = fields.filter((field) => field.required_when).map((field) => {
    const condition = field.required_when!;
    const controller = fields.find((candidate) => candidate.name === condition.field);
    if (!controller) throw new Error(`required_when controller "${condition.field}" must be a caller input`);
    const usesDefault = typedFieldDefault(controller) === condition.equals;
    return {
      if: {
        properties: { [condition.field]: { const: condition.equals } },
        // Without a matching controller default, omission must not vacuously
        // activate the condition. JSON Schema does not apply defaults itself.
        ...(!usesDefault ? { required: [condition.field] } : {}),
      },
      then: {
        required: [field.name],
        properties: {
          [field.name]: ['string', 'enum', 'date'].includes(field.type)
            ? { type: 'string', pattern: '\\S' } : { type: field.type },
        },
      },
    };
  });
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://openagreements.org/schemas/field-selector/${fieldSelectorId}.schema.json`,
    title: `${metadata.name} input`,
    description: metadata.description ?? `Canonical caller-supplied fields for ${metadata.name}.`,
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(fields.map((field) => [field.name, fieldSchema(field)])),
    required,
    ...(conditions.length ? { allOf: conditions } : {}),
    'x-openagreements': {
      field_selector_id: fieldSelectorId,
      source_version: metadata.source_version,
      generator: FIELD_SELECTOR_SCHEMA_GENERATOR,
      schema_version: FIELD_SELECTOR_INPUT_SCHEMA_VERSION,
    } satisfies FieldSelectorSchemaProvenance,
  };
}

export function getFieldSelectorInputSchema(
  fieldSelectorId: string,
  fieldSelectorDir = resolveFieldSelectorDir(fieldSelectorId),
): JsonSchema {
  if (!existsSync(fieldSelectorDir)) throw new Error(`Unknown field-selector "${fieldSelectorId}"`);
  const metadata = loadFieldSelectorMetadata(fieldSelectorDir);
  return buildFieldSelectorInputSchema(fieldSelectorId, metadata, loadComputedProfile(fieldSelectorDir));
}

export function canonicalJson(value: unknown): string {
  // canonicalize is CommonJS at runtime despite shipping an ESM-shaped .d.ts.
  const serialize = canonicalizeModule as unknown as (input: unknown) => string | undefined;
  const result = serialize(value);
  if (result === undefined) throw new Error('Value cannot be represented as canonical JSON');
  return result;
}

export function canonicalSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

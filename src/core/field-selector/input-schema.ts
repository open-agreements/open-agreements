import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import canonicalizeModule from 'canonicalize/lib/canonicalize.js';
import {
  loadFieldSelectorMetadata,
  type FieldDefinition,
  type FieldSelectorMetadata,
} from '../metadata.js';
import { loadComputedProfile, type ComputedProfile } from './computed.js';

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

function typedDefault(field: FieldDefinition): unknown {
  if (field.default === undefined || field.default === '') return undefined;
  if (field.type === 'boolean') return field.default === 'true';
  if (field.type === 'number') {
    const value = Number(field.default);
    return Number.isFinite(value) ? value : field.default;
  }
  if (field.type === 'multiselect') {
    try { return JSON.parse(field.default); } catch { return field.default; }
  }
  return field.default;
}

function fieldSchema(field: FieldDefinition): JsonSchema {
  const common: JsonSchema = {
    title: field.display_label ?? field.name,
    description: field.description,
  };
  const defaultValue = typedDefault(field);
  if (defaultValue !== undefined) common.default = defaultValue;

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
  const fields = metadata.fields.filter((field) => !computed.has(field.name));
  const inputNames = new Set(fields.map((field) => field.name));
  const required = metadata.priority_fields.filter((name) => inputNames.has(name));
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://openagreements.org/schemas/field-selector/${fieldSelectorId}.schema.json`,
    title: `${metadata.name} input`,
    description: metadata.description ?? `Canonical caller-supplied fields for ${metadata.name}.`,
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(fields.map((field) => [field.name, fieldSchema(field)])),
    required,
    'x-openagreements': {
      field_selector_id: fieldSelectorId,
      source_version: metadata.source_version,
      generator: FIELD_SELECTOR_SCHEMA_GENERATOR,
      schema_version: FIELD_SELECTOR_INPUT_SCHEMA_VERSION,
    } satisfies FieldSelectorSchemaProvenance,
  };
}

export function getFieldSelectorInputSchema(fieldSelectorId: string, fieldSelectorDir: string): JsonSchema {
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

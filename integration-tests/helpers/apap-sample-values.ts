import type { FieldDefinition } from '../../src/core/metadata.js';

/**
 * Complete caller values for an APAP round trip. The template's fields belong
 * to the upstream content source and can gain a required field at any sync, so
 * a hand-written value list would otherwise fail until someone added it. Any
 * field that has neither a supplied value nor a metadata default gets a
 * synthetic value of the right type; supplied values always win.
 */
export function withRequiredSampleValues(
  fields: readonly FieldDefinition[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const completed: Record<string, unknown> = { ...values };
  for (const field of fields) {
    if (completed[field.name] !== undefined || field.default !== undefined) continue;
    completed[field.name] = sampleValue(field);
  }
  return completed;
}

function sampleValue(field: FieldDefinition): unknown {
  switch (field.type) {
    case 'boolean':
      return false;
    case 'number':
      return 1;
    case 'enum':
      return field.options?.[0] ?? 'example';
    case 'multiselect':
      return field.options?.slice(0, 1) ?? [];
    case 'date':
      return '2026-01-01';
    default:
      return `Example ${field.name.replace(/_/g, ' ')}`;
  }
}

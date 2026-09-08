import type { FieldDefinition } from './metadata.js';

/** Parse a declared metadata default; callers decide whether to expose empties. */
export function typedFieldDefault(field: FieldDefinition): unknown {
  if (field.default === undefined) return undefined;
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

/** Default representation used by document preparation, not schema export. */
export function preparedFieldDefault(field: FieldDefinition, fallback: string = ''): unknown {
  if (field.type === 'array') return [];
  if (field.type === 'multiselect') return field.default ? JSON.parse(field.default) : [];
  if (field.type === 'boolean' && field.default !== undefined) return typedFieldDefault(field);
  // Number defaults intentionally remain strings, matching existing fills.
  return field.default ?? fallback;
}

import type { FieldDefinition } from './metadata.js';
import { typedFieldDefault } from './field-defaults.js';

export class IncompleteConditionalInputError extends Error {
  readonly code = 'INCOMPLETE_CONDITIONAL_INPUT';
  constructor(readonly fields: string[]) {
    super(`Incomplete conditional input: ${fields.join(', ')} must be supplied with nonblank values for the enabled selection`);
    this.name = 'IncompleteConditionalInputError';
  }
}

export function assertConditionalInputOwnership(fields: FieldDefinition[], computed: Set<string>): void {
  for (const field of fields) {
    if (field.required_when && (computed.has(field.name) || computed.has(field.required_when.field))) {
      throw new Error(`required_when for "${field.name}" must use caller inputs, not computed fields`);
    }
  }
}

/** Check raw caller inputs before defaults, downloads, or document mutation. */
export function assertConditionalRequiredInputs(values: Record<string, unknown>, fields: FieldDefinition[]): void {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const missing: string[] = [];
  for (const field of fields) {
    const condition = field.required_when;
    if (!condition) continue;
    const controller = byName.get(condition.field);
    if (!controller) throw new Error(`Unknown required_when controller: ${condition.field}`);
    const supplied = Object.prototype.hasOwnProperty.call(values, condition.field);
    const actual = supplied ? values[condition.field] : typedFieldDefault(controller);
    if (supplied && typeof actual !== typeof condition.equals) {
      throw new Error(`Conditional controller "${condition.field}" must be a ${typeof condition.equals}`);
    }
    if (actual !== condition.equals) continue;
    const value = values[field.name];
    if (value == null || (typeof value === 'string' && value.trim() === '')) missing.push(field.name);
  }
  if (missing.length) throw new IncompleteConditionalInputError(missing);
}

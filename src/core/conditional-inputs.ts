import type { FieldDefinition } from './metadata.js';
import { typedFieldDefault } from './field-defaults.js';
import { conditionalPredicates } from './conditional-predicates.js';

export class IncompleteConditionalInputError extends Error {
  readonly code = 'INCOMPLETE_CONDITIONAL_INPUT';
  constructor(readonly fields: string[]) {
    super(`Incomplete conditional input: ${fields.join(', ')} must be supplied with nonblank values for the enabled selection`);
    this.name = 'IncompleteConditionalInputError';
  }
}

export function assertConditionalInputOwnership(fields: FieldDefinition[], computed: Set<string>): void {
  for (const field of fields) {
    if (field.required_when && (computed.has(field.name) || conditionalPredicates(field.required_when).some(predicate => computed.has(predicate.field)))) {
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
    // Validate every controller even when an earlier predicate is false.
    // A malformed later value must not pass depending on predicate order.
    const matches = conditionalPredicates(condition).map(predicate => {
      const controller = byName.get(predicate.field);
      if (!controller) throw new Error(`Unknown required_when controller: ${predicate.field}`);
      const supplied = Object.prototype.hasOwnProperty.call(values, predicate.field);
      const actual = supplied ? values[predicate.field] : typedFieldDefault(controller);
      if (supplied && typeof actual !== typeof predicate.equals) {
        throw new Error(`Conditional controller "${predicate.field}" must be a ${typeof predicate.equals}`);
      }
      return actual === predicate.equals;
    });
    if (!matches.every(Boolean)) continue;
    const value = values[field.name];
    if (value == null || (typeof value === 'string' && value.trim() === '')) missing.push(field.name);
  }
  if (missing.length) throw new IncompleteConditionalInputError(missing);
}

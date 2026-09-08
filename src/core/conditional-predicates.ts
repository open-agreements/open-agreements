/** Bounded caller-input conditions; not an expression or computed-value language. */
export interface ConditionalPredicate {
  field: string;
  equals: string | number | boolean;
}

export type ConditionalRequirement = ConditionalPredicate | { all_of: ConditionalPredicate[] };

export function conditionalPredicates(condition: ConditionalRequirement): ConditionalPredicate[] {
  return 'all_of' in condition ? condition.all_of : [condition];
}

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const PrimitiveSchema = z.union([z.string(), z.boolean()]);
const PrimitiveArraySchema = z.array(PrimitiveSchema).min(1);

export const ComputedPredicateSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'neq', 'in', 'truthy', 'falsy', 'defined']),
  value: z.union([PrimitiveSchema, PrimitiveArraySchema]).optional(),
}).superRefine((predicate, ctx) => {
  if ((predicate.op === 'eq' || predicate.op === 'neq') && predicate.value === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: `Predicate op "${predicate.op}" requires a value`,
    });
  }

  if (predicate.op === 'in') {
    if (!Array.isArray(predicate.value) || predicate.value.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Predicate op "in" requires a non-empty array value',
      });
    }
    return;
  }

  if ((predicate.op === 'truthy' || predicate.op === 'falsy' || predicate.op === 'defined') && predicate.value !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: `Predicate op "${predicate.op}" must not define a value`,
    });
  }
});

export const ComputedRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  when_all: z.array(ComputedPredicateSchema).default([]),
  when_any: z.array(ComputedPredicateSchema).default([]),
  set_fill: z.record(z.string().min(1), PrimitiveSchema).default({}),
  set_audit: z.record(z.string().min(1), PrimitiveSchema).default({}),
}).superRefine((rule, ctx) => {
  if (Object.keys(rule.set_fill).length === 0 && Object.keys(rule.set_audit).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['set_fill'],
      message: 'Each rule must define at least one assignment in set_fill or set_audit',
    });
  }
});

export const ComputedProfileSchema = z.object({
  version: z.string().default('1.0'),
  max_passes: z.number().int().min(1).max(20).default(4),
  rules: z.array(ComputedRuleSchema).min(1),
});

export type ComputedPrimitive = z.infer<typeof PrimitiveSchema>;
export type ComputedValueMap = Record<string, ComputedPrimitive>;
export type ComputedPredicate = z.infer<typeof ComputedPredicateSchema>;
export type ComputedRule = z.infer<typeof ComputedRuleSchema>;
export type ComputedProfile = z.infer<typeof ComputedProfileSchema>;

export interface ComputedAssignmentDelta {
  field: string;
  scope: 'fill' | 'audit';
  previous: ComputedPrimitive | undefined;
  next: ComputedPrimitive;
}

export interface ComputedRuleTrace {
  rule_id: string;
  description?: string;
  matched: boolean;
  assignments: ComputedAssignmentDelta[];
}

export interface ComputedPassTrace {
  pass: number;
  changed: boolean;
  rules: ComputedRuleTrace[];
}

export interface ComputedArtifact {
  recipe_id: string;
  generated_at: string;
  profile_present: boolean;
  profile_version: string | null;
  max_passes: number;
  stabilized: boolean;
  pass_count: number;
  inputs: ComputedValueMap;
  final_fill_values: ComputedValueMap;
  derived_fill_values: ComputedValueMap;
  derived_audit_values: ComputedValueMap;
  passes: ComputedPassTrace[];
}

export interface EvaluatedComputedProfile {
  fillValues: ComputedValueMap;
  auditValues: ComputedValueMap;
  passes: ComputedPassTrace[];
  stabilized: boolean;
  maxPasses: number;
}

function normalizeComparableValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.trim();
  if (normalized.toLowerCase() === 'true') return true;
  if (normalized.toLowerCase() === 'false') return false;
  return normalized;
}

function interpolate(value: ComputedPrimitive, state: ComputedValueMap): ComputedPrimitive {
  if (typeof value !== 'string') {
    return value;
  }
  if (!value.includes('${')) {
    return value;
  }
  return value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_match, fieldName: string) => {
    const fieldValue = state[fieldName];
    return fieldValue === undefined ? '' : String(fieldValue);
  });
}

function evaluatePredicate(predicate: ComputedPredicate, state: ComputedValueMap): boolean {
  const actualRaw = state[predicate.field];
  const actual = normalizeComparableValue(actualRaw);

  if (predicate.op === 'defined') {
    return actualRaw !== undefined && actualRaw !== null && actualRaw !== '';
  }

  if (predicate.op === 'truthy') {
    return Boolean(actualRaw);
  }

  if (predicate.op === 'falsy') {
    return !actualRaw;
  }

  if (predicate.op === 'in') {
    const candidates = (predicate.value as ComputedPrimitive[]).map((entry) => normalizeComparableValue(entry));
    return candidates.some((entry) => entry === actual);
  }

  const expected = normalizeComparableValue(predicate.value);
  if (predicate.op === 'eq') {
    return actual === expected;
  }

  return actual !== expected;
}

function matchRule(rule: ComputedRule, state: ComputedValueMap): boolean {
  const allPredicatesMatch = rule.when_all.length === 0
    ? true
    : rule.when_all.every((predicate) => evaluatePredicate(predicate, state));

  if (!allPredicatesMatch) {
    return false;
  }

  return rule.when_any.length === 0
    ? true
    : rule.when_any.some((predicate) => evaluatePredicate(predicate, state));
}

function computeDerivedValues(initialValues: ComputedValueMap, finalValues: ComputedValueMap): ComputedValueMap {
  const result: ComputedValueMap = {};
  for (const [field, value] of Object.entries(finalValues)) {
    if (!(field in initialValues) || initialValues[field] !== value) {
      result[field] = value;
    }
  }
  return result;
}

export function loadComputedProfile(recipeDir: string): ComputedProfile | null {
  const computedPath = join(recipeDir, 'computed.json');
  if (!existsSync(computedPath)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(computedPath, 'utf-8')) as unknown;
  return ComputedProfileSchema.parse(parsed);
}

export function evaluateComputedProfile(
  profile: ComputedProfile,
  inputValues: ComputedValueMap
): EvaluatedComputedProfile {
  const fillValues: ComputedValueMap = { ...inputValues };
  const auditValues: ComputedValueMap = {};
  const combinedState: ComputedValueMap = { ...fillValues };
  const passes: ComputedPassTrace[] = [];

  let stabilized = false;

  for (let pass = 1; pass <= profile.max_passes; pass += 1) {
    let passChanged = false;
    const ruleTraces: ComputedRuleTrace[] = [];

    for (const rule of profile.rules) {
      const matched = matchRule(rule, combinedState);
      const assignments: ComputedAssignmentDelta[] = [];

      if (matched) {
        for (const [field, assigned] of Object.entries(rule.set_fill)) {
          const resolved = interpolate(assigned, combinedState);
          const previous = fillValues[field];
          if (previous !== resolved) {
            fillValues[field] = resolved;
            combinedState[field] = resolved;
            assignments.push({ field, scope: 'fill', previous, next: resolved });
            passChanged = true;
          }
        }

        for (const [field, assigned] of Object.entries(rule.set_audit)) {
          const resolved = interpolate(assigned, combinedState);
          const previous = auditValues[field];
          if (previous !== resolved) {
            auditValues[field] = resolved;
            combinedState[field] = resolved;
            assignments.push({ field, scope: 'audit', previous, next: resolved });
            passChanged = true;
          }
        }
      }

      ruleTraces.push({
        rule_id: rule.id,
        description: rule.description,
        matched,
        assignments,
      });
    }

    passes.push({
      pass,
      changed: passChanged,
      rules: ruleTraces,
    });

    if (!passChanged) {
      stabilized = true;
      break;
    }
  }

  return {
    fillValues,
    auditValues,
    passes,
    stabilized,
    maxPasses: profile.max_passes,
  };
}

export function buildComputedArtifact(args: {
  recipeId: string;
  inputValues: ComputedValueMap;
  evaluated: EvaluatedComputedProfile;
  profileVersion: string;
}): ComputedArtifact {
  const { recipeId, inputValues, evaluated, profileVersion } = args;
  return {
    recipe_id: recipeId,
    generated_at: new Date().toISOString(),
    profile_present: true,
    profile_version: profileVersion,
    max_passes: evaluated.maxPasses,
    stabilized: evaluated.stabilized,
    pass_count: evaluated.passes.length,
    inputs: inputValues,
    final_fill_values: evaluated.fillValues,
    derived_fill_values: computeDerivedValues(inputValues, evaluated.fillValues),
    derived_audit_values: evaluated.auditValues,
    passes: evaluated.passes,
  };
}

export function buildPassthroughArtifact(args: {
  recipeId: string;
  inputValues: ComputedValueMap;
}): ComputedArtifact {
  return {
    recipe_id: args.recipeId,
    generated_at: new Date().toISOString(),
    profile_present: false,
    profile_version: null,
    max_passes: 0,
    stabilized: true,
    pass_count: 0,
    inputs: { ...args.inputValues },
    final_fill_values: { ...args.inputValues },
    derived_fill_values: {},
    derived_audit_values: {},
    passes: [],
  };
}

export function writeComputedArtifact(outputPath: string, artifact: ComputedArtifact): void {
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf-8');
}

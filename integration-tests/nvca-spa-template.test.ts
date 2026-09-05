import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { describe, expect } from 'vitest';
import { validateFieldSelectorMetadata } from '../src/core/metadata.js';
import { validateFieldSelector } from '../src/core/validation/field-selector.js';
import { resolveFieldSelectorDir } from '../src/utils/paths.js';
import { allureDescriptionHtml, allureParameter, allureSeverity, itAllure } from './helpers/allure-test.js';

interface MetadataDocument {
  source_url?: string;
  source_sha256?: string;
  optional?: boolean;
  fields?: Array<{ name: string }>;
}
interface ComputedCondition { field?: string }
interface ComputedRule {
  id: string;
  when_all?: ComputedCondition[];
  when_any?: ComputedCondition[];
  set_fill?: Record<string, unknown>;
  set_audit?: Record<string, unknown>;
}
interface ComputedConfig { defaults?: Record<string, unknown>; rules?: ComputedRule[] }
interface CleanConfig { removeFootnotes?: boolean; removeParagraphPatterns?: string[] }
type ReplacementValue = string | { value: string };

const FIELD_SELECTOR_ID = 'nvca-stock-purchase-agreement';
const FIELD_SELECTOR_DIR = resolveFieldSelectorDir(FIELD_SELECTOR_ID);
const it = itAllure.withLabels({
  epic: 'NVCA SPA Template',
  feature: 'NVCA SPA Legal QA',
  suite: 'Counsel Review',
});
const itDiscovery = it.withLabels({ subSuite: 'Discovery & Metadata' });
const itGovernance = it.withLabels({ subSuite: 'Compliance & Governance' });

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIELD_SELECTOR_DIR, name), 'utf-8')) as T;
}

async function setReviewContext(question: string, whyItMatters: string): Promise<void> {
  await allureParameter('field_selector_id', FIELD_SELECTOR_ID);
  await allureParameter('audience', 'lawyer');
  await allureSeverity('critical');
  await allureDescriptionHtml(
    `<h3>Counsel Summary</h3><ul><li><strong>Legal question:</strong> ${question}</li>` +
      `<li><strong>Why it matters:</strong> ${whyItMatters}</li></ul>`
  );
}

function fieldsInTemplateValue(value: ReplacementValue | string): string[] {
  const text = typeof value === 'string' ? value : value.value;
  return Array.from(text.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (match) => match[1]);
}

describe('NVCA SPA Template', () => {
  itDiscovery('declares every replacement and normalization target', async () => {
    await setReviewContext(
      'Do the SPA replacement rules target declared or computed fields?',
      'An undeclared target can silently leave a material deal term unfilled.'
    );
    const metadata = load(readFileSync(join(FIELD_SELECTOR_DIR, 'metadata.yaml'), 'utf-8')) as MetadataDocument;
    const replacements = readJson<Record<string, ReplacementValue>>('replacements.json');
    const normalize = readJson<{ paragraph_rules?: Array<{ replacements?: Record<string, string> }> }>('normalize.json');
    const computed = readJson<ComputedConfig>('computed.json');
    const declared = new Set((metadata.fields ?? []).map((field) => field.name));
    const computedOutputs = new Set([
      ...Object.keys(computed.defaults ?? {}),
      ...(computed.rules ?? []).flatMap((rule) => Object.keys(rule.set_fill ?? {})),
    ]);
    const renderedTargets = new Set([
      ...Object.values(replacements).flatMap(fieldsInTemplateValue),
      ...(normalize.paragraph_rules ?? []).flatMap((rule) =>
        Object.values(rule.replacements ?? {}).flatMap(fieldsInTemplateValue)
      ),
    ]);
    const unknownTargets = [...renderedTargets].filter(
      (field) => !declared.has(field) && !computedOutputs.has(field)
    );
    expect(unknownTargets).toEqual([]);
  });

  itDiscovery('passes structural metadata and selector validation', async () => {
    await setReviewContext(
      'Is the SPA field selector structurally valid before use?',
      'Invalid metadata or selector configuration can make contract output unreliable.'
    );
    expect(validateFieldSelectorMetadata(FIELD_SELECTOR_DIR)).toMatchObject({ valid: true, errors: [] });
    expect(validateFieldSelector(FIELD_SELECTOR_DIR, FIELD_SELECTOR_ID)).toMatchObject({ valid: true, errors: [] });
  });

  itGovernance('documents source provenance and cleaning policy', async () => {
    await setReviewContext(
      'Are the SPA source and drafting-note removal policy traceable?',
      'Counsel must be able to verify source integrity and the cleaning applied to it.'
    );
    const metadata = load(readFileSync(join(FIELD_SELECTOR_DIR, 'metadata.yaml'), 'utf-8')) as MetadataDocument;
    const clean = readJson<CleanConfig>('clean.json');
    expect(metadata.source_url).toMatch(/^https:\/\/nvca\.org\//);
    expect(metadata.source_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.optional).toBe(false);
    expect(clean.removeFootnotes).toBe(true);
    expect(clean.removeParagraphPatterns).toContain('^Note to Drafter:');
    expect(clean.removeParagraphPatterns).toContain('^Preliminary Note\\b');
  });

  itDiscovery('keeps the computed drafting policy internally connected', async () => {
    await setReviewContext(
      'Are computed SPA drafting choices uniquely named and connected to declared inputs?',
      'Broken policy dependencies can select the wrong forum, closing structure, or negotiated term.'
    );
    const metadata = load(readFileSync(join(FIELD_SELECTOR_DIR, 'metadata.yaml'), 'utf-8')) as MetadataDocument;
    const computed = readJson<ComputedConfig>('computed.json');
    const rules = computed.rules ?? [];
    const declared = new Set((metadata.fields ?? []).map((field) => field.name));
    const produced = new Set([
      ...Object.keys(computed.defaults ?? {}),
      ...rules.flatMap((rule) => [...Object.keys(rule.set_fill ?? {}), ...Object.keys(rule.set_audit ?? {})]),
    ]);
    const conditionFields = rules.flatMap((rule) =>
      [...(rule.when_all ?? []), ...(rule.when_any ?? [])]
        .map((condition) => condition.field)
        .filter((field): field is string => field !== undefined)
    );
    const danglingInputs = conditionFields.filter((field) => !declared.has(field) && !produced.has(field));
    const ruleIds = rules.map((rule) => rule.id);
    expect(new Set(ruleIds).size).toBe(ruleIds.length);
    expect(danglingInputs).toEqual([]);
    expect(ruleIds).toEqual(expect.arrayContaining([
      'derive-dispute-resolution-track-arbitration',
      'derive-dispute-resolution-track-courts',
      'derive-governing-law-baseline',
      'derive-forum-governing-mismatch',
    ]));
    expect(computed.defaults).toMatchObject({ closing_heading: 'Closing.', purchaser_scope: 'all' });
  });
});

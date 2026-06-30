import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import {
  FieldSelectorManifestSchema,
  TemplateManifestSchema,
  LocatorSchema,
} from './manifest-schema.js';

const it = itAllure.epic('Recipes');

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    field_id: 'company_name',
    field_label: 'Company Name',
    description: 'desc',
    source_template_version: '10-28-2025',
    occurrences: [{ primary: { kind: 'regex', pattern: '\\[Insert Company Name\\]' } }],
    postconditions: ['no_unresolved_placeholder'],
    failure_behavior: 'warn',
    fixtures: [],
    ...overrides,
  };
}

describe('FieldSelectorManifest schema', () => {
  it('[OA-SEL-001] accepts a well-formed manifest', () => {
    const result = FieldSelectorManifestSchema.safeParse(validManifest());
    expect(result.success).toBe(true);
  });

  it('[OA-SEL-001] rejects a manifest missing field_id / occurrences / failure_behavior', () => {
    for (const missing of ['field_id', 'occurrences', 'failure_behavior']) {
      const m = validManifest();
      delete (m as Record<string, unknown>)[missing];
      expect(FieldSelectorManifestSchema.safeParse(m).success, missing).toBe(false);
    }
  });

  it('[OA-SEL-001] rejects a manifest carrying a requirement key (legal level is single-sourced elsewhere)', () => {
    const result = FieldSelectorManifestSchema.safeParse(validManifest({ requirement: 'MUST' }));
    expect(result.success).toBe(false);
  });

  it('[OA-SEL-001] rejects an empty occurrences array', () => {
    expect(FieldSelectorManifestSchema.safeParse(validManifest({ occurrences: [] })).success).toBe(false);
  });

  it('rejects section as a primary step (scope-only)', () => {
    const bad = validManifest({ occurrences: [{ primary: { kind: 'section', headingText: 'X' } }] });
    expect(FieldSelectorManifestSchema.safeParse(bad).success).toBe(false);
  });
});

describe('Locator schema', () => {
  it('accepts section in scope and span steps in primary/assertions', () => {
    const result = LocatorSchema.safeParse({
      scope: [{ kind: 'section', headingRegex: 'PREAMBLE' }],
      primary: { kind: 'regex', pattern: '\\[X\\]' },
      assertions: [{ kind: 'fingerprint', contentFingerprint: 'sha256:nfkc:' + 'a'.repeat(32) }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a section step in assertions', () => {
    const result = LocatorSchema.safeParse({
      primary: { kind: 'regex', pattern: '\\[X\\]' },
      assertions: [{ kind: 'section', headingText: 'X' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('TemplateManifest schema', () => {
  it('accepts a well-formed template manifest with migrated_keys', () => {
    const result = TemplateManifestSchema.safeParse({
      schema_version: 1,
      template_id: 'nvca-stock-purchase-agreement',
      template_version: '10-28-2025',
      source_sha256: 'b2c76452fa82dcda72f1fa9f82ba0ce28ea9445441c897f9cb7ac6663930dcab',
      migrated_keys: ['[Insert Company Name]'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed source_sha256', () => {
    const result = TemplateManifestSchema.safeParse({
      schema_version: 1,
      template_id: 't',
      template_version: 'v',
      source_sha256: 'nothex',
      migrated_keys: [],
    });
    expect(result.success).toBe(false);
  });
});

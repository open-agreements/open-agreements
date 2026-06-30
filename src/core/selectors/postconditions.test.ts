import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { evaluatePostconditions } from './postconditions.js';
import type { FieldSelectorManifest } from './manifest-schema.js';

const it = itAllure.epic('Recipes');

function manifest(postconditions: FieldSelectorManifest['postconditions']): FieldSelectorManifest {
  return {
    schema_version: 1,
    field_id: 'company_name',
    field_label: 'Company Name',
    description: '',
    source_template_version: '10-28-2025',
    occurrences: [{ primary: { kind: 'regex', pattern: '\\[X\\]' } }],
    postconditions,
    failure_behavior: 'warn',
    fixtures: [],
  };
}

describe('evaluatePostconditions', () => {
  it('[OA-SEL-007] all_occurrences_identical passes when value present and no anchors remain', () => {
    const checks = evaluatePostconditions({
      outputText: 'Acme Inc. agrees and Acme Inc. shall...',
      manifests: [manifest(['all_occurrences_identical'])],
      fieldValues: { company_name: 'Acme Inc.' },
      migratedAnchorsByField: { company_name: ['[Insert Company Name]', '[Company name]'] },
    });
    expect(checks).toHaveLength(1);
    expect(checks[0].passed).toBe(true);
  });

  it('[OA-SEL-008] all_occurrences_identical fails when a source anchor still remains (divergence)', () => {
    const checks = evaluatePostconditions({
      outputText: 'Acme Inc. agrees but [Company name] shall...',
      manifests: [manifest(['all_occurrences_identical'])],
      fieldValues: { company_name: 'Acme Inc.' },
      migratedAnchorsByField: { company_name: ['[Insert Company Name]', '[Company name]'] },
    });
    expect(checks[0].passed).toBe(false);
    expect(checks[0].details).toContain('[Company name]');
  });

  it('no_unresolved_placeholder fails when the {field_id} tag survived', () => {
    const checks = evaluatePostconditions({
      outputText: 'preamble {company_name} unrendered',
      manifests: [manifest(['no_unresolved_placeholder'])],
      fieldValues: { company_name: 'Acme Inc.' },
      migratedAnchorsByField: {},
    });
    expect(checks[0].passed).toBe(false);
  });

  it('no_double_dollar flags a $$ artifact', () => {
    const checks = evaluatePostconditions({
      outputText: 'price of $$1,000,000',
      manifests: [manifest(['no_double_dollar'])],
      fieldValues: {},
      migratedAnchorsByField: {},
    });
    expect(checks[0].passed).toBe(false);
  });

  it('no_double_dollar flags whitespace-separated $ $ (locks the \\s* span)', () => {
    const checks = evaluatePostconditions({
      outputText: 'price of $ $1,000,000',
      manifests: [manifest(['no_double_dollar'])],
      fieldValues: {},
      migratedAnchorsByField: {},
    });
    expect(checks[0].passed).toBe(false);
  });
});

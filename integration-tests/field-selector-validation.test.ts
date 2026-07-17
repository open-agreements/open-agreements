import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { validateFieldSelector } from '../src/core/validation/field-selector.js';
import { validateFieldSelectorMetadata } from '../src/core/metadata.js';
import { resolveFieldSelectorDir } from '../src/utils/paths.js';
import {
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

const it = itAllure.epic('Verification & Drift');

describe('validateFieldSelector', () => {
  it('validates nvca-voting-agreement (full fieldSelector)', async () => {
    const dir = resolveFieldSelectorDir('nvca-voting-agreement');
    await allureParameter('field_selector_id', 'nvca-voting-agreement');
    const result = await allureStep('Validate full fieldSelector', () =>
      validateFieldSelector(dir, 'nvca-voting-agreement')
    );
    await allureJsonAttachment('field-selector-validation-result.json', result);
    await allureStep('Assert fieldSelector has no validation errors', () => {
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  it('validates nvca-certificate-of-incorporation (scaffold)', async () => {
    const dir = resolveFieldSelectorDir('nvca-certificate-of-incorporation');
    await allureParameter('field_selector_id', 'nvca-certificate-of-incorporation');
    const result = await allureStep('Validate scaffold fieldSelector', () =>
      validateFieldSelector(dir, 'nvca-certificate-of-incorporation')
    );
    await allureJsonAttachment('field-selector-validation-result.json', result);
    await allureStep('Assert scaffold fieldSelector passes validation', () => {
      expect(result.valid).toBe(true);
    });
  });
});

describe('validateFieldSelectorMetadata', () => {
  it('validates nvca-voting-agreement metadata', async () => {
    const dir = resolveFieldSelectorDir('nvca-voting-agreement');
    await allureParameter('field_selector_id', 'nvca-voting-agreement');
    const result = await allureStep('Validate fieldSelector metadata', () =>
      validateFieldSelectorMetadata(dir)
    );
    await allureJsonAttachment('field-selector-metadata-validation-result.json', result);
    await allureStep('Assert metadata validation passes', () => {
      expect(result.valid).toBe(true);
    });
  });

  it('validates scaffold metadata', async () => {
    const dir = resolveFieldSelectorDir('nvca-management-rights-letter');
    await allureParameter('field_selector_id', 'nvca-management-rights-letter');
    const result = await allureStep('Validate scaffold metadata', () =>
      validateFieldSelectorMetadata(dir)
    );
    await allureJsonAttachment('field-selector-metadata-validation-result.json', result);
    await allureStep('Assert scaffold metadata validation passes', () => {
      expect(result.valid).toBe(true);
    });
  });
});

// Issue #620: template-hygiene coverage assertions for the NVCA family audit.
// These pin the deterministic slot bindings added for the management rights
// letter and the removal of the dead ROFR field, without requiring a network
// fetch of the (non-redistributable) source document.
describe('issue #620 slot coverage', () => {
  it('nvca-management-rights-letter maps the body company, letter-date, and purchased-shares slots', async () => {
    const dir = resolveFieldSelectorDir('nvca-management-rights-letter');
    await allureParameter('field_selector_id', 'nvca-management-rights-letter');
    const replacements = JSON.parse(
      readFileSync(join(dir, 'replacements.json'), 'utf-8')
    ) as Record<string, string>;

    await allureStep('Assert body slots are bound to fields', () => {
      // Body company slot (21 underscores) fills from the same field as the
      // uppercase signature-block slot.
      expect(replacements['[_____________________]']).toBe('{company_name_upper}');
      // Dateline: the full "______, 20__" shape (including the pre-printed
      // "20") is replaced by a single formatted date (type: date → ISO input
      // renders as e.g. "July 15, 2026").
      expect(replacements['[______], 20[__]']).toBe('{letter_date}');
      // Purchased shares slot (8 underscores).
      expect(replacements['[________]']).toBe('{purchased_shares}');
    });

    await allureStep('Assert the series blank stays unmapped (deferred to issue #618)', () => {
      // "Series [_]" is deliberately NOT covered here: the ancillary
      // series/par-value issue (#618) owns that field family. This assertion
      // documents that the remaining body blank is intentional, not missed.
      expect(Object.keys(replacements)).not.toContain('[_]');
      expect(
        Object.values(replacements).some((v) => v.includes('series'))
      ).toBe(false);
    });

    await allureStep('Assert letter_date is a date-typed metadata field', () => {
      const metadata = readFileSync(join(dir, 'metadata.yaml'), 'utf-8');
      expect(metadata).toMatch(/- name: letter_date\n\s+type: date/);
      expect(metadata).toMatch(/- name: purchased_shares\n\s+type: string/);
    });
  });

  it('nvca-rofr-co-sale-agreement no longer publishes the dead optional_blank_value field', async () => {
    const dir = resolveFieldSelectorDir('nvca-rofr-co-sale-agreement');
    await allureParameter('field_selector_id', 'nvca-rofr-co-sale-agreement');
    const metadata = readFileSync(join(dir, 'metadata.yaml'), 'utf-8');
    const replacements = readFileSync(join(dir, 'replacements.json'), 'utf-8');

    await allureStep('Assert optional_blank_value is unpublished', () => {
      // A sentinel fill confirmed the field never reached the document: no
      // replacements key, selector, or binding referenced it (issue #620).
      expect(metadata).not.toContain('optional_blank_value');
      expect(replacements).not.toContain('optional_blank_value');
    });
  });
});

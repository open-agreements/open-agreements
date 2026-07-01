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

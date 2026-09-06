import { describe, expect } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { typedFieldDefault } from './field-defaults.js';
import type { FieldDefinition } from './metadata.js';

const it = itAllure.epic('Filling & Rendering');

describe('typed field defaults', () => {
  it('preserves scalar and multiselect parsing, including fallback values', () => {
    const cases: [FieldDefinition['type'], string | undefined, unknown][] = [
      ['string', undefined, undefined], ['string', '', ''], ['string', 'value', 'value'],
      ['boolean', 'true', true], ['boolean', 'false', false],
      ['number', '0', 0], ['number', '1.5', 1.5], ['number', 'not-a-number', 'not-a-number'],
      ['multiselect', '["one","two"]', ['one', 'two']], ['multiselect', 'invalid-json', 'invalid-json'],
    ];
    for (const [type, defaultValue, expected] of cases) {
      expect(typedFieldDefault({ name: 'choice', description: 'Choice', type, default: defaultValue })).toEqual(expected);
    }
  });
});

import { describe, expect } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { preparedFieldDefault, typedFieldDefault } from './field-defaults.js';
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

describe('document preparation defaults', () => {
  it('preserves fill-specific representations and explicit empty defaults', () => {
    const cases: [FieldDefinition['type'], string | undefined, unknown][] = [
      ['array', undefined, []], ['array', '[{"ignored":true}]', []],
      ['multiselect', undefined, []], ['multiselect', '', []],
      ['multiselect', '["one"]', ['one']],
      ['boolean', 'true', true], ['boolean', 'false', false],
      ['boolean', undefined, '_______'],
      ['number', '0', '0'], ['number', '1.5', '1.5'],
      ['string', undefined, '_______'], ['string', '', ''],
      ['date', '2026-09-08', '2026-09-08'],
    ];
    for (const [type, defaultValue, expected] of cases) {
      expect(preparedFieldDefault({ name: 'choice', description: 'Choice', type, default: defaultValue }, '_______')).toEqual(expected);
    }
    expect(preparedFieldDefault({ name: 'choice', description: 'Choice', type: 'string' })).toBe('');
  });

  it('throws on malformed multiselect defaults instead of using schema-parser fallback', () => {
    expect(() => preparedFieldDefault({ name: 'choice', description: 'Choice', type: 'multiselect', default: 'invalid-json' })).toThrow(SyntaxError);
  });
});

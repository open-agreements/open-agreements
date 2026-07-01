import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { parseReplacementKey, extractSearchText } from './replacement-keys.js';

const it = itAllure.epic('Cleaning & Normalization');

describe('parseReplacementKey', () => {
  it('parses a simple key', () => {
    const result = parseReplacementKey('[Company Name]', '{company_name}');
    expect(result).toEqual({
      type: 'simple',
      searchText: '[Company Name]',
      value: '{company_name}',
    });
  });

  it('parses a context key with " > " separator', () => {
    const result = parseReplacementKey('Effective Date > [Fill in]', '{effective_date}');
    expect(result).toEqual({
      type: 'context',
      context: 'Effective Date',
      searchText: '[Fill in]',
      value: '{effective_date}',
    });
  });

  it('splits on first " > " only', () => {
    const result = parseReplacementKey('A > B > C', '{tag}');
    expect(result).toEqual({
      type: 'context',
      context: 'A',
      searchText: 'B > C',
      value: '{tag}',
    });
  });

  it('does not confuse > inside text without spaces', () => {
    const result = parseReplacementKey('A>B', '{tag}');
    // " > " requires spaces, so "A>B" is simple
    expect(result.type).toBe('simple');
  });
});

describe('extractSearchText', () => {
  it('returns key as-is for simple keys', () => {
    expect(extractSearchText('[Company Name]')).toBe('[Company Name]');
  });

  it('extracts placeholder from context key', () => {
    expect(extractSearchText('Effective Date > [Fill in]')).toBe('[Fill in]');
  });
});

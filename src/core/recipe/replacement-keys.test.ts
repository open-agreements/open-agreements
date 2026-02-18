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

  it('parses an nth occurrence key', () => {
    const result = parseReplacementKey('Party Name:#1', 'Party Name: {party_1_name}');
    expect(result).toEqual({
      type: 'nth',
      searchText: 'Party Name:',
      n: 1,
      value: 'Party Name: {party_1_name}',
    });
  });

  it('parses nth key with N > 1', () => {
    const result = parseReplacementKey('Company:#2', 'Company: {provider_name}');
    expect(result).toEqual({
      type: 'nth',
      searchText: 'Company:',
      n: 2,
      value: 'Company: {provider_name}',
    });
  });

  it('treats #0 as simple (N must be positive)', () => {
    const result = parseReplacementKey('text#0', '{tag}');
    expect(result.type).toBe('simple');
  });

  it('treats trailing # without number as simple', () => {
    const result = parseReplacementKey('text#abc', '{tag}');
    expect(result.type).toBe('simple');
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

  it('strips #N suffix from nth key', () => {
    expect(extractSearchText('Party Name:#1')).toBe('Party Name:');
  });

  it('strips #N for multi-digit N', () => {
    expect(extractSearchText('Item:#12')).toBe('Item:');
  });

  it('leaves #0 alone (not valid nth)', () => {
    expect(extractSearchText('text#0')).toBe('text#0');
  });
});

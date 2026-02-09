import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { validateTemplate } from '../src/core/validation/template.js';
import { validateMetadata } from '../src/core/metadata.js';

// These tests rely on the existing templates in the repo
const templatesDir = join(import.meta.dirname, '..', 'templates');

describe('validateTemplate', () => {
  it('validates bonterms-mutual-nda without errors', () => {
    const dir = join(templatesDir, 'bonterms-mutual-nda');
    const result = validateTemplate(dir, 'bonterms-mutual-nda');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates common-paper-mutual-nda without errors', () => {
    const dir = join(templatesDir, 'common-paper-mutual-nda');
    const result = validateTemplate(dir, 'common-paper-mutual-nda');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('validateMetadata', () => {
  it('validates bonterms-mutual-nda metadata', () => {
    const dir = join(templatesDir, 'bonterms-mutual-nda');
    const result = validateMetadata(dir);
    expect(result.valid).toBe(true);
  });
});

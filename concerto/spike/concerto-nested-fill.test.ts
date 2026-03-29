import { describe, it, expect } from 'vitest';
import { createReport } from 'docx-templates';
import { readFileSync } from 'node:fs';
import AdmZip from 'adm-zip';
import { join } from 'node:path';

/**
 * Spike test: Concerto-structured data fills nested DOCX tags directly.
 * No flattener, no bridge — the JSON object shape IS the tag namespace.
 */
describe('concerto nested fill (no flattener)', () => {
  const templatePath = join(import.meta.dirname, 'template-nested.docx');

  // Data shaped exactly as a Concerto-validated instance (minus $class)
  const concertoData = {
    party_1: { name: 'UseJunior Inc.' },
    party_2: { name: 'Acme Corp' },
    terms: {
      effective_date: 'March 25, 2026',
      purpose: 'Evaluating a potential business relationship',
      nda_term: '1 year',
      confidentiality_period: '1 year',
    },
    legal: {
      governing_law: 'New York',
      courts: 'courts located in New York County, New York',
    },
  };

  it('fills all nested tags with Concerto-structured data', async () => {
    const template = readFileSync(templatePath);
    const filled = await createReport({
      template,
      data: concertoData,
      cmdDelimiter: ['{', '}'],
      processLineBreaks: true,
    });

    const zip = new AdmZip(Buffer.from(filled));
    const docXml = zip.readAsText('word/document.xml');

    // No unfilled tags remain
    const remainingTags = docXml.match(/\{[a-z_]+(?:\.[a-z_]+)*\}/g);
    expect(remainingTags).toBeNull();

    // All values present in document
    const text = docXml.replace(/<[^>]+>/g, ' ');
    expect(text).toContain('UseJunior Inc.');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('March 25, 2026');
    expect(text).toContain('New York');
    expect(text).toContain('1 year');
  });

  it('overrides Concerto defaults when values provided', async () => {
    const customData = {
      ...concertoData,
      terms: {
        ...concertoData.terms,
        purpose: 'Joint venture evaluation',
        nda_term: '2 years',
      },
    };

    const template = readFileSync(templatePath);
    const filled = await createReport({
      template,
      data: customData,
      cmdDelimiter: ['{', '}'],
      processLineBreaks: true,
    });

    const zip = new AdmZip(Buffer.from(filled));
    const text = zip.readAsText('word/document.xml').replace(/<[^>]+>/g, ' ');
    expect(text).toContain('Joint venture evaluation');
    expect(text).toContain('2 years');
  });
});

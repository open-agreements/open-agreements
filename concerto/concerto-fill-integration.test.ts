import { describe, it, expect } from 'vitest';
import { fillTemplate } from '../src/core/engine.js';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';

/**
 * Strip Concerto metadata fields from a validated instance
 * to produce a flat Record suitable for the fill pipeline.
 *
 * Concerto adds $class, $identifier, and contractId (from Contract).
 * The fill pipeline only wants the template's own fields.
 */
function stripConcertoMeta(instance: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(instance).filter(([k]) => !k.startsWith('$') && k !== 'contractId')
  );
}

describe('Concerto flat model → fill pipeline integration', () => {
  const TEMPLATE_DIR = resolve('content/templates/bonterms-mutual-nda');

  // Data shaped as a Concerto-validated instance (includes $class, $identifier, contractId)
  const concertoInstance = {
    $class: 'org.openagreements.nda.bonterms@1.0.0.BontermsMutualNDA',
    $identifier: 'bonterms-nda-001',
    contractId: 'bonterms-nda-001',
    party_1_name: 'UseJunior Inc.',
    party_2_name: 'Acme Corp',
    effective_date: 'March 25, 2026',
    purpose: 'Evaluating a potential business relationship',
    nda_term: '1 year',
    confidentiality_period: '1 year',
    governing_law: 'New York',
    courts: 'courts located in New York County, New York',
  };

  it('fills template from Concerto-validated data with no pipeline changes', async () => {
    const values = stripConcertoMeta(concertoInstance);
    const tempDir = mkdtempSync(join(tmpdir(), 'concerto-fill-'));
    const outputPath = join(tempDir, 'output.docx');

    const result = await fillTemplate({
      templateDir: TEMPLATE_DIR,
      values,
      outputPath,
    });

    expect(existsSync(outputPath)).toBe(true);

    // Verify filled content
    const zip = new AdmZip(outputPath);
    const text = zip.readAsText('word/document.xml').replace(/<[^>]+>/g, ' ');
    expect(text).toContain('UseJunior Inc.');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('March 25, 2026');
    expect(text).toContain('New York');

    // No unfilled tags
    const remainingTags = text.match(/\{[a-z_]+\}/g);
    expect(remainingTags).toBeNull();

    unlinkSync(outputPath);
  });

  it('strips Concerto metadata fields correctly', () => {
    const values = stripConcertoMeta(concertoInstance);

    // Concerto metadata removed
    expect(values).not.toHaveProperty('$class');
    expect(values).not.toHaveProperty('$identifier');
    expect(values).not.toHaveProperty('contractId');

    // All 8 fill fields present
    const expectedFields = [
      'party_1_name', 'party_2_name', 'effective_date',
      'purpose', 'nda_term', 'confidentiality_period',
      'governing_law', 'courts',
    ];
    expect(Object.keys(values).sort()).toEqual(expectedFields.sort());
  });

  it('uses Concerto defaults when values omitted', async () => {
    // Only provide required fields (party names + effective date)
    const minimalInstance = {
      $class: 'org.openagreements.nda.bonterms@1.0.0.BontermsMutualNDA',
      contractId: 'minimal-nda',
      party_1_name: 'Alpha LLC',
      party_2_name: 'Beta Corp',
      effective_date: 'January 1, 2027',
    };

    const values = stripConcertoMeta(minimalInstance);
    const tempDir = mkdtempSync(join(tmpdir(), 'concerto-defaults-'));
    const outputPath = join(tempDir, 'output.docx');

    const result = await fillTemplate({
      templateDir: TEMPLATE_DIR,
      values,
      outputPath,
    });

    // Pipeline applies metadata.yaml defaults for omitted fields
    const zip = new AdmZip(outputPath);
    const text = zip.readAsText('word/document.xml').replace(/<[^>]+>/g, ' ');
    expect(text).toContain('Alpha LLC');
    expect(text).toContain('Beta Corp');
    // Defaults from metadata.yaml should fill in
    expect(text).toContain('California');

    unlinkSync(outputPath);
  });
});

#!/usr/bin/env node
/**
 * Spike: fill the nested-tag DOCX directly with Concerto-structured data.
 * No flattener, no bridge — the JSON shape matches the DOCX tags.
 */
import { createReport } from 'docx-templates';
import { readFileSync, writeFileSync } from 'node:fs';

// Concerto-structured data (exactly as validated by concerto-cli)
const data = {
  party_1: { name: 'UseJunior Inc.' },
  party_2: { name: 'Acme Corp' },
  terms: {
    effective_date: 'March 25, 2026',
    purpose: 'Evaluating a potential business relationship',
    nda_term: '1 year',
    confidentiality_period: '1 year',
  },
  legal: {
    governing_law: 'California',
    courts: 'courts located in San Francisco, California',
  },
};

const template = readFileSync('concerto/spike/template-nested.docx');

const filled = await createReport({
  template,
  data,
  cmdDelimiter: ['{', '}'],
  processLineBreaks: true,
});

writeFileSync('concerto/spike/output-nested.docx', filled);
console.log('Filled output-nested.docx with nested Concerto data (no flattener)');

// Verify: read back and check no unfilled tags remain
import AdmZip from 'adm-zip';
const zip = new AdmZip(Buffer.from(filled));
const docXml = zip.readAsText('word/document.xml');
const remainingTags = docXml.match(/\{[a-z_]+(?:\.[a-z_]+)*\}/g);
if (remainingTags) {
  console.error('UNFILLED TAGS:', remainingTags);
  process.exit(1);
} else {
  console.log('All tags filled successfully.');
}

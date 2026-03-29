#!/usr/bin/env node
/**
 * Rewrite flat DOCX placeholder tags to nested Concerto-style dot paths.
 *
 * Copies bonterms-mutual-nda/template.docx → concerto/spike/template-nested.docx
 * with tags rewritten from {party_1_name} → {party_1.name}, etc.
 */
import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';

const TAG_MAP = {
  '{party_1_name}':          '{party_1.name}',
  '{party_2_name}':          '{party_2.name}',
  '{effective_date}':        '{terms.effective_date}',
  '{purpose}':               '{terms.purpose}',
  '{nda_term}':              '{terms.nda_term}',
  '{confidentiality_period}':'{terms.confidentiality_period}',
  '{governing_law}':         '{legal.governing_law}',
  '{courts}':                '{legal.courts}',
};

const zip = new AdmZip('content/templates/bonterms-mutual-nda/template.docx');
const docXml = zip.readAsText('word/document.xml');

let rewritten = docXml;
for (const [flat, nested] of Object.entries(TAG_MAP)) {
  rewritten = rewritten.replaceAll(flat, nested);
}

zip.updateFile('word/document.xml', Buffer.from(rewritten, 'utf-8'));
zip.writeZip('concerto/spike/template-nested.docx');

// Verify
const verify = new AdmZip('concerto/spike/template-nested.docx');
const verifyXml = verify.readAsText('word/document.xml');
const tags = verifyXml.match(/\{[^}]+\}/g);
console.log('Rewritten tags:', tags);

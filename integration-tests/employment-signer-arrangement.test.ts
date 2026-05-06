import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { Packer } from 'docx';
import { describe, expect } from 'vitest';
import { allureJsonAttachment, itAllure } from './helpers/allure-test.js';
import { compileCanonicalSourceFile } from '../scripts/template_renderer/canonical-source.mjs';
import { loadStyleProfile, renderFromValidatedSpec } from '../scripts/template_renderer/index.mjs';
import { tableTextsAfterHeading } from './helpers/standard-terms-docx.js';

const it = itAllure.epic('Filling & Rendering');

const repoRoot = join(import.meta.dirname, '..');
const stylePath = join(
  repoRoot,
  'scripts',
  'template-specs',
  'styles',
  'openagreements-default-v1.json'
);

const CANONICAL_EMPLOYMENT_CASES = [
  'content/templates/openagreements-employment-offer-letter/template.md',
  'content/templates/openagreements-employee-ip-inventions-assignment/template.md',
  'content/templates/openagreements-restrictive-covenant-wyoming/template.md',
] as const;

function blockFor(markdown: string, label: string, nextLabel?: string): string {
  const start = markdown.indexOf(`**${label}**`);
  if (start === -1) {
    return '';
  }
  if (!nextLabel) {
    return markdown.slice(start);
  }
  const end = markdown.indexOf(`**${nextLabel}**`, start + 1);
  return end === -1 ? markdown.slice(start) : markdown.slice(start, end);
}

function signatureMarkdownSection(markdown: string, headingTitle: string): string {
  const marker = `## ${headingTitle}`;
  const start = markdown.indexOf(marker);
  return start === -1 ? markdown : markdown.slice(start);
}

describe('employment signer arrangement rendering', () => {
  for (const templatePath of CANONICAL_EMPLOYMENT_CASES) {
    it.openspec('OA-FIL-025')(`${templatePath} renders entity-plus-individual signers as stacked asymmetric blocks`, async () => {
      const compiled = compileCanonicalSourceFile(join(repoRoot, templatePath));
      const style = loadStyleProfile(stylePath);
      const rendered = renderFromValidatedSpec(compiled.contractSpec, style);
      const [entitySigner, individualSigner] = compiled.contractSpec.sections.signature.signers;

      expect(compiled.contractSpec.sections.signature).toMatchObject({
        mode: 'signers',
        arrangement: 'entity-plus-individual',
      });
      expect(entitySigner.rows.map((row) => row.id)).toContain('title');
      expect(individualSigner.rows.map((row) => row.id)).not.toContain('title');

      const signatureMarkdown = signatureMarkdownSection(
        rendered.markdown,
        compiled.contractSpec.sections.signature.heading_title
      );
      const entityBlock = blockFor(signatureMarkdown, entitySigner.label, individualSigner.label);
      const individualBlock = blockFor(signatureMarkdown, individualSigner.label);
      expect(entityBlock).toContain('Title:');
      expect(individualBlock).not.toContain('Title:');

      const buffer = await Packer.toBuffer(rendered.document);
      const zip = new AdmZip(buffer);
      const documentXml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
      const tableTexts = tableTextsAfterHeading(documentXml, compiled.contractSpec.sections.signature.heading_title);

      await allureJsonAttachment('employment-signer-arrangement.json', {
        templatePath,
        signers: compiled.contractSpec.sections.signature.signers,
        tableTexts,
      });

      expect(tableTexts).toHaveLength(2);
      expect(tableTexts[0]).toContain(entitySigner.label.toUpperCase());
      expect(tableTexts[0]).toContain('Title');
      expect(tableTexts[1]).toContain(individualSigner.label.toUpperCase());
      expect(tableTexts[1]).not.toContain('Title');
    });
  }
});

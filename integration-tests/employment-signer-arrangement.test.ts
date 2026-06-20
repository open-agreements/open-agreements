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

function signatureMarkdownSection(markdown: string, headingTitle: string): string {
  const marker = `## ${headingTitle}`;
  const start = markdown.indexOf(marker);
  return start === -1 ? markdown : markdown.slice(start);
}

describe('employment signer arrangement rendering', () => {
  for (const templatePath of CANONICAL_EMPLOYMENT_CASES) {
    it.openspec('OA-TMP-057')(`${templatePath} canonical employment template uses mode:signers with asymmetric arrangement`, async () => {
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
      // Entity block: the legal name is drawn above the line via a promoted
      // `<Label>: {field}` line (no bold party header); the human signatory is
      // captured by distinct Signatory Name + Title rows. The individual block
      // keeps the bold header and Print Name.
      const entityStart = signatureMarkdown.indexOf(`${entitySigner.label}:`);
      const individualStart = signatureMarkdown.indexOf(`**${individualSigner.label}**`);
      expect(entityStart).toBeGreaterThanOrEqual(0);
      expect(individualStart).toBeGreaterThan(entityStart);
      const entityBlock = signatureMarkdown.slice(entityStart, individualStart);
      const individualBlock = signatureMarkdown.slice(individualStart);
      expect(signatureMarkdown).not.toContain(`**${entitySigner.label}**`);
      expect(entityBlock).toContain('Signatory Name:');
      expect(entityBlock).toContain('Title:');
      expect(entityBlock).not.toContain('Print Name:');
      expect(individualBlock).toContain('Print Name:');
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
      expect(tableTexts[0]).toContain('Signatory Name');
      expect(tableTexts[0]).toContain('Title');
      expect(tableTexts[0]).not.toContain('Print Name');
      expect(tableTexts[1]).toContain(individualSigner.label.toUpperCase());
      expect(tableTexts[1]).toContain('Print Name');
      expect(tableTexts[1]).not.toContain('Title');

      // The `Signature` rows must render at the taller signature-line height
      // (500 twips) so the ruled line has room to sign on — taller than the 340
      // height used by the other signature rows. (Both are renderer layout
      // constants in cover-standard-signature-v1.mjs, tuned tighter than the
      // original 864/690 to remove excess vertical airiness.) Asserting the
      // rendered DOCX guards the row heights end-to-end.
      expect(documentXml).toContain('<w:trHeight w:val="500" w:hRule="atLeast"/>');
      expect(documentXml).toContain('<w:trHeight w:val="340" w:hRule="atLeast"/>');
    });
  }
});

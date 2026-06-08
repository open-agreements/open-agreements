import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { Packer } from 'docx';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { compileCanonicalSourceFile } from '../scripts/template_renderer/canonical-source.mjs';
import { loadStyleProfile, renderFromValidatedSpec } from '../scripts/template_renderer/index.mjs';

const it = itAllure.epic('Filling & Rendering');

const REPO_ROOT = join(import.meta.dirname, '..');
const STYLE_PATH = join(REPO_ROOT, 'scripts', 'template-specs', 'styles', 'openagreements-default-v1.json');

// Templates that compile through layout=cover-standard-signature-v1. The Pages-app
// compatibility invariant (#262, #263) was already enforced for the traditional-consent
// layout via canonical-board-consent + canonical-stockholder-consent tests; this file
// extends the same guard to every cover-standard-signature template so a future renderer
// regression can't silently land an unstyled-paragraph DOCX. See #339.
const COVER_STANDARD_TEMPLATES = [
  {
    slug: 'openagreements-employee-ip-inventions-assignment',
    sourceType: 'canonical',
  },
  {
    slug: 'openagreements-employment-confidentiality-acknowledgement',
    sourceType: 'json',
  },
  {
    slug: 'openagreements-employment-offer-letter',
    sourceType: 'canonical',
  },
  {
    slug: 'openagreements-restrictive-covenant-wyoming',
    sourceType: 'canonical',
  },
] as const;

function extractDocxXml(buffer: Buffer, entryName: string): string {
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry(entryName);
  if (!entry) throw new Error(`${entryName} not found in DOCX`);
  return entry.getData().toString('utf-8');
}

function extractStyleBlock(stylesXml: string, styleId: string): string {
  const re = new RegExp(
    `<w:style[^>]*w:styleId="${styleId}"[^>]*>([\\s\\S]*?)</w:style>`
  );
  const match = stylesXml.match(re);
  if (!match) throw new Error(`style ${styleId} not found in styles.xml`);
  return match[0];
}

async function renderTemplateBuffer(slug: string, sourceType: 'canonical' | 'json'): Promise<Buffer> {
  const style = loadStyleProfile(STYLE_PATH);
  const templateDir = join(REPO_ROOT, 'content', 'templates', slug);

  let spec;
  if (sourceType === 'canonical') {
    const compiled = compileCanonicalSourceFile(join(templateDir, 'template.md'));
    spec = compiled.contractSpec;
  } else {
    spec = JSON.parse(readFileSync(join(templateDir, 'template.json'), 'utf-8'));
  }

  const rendered = renderFromValidatedSpec(spec, style);
  return Packer.toBuffer(rendered.document);
}

describe('cover-standard-signature-v1 — Apple Pages compatibility invariant', () => {
  for (const { slug, sourceType } of COVER_STANDARD_TEMPLATES) {
    // The invariant has three parts (mirrors #263's consent-layout regression guard):
    //   (1) Required named styles are declared in styles.xml with their visible properties.
    //   (2) Normal carries non-zero spacing-after so paragraphs render with vertical whitespace.
    //   (3) Every visible-text <w:p> in document.xml references an explicit pStyle.
    // Skipping any one of these re-exposes the #262 failure mode where Pages drops inline
    // alignment or inherits the previous paragraph's style properties.
    it.openspec(['OA-TMP-046', 'OA-TMP-048'])(`${slug} renders Pages-compatible explicit-style tree`, async () => {
      const buffer = await renderTemplateBuffer(slug, sourceType);
      const documentXml = extractDocxXml(buffer, 'word/document.xml');
      const stylesXml = extractDocxXml(buffer, 'word/styles.xml');

      // (1) Required named styles exist.
      const normalBlock = extractStyleBlock(stylesXml, 'Normal');
      const titleBlock = extractStyleBlock(stylesXml, 'OATitle');
      const sectionTitleBlock = extractStyleBlock(stylesXml, 'OASectionTitle');
      const clauseHeadingBlock = extractStyleBlock(stylesXml, 'OAClauseHeading');
      const clauseBodyBlock = extractStyleBlock(stylesXml, 'OAClauseBody');

      for (const [name, block] of [
        ['OATitle', titleBlock],
        ['OASectionTitle', sectionTitleBlock],
        ['OAClauseHeading', clauseHeadingBlock],
        ['OAClauseBody', clauseBodyBlock],
      ] as const) {
        expect(block, `${name} must declare basedOn=Normal`).toMatch(/<w:basedOn w:val="Normal"\/>/);
      }

      // (2) Normal carries non-zero spacing-after. The #262 failure mode included
      // pPrDefault.spacing.after=0 AND Normal.spacing.after=0; the latter is the one
      // that bites paragraphs styled Normal. Assert non-zero so a regression where
      // someone resets Normal to after:0 fails CI before shipping.
      expect(normalBlock, 'Normal must define non-zero spacing-after').toMatch(
        /<w:spacing[^>]*w:after="(?!0")\d+"/
      );

      // (3) Every visible-text <w:p> references a named style.
      // Section-break carriers (paragraphs containing only <w:sectPr>) and empty
      // structural paragraphs are excluded — Pages doesn't render them.
      const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
      const unstyled: string[] = [];
      let visibleTextParas = 0;
      let m: RegExpExecArray | null;
      while ((m = paraRegex.exec(documentXml)) !== null) {
        const para = m[0];
        const hasText = /<w:t[^>]*>[^<]/.test(para);
        if (!hasText) continue;
        visibleTextParas++;
        if (!/<w:pStyle /.test(para)) {
          const text = para.match(/<w:t[^>]*>([^<]+)/)?.[1] ?? '';
          unstyled.push(text.slice(0, 80));
        }
      }
      expect(unstyled, `${slug}: every visible-text <w:p> must reference a named style`).toEqual([]);
      expect(visibleTextParas).toBeGreaterThan(0);
    });
  }
});

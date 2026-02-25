import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, vi } from 'vitest';
import {
  allureAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';
import { fillDocx } from '../src/core/fill-pipeline.js';
import { fillTemplate } from '../src/core/engine.js';
import { getTemplatesDir } from '../src/utils/paths.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const RELS_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const it = itAllure.epic('Compliance & Governance');

const WORD_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

function buildDocxBuffer(documentXml: string): Buffer {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  return zip.toBuffer();
}

describe('fill security behavior', () => {
  it.openspec('OA-ENG-001')('fillDocx uses sandboxed rendering by default', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body><w:p><w:r><w:t>Hello {name}</w:t></w:r></w:p></w:body></w:document>`;

    await allureParameter('template_expression', '{name}');
    await allureAttachment('input-document.xml', xml);

    const result = await allureStep('Render with default sandbox settings', () =>
      fillDocx({
        templateBuffer: buildDocxBuffer(xml),
        data: { name: 'Alice' },
        stripParagraphPatterns: [],
      })
    );

    const outXml = await allureStep('Extract rendered document.xml', () => {
      const outZip = new AdmZip(Buffer.from(result));
      const outEntry = outZip.getEntry('word/document.xml');
      return outEntry?.getData().toString('utf-8') ?? '';
    });
    await allureAttachment('rendered-document.xml', outXml);

    await allureStep('Assert rendered values appear in output', () => {
      expect(outXml).toContain('Hello ');
      expect(outXml).toContain('Alice');
    });
  });

  it.openspec('OA-ENG-002')('fillDocx blocks malicious template expressions', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body><w:p><w:r><w:t>{= require('fs').readFileSync('/etc/passwd','utf8') }</w:t></w:r></w:p></w:body></w:document>`;

    await allureParameter('payload_type', 'malicious-template-expression');
    await allureAttachment('input-document.xml', xml);

    await allureStep('Assert sandbox blocks require() execution', async () => {
      await expect(
        fillDocx({
          templateBuffer: buildDocxBuffer(xml),
          data: {},
          stripParagraphPatterns: [],
        })
      ).rejects.toThrow(/require is not defined/);
    });
  });

  it.openspec('OA-FIL-001')('fillTemplate warns on unknown input keys', async () => {
    const templateDir = join(getTemplatesDir(), 'common-paper-mutual-nda');
    const outputDir = mkdtempSync(join(tmpdir(), 'oa-unknown-keys-'));
    tempDirs.push(outputDir);
    const outputPath = join(outputDir, 'filled.docx');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await allureParameter('template_id', 'common-paper-mutual-nda');
    await allureAttachment('unknown-input-key.txt', 'unknown_field_typo');

    await allureStep('Fill template with unknown key included', async () => {
      await fillTemplate({
        templateDir,
        outputPath,
        values: {
          purpose: 'Evaluation',
          unknown_field_typo: 'unexpected',
        },
      });
    });

    await allureStep('Assert warning includes unknown key name', () => {
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown field(s) not in metadata: unknown_field_typo')
      );
    });
  });
});

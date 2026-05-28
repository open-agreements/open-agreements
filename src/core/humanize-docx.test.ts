import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import {
  humanizeDocxBuffer,
  loadHumanizeContext,
  prettifyTemplateXml,
  type HumanizeContext,
} from './humanize-docx.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function makeMinimalDocx(bodyXml: string): Buffer {
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  const rels =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${bodyXml}</w:body></w:document>`;
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(rels, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  return zip.toBuffer();
}

function readPart(zipBuffer: Buffer, entryName: string): string {
  const zip = new AdmZip(zipBuffer);
  const entry = zip.getEntry(entryName);
  if (!entry) throw new Error(`Missing entry: ${entryName}`);
  return entry.getData().toString('utf8');
}

describe('humanize-docx — prettifyTemplateXml (pure transform)', () => {
  it('replaces {snake_case} tokens with [Bracket Label]', () => {
    const input = `<w:p xmlns:w="${W_NS}"><w:r><w:t>Between {employer_name} and {employee_name}.</w:t></w:r></w:p>`;
    const ctx: HumanizeContext = {
      fieldLabels: { employer_name: 'Employer Legal Name', employee_name: 'Employee Full Name' },
      fieldDefaults: {},
    };
    const out = prettifyTemplateXml(input, ctx.fieldLabels, ctx.fieldDefaults, { highlight: false });
    expect(out).toContain('[Employer Legal Name]');
    expect(out).toContain('[Employee Full Name]');
    expect(out).not.toContain('{employer_name}');
  });

  it('substitutes default text without brackets when a default exists', () => {
    const input = `<w:p xmlns:w="${W_NS}"><w:r><w:t>Competitor list: {specified_competitors}</w:t></w:r></w:p>`;
    const ctx: HumanizeContext = {
      fieldLabels: { specified_competitors: 'Specified competitors' },
      fieldDefaults: { specified_competitors: 'None.' },
    };
    const out = prettifyTemplateXml(input, ctx.fieldLabels, ctx.fieldDefaults, { highlight: false });
    expect(out).toContain('None.');
    expect(out).not.toContain('[Specified competitors]');
  });

  it('strips standalone {IF} / {END-IF} marker paragraphs (positive condition keeps the body)', () => {
    const input =
      `<w:body xmlns:w="${W_NS}">` +
      `<w:p><w:r><w:t>{IF foo}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>conditional content</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>{END-IF}</w:t></w:r></w:p>` +
      `</w:body>`;
    const out = prettifyTemplateXml(input, {}, {}, { highlight: false });
    expect(out).not.toContain('{IF foo}');
    expect(out).not.toContain('{END-IF}');
    expect(out).toContain('conditional content');
  });

  it('strips the body too when condition is negated `{IF !foo}`', () => {
    const input =
      `<w:body xmlns:w="${W_NS}">` +
      `<w:p><w:r><w:t>{IF !foo}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>excluded content</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>{END-IF}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>after</w:t></w:r></w:p>` +
      `</w:body>`;
    const out = prettifyTemplateXml(input, {}, {}, { highlight: false });
    expect(out).not.toContain('excluded content');
    expect(out).toContain('after');
  });
});

describe('humanize-docx — highlightPlaceholderRuns', () => {
  it('wraps [bracket placeholders] in a yellow-highlight run', () => {
    // Token gets replaced first by prettifyTemplateXml, then highlightPlaceholderRuns runs
    const input = `<w:p xmlns:w="${W_NS}"><w:r><w:t>Between {employer_name} (Employer).</w:t></w:r></w:p>`;
    const ctx: HumanizeContext = {
      fieldLabels: { employer_name: 'Employer Legal Name' },
      fieldDefaults: {},
    };
    const out = prettifyTemplateXml(input, ctx.fieldLabels, ctx.fieldDefaults);
    expect(out).toContain('w:val="yellow"');
    expect(out).toContain('[Employer Legal Name]');
  });
});

describe('humanize-docx — humanizeDocxBuffer (full-docx round-trip)', () => {
  it('produces a valid docx with humanized tokens', () => {
    const input = makeMinimalDocx(
      `<w:p><w:r><w:t>Between {employer_name} and {employee_name} on {effective_date}.</w:t></w:r></w:p>`,
    );
    const ctx: HumanizeContext = {
      fieldLabels: {
        employer_name: 'Employer Legal Name',
        employee_name: 'Employee Full Name',
        effective_date: 'Effective date',
      },
      fieldDefaults: {},
    };
    const out = humanizeDocxBuffer(input, ctx);
    const documentXml = readPart(out, 'word/document.xml');
    expect(documentXml).toContain('[Employer Legal Name]');
    expect(documentXml).toContain('[Employee Full Name]');
    expect(documentXml).toContain('[Effective date]');
    expect(documentXml).toContain('w:val="yellow"');
    expect(documentXml).not.toMatch(/\{[a-z_]+\}/);
  });
});

describe('humanize-docx — loadHumanizeContext (yaml integration)', () => {
  function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = mkdtempSync(join(tmpdir(), 'humanize-test-'));
    try {
      return fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('uses public-field-metadata.yaml label overrides over metadata.yaml descriptions', () => {
    withTempDir((dir) => {
      const templateDir = join(dir, 'content', 'templates', 'foo-template');
      mkdirSync(templateDir, { recursive: true });
      writeFileSync(
        join(templateDir, 'metadata.yaml'),
        [
          'fields:',
          '  - name: employer_name',
          '    description: The legal name of the employer entity',
          '  - name: specified_competitors',
          '    description: Named competing organizations',
          '    default: None.',
        ].join('\n'),
        'utf8',
      );

      const publicMeta = join(dir, 'template-public-field-metadata.yaml');
      writeFileSync(
        publicMeta,
        [
          'global:',
          '  employer_name:',
          '    label: Employer Legal Name',
          'templates:',
          '  foo-template:',
          '    specified_competitors:',
          '      default: None.',
        ].join('\n'),
        'utf8',
      );

      const ctx = loadHumanizeContext(templateDir, { publicFieldMetadataPath: publicMeta });

      // Public-field-metadata.yaml label override wins over description.
      expect(ctx.fieldLabels.employer_name).toBe('Employer Legal Name');
      // Default from metadata.yaml carries through.
      expect(ctx.fieldDefaults.specified_competitors).toBe('None.');
    });
  });

  it('does nothing when public-field-metadata path is omitted (graceful)', () => {
    withTempDir((dir) => {
      const templateDir = join(dir, 'content', 'templates', 'bar-template');
      mkdirSync(templateDir, { recursive: true });
      writeFileSync(
        join(templateDir, 'metadata.yaml'),
        [
          'fields:',
          '  - name: party_name',
          '    description: Name of the contracting party',
        ].join('\n'),
        'utf8',
      );

      const ctx = loadHumanizeContext(templateDir);
      expect(ctx.fieldLabels.party_name).toBe('Name of the contracting party');
    });
  });
});

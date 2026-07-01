import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import {
  humanizeDocx,
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
      const templateDir = join(dir, 'templates', 'foo-template');
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
      const templateDir = join(dir, 'templates', 'bar-template');
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

describe('humanize-docx — field-code preservation (#185 / #109)', () => {
  it('preserves whitespace inside <w:instrText> field-code instructions', () => {
    // PAGE field code instruction with deliberate multi-space; must NOT collapse
    // because Word parses the instruction string verbatim.
    const input =
      `<w:p xmlns:w="${W_NS}">` +
      `<w:r><w:instrText xml:space="preserve">  PAGE   \\* MERGEFORMAT  </w:instrText></w:r>` +
      `<w:r><w:t>Body  text  with  doubles.</w:t></w:r>` +
      `</w:p>`;
    const out = prettifyTemplateXml(input, {}, {}, { highlight: false });
    // Field-code instruction whitespace preserved verbatim.
    expect(out).toContain('  PAGE   \\* MERGEFORMAT  ');
    // Body-text multi-space collapsed (outside field code).
    expect(out).toContain('Body text with doubles.');
  });

  it('preserves self-closing <w:fldChar/> markers untouched', () => {
    const input =
      `<w:p xmlns:w="${W_NS}">` +
      `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
      `<w:r><w:fldChar w:fldCharType="end"/></w:r>` +
      `</w:p>`;
    const out = prettifyTemplateXml(input, {}, {}, { highlight: false });
    expect(out).toContain('<w:fldChar w:fldCharType="begin"/>');
    expect(out).toContain('<w:fldChar w:fldCharType="end"/>');
  });
});

describe('humanize-docx — humanizeDocx (file-based API)', () => {
  it('reads template.docx from disk and returns a humanized buffer', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'humanize-file-test-'));
    try {
      const templateDir = join(dir, 'templates', 'sample-template');
      mkdirSync(templateDir, { recursive: true });
      writeFileSync(
        join(templateDir, 'metadata.yaml'),
        [
          'fields:',
          '  - name: party_name',
          '    description: Party name',
        ].join('\n'),
        'utf8',
      );
      const docxBuffer = makeMinimalDocx(
        `<w:p><w:r><w:t>Hello {party_name}.</w:t></w:r></w:p>`,
      );
      writeFileSync(join(templateDir, 'template.docx'), docxBuffer);

      const out = await humanizeDocx(templateDir);
      const documentXml = readPart(out, 'word/document.xml');
      expect(documentXml).toContain('[Party name]');
      expect(documentXml).not.toContain('{party_name}');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('humanize-docx — fallback label derivation', () => {
  it('falls back to the raw field name when no label/description is present', () => {
    // fallbackFieldLabel returns the field name as-is; no snake_case → Title
    // Case transform is applied. (If a humanized label is desired, supply one
    // via metadata.yaml description or public-field-metadata.yaml.)
    const input = `<w:p xmlns:w="${W_NS}"><w:r><w:t>For {acme_holdings_inc}.</w:t></w:r></w:p>`;
    const out = prettifyTemplateXml(input, {}, {}, { highlight: false });
    expect(out).toContain('[acme_holdings_inc]');
  });
});

describe('humanize-docx — loadHumanizeContext (template-spec rows)', () => {
  function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = mkdtempSync(join(tmpdir(), 'humanize-spec-test-'));
    try {
      return fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('derives field labels from a template-spec rows tree (parent-row label propagates to sub-rows with generic sublabels)', () => {
    withTempDir((dir) => {
      const templateDir = join(dir, 'templates', 'spec-template');
      const specsDir = join(dir, 'scripts', 'template-specs');
      mkdirSync(templateDir, { recursive: true });
      mkdirSync(specsDir, { recursive: true });

      writeFileSync(
        join(templateDir, 'metadata.yaml'),
        [
          'fields:',
          '  - name: noncompete_scope',
          '  - name: noncompete_duration',
          '  - name: noncompete_address',
          '  - name: effective_date',
        ].join('\n'),
        'utf8',
      );

      const spec = {
        sections: [
          {
            rows: [
              { label: 'Noncompete', value: '{noncompete_scope}' },
              // "duration" is a GENERIC_SUBLABEL — gets parent-prefixed.
              { sub: true, label: 'Duration', value: '{noncompete_duration}' },
              // "Address" is NOT generic — keeps its own label.
              { sub: true, label: 'Address', value: '{noncompete_address}' },
            ],
          },
          { label: 'Effective Date', value: '{effective_date}' },
        ],
      };
      writeFileSync(join(specsDir, 'spec-template.json'), JSON.stringify(spec), 'utf8');

      const ctx = loadHumanizeContext(templateDir, { templateSpecsDir: specsDir });
      // Parent row label
      expect(ctx.fieldLabels.noncompete_scope).toBe('Noncompete');
      // Generic sublabel 'Duration' gets parent-prefixed.
      expect(ctx.fieldLabels.noncompete_duration).toBe('Noncompete Duration');
      // Non-generic sublabel keeps its own label, no parent prefix.
      expect(ctx.fieldLabels.noncompete_address).toBe('Address');
      // Top-level structured label.
      expect(ctx.fieldLabels.effective_date).toBe('Effective Date');
    });
  });

  it('returns null spec gracefully when the spec file is missing', () => {
    withTempDir((dir) => {
      const templateDir = join(dir, 'templates', 'no-spec');
      mkdirSync(templateDir, { recursive: true });
      writeFileSync(
        join(templateDir, 'metadata.yaml'),
        ['fields:', '  - name: party_name', '    description: Party'].join('\n'),
        'utf8',
      );
      // templateSpecsDir is set but the corresponding JSON file does NOT exist
      const ctx = loadHumanizeContext(templateDir, { templateSpecsDir: join(dir, 'nonexistent') });
      // Should fall back to metadata description for the label.
      expect(ctx.fieldLabels.party_name).toBe('Party');
    });
  });

  it('returns empty fields when metadata.yaml is missing', () => {
    withTempDir((dir) => {
      const templateDir = join(dir, 'templates', 'empty');
      mkdirSync(templateDir, { recursive: true });
      // NO metadata.yaml file written.
      const ctx = loadHumanizeContext(templateDir);
      expect(ctx.fieldLabels).toEqual({});
      expect(ctx.fieldDefaults).toEqual({});
    });
  });

  it('truncates long labels to the first sentence and strips trailing period', () => {
    withTempDir((dir) => {
      const templateDir = join(dir, 'templates', 'long-label');
      mkdirSync(templateDir, { recursive: true });
      writeFileSync(
        join(templateDir, 'metadata.yaml'),
        [
          'fields:',
          '  - name: long_field',
          '    description: First sentence is the meaningful label. Then a second sentence with more verbose detail that pushes the total length past the 80-character truncation threshold.',
        ].join('\n'),
        'utf8',
      );
      const publicMeta = join(dir, 'template-public-field-metadata.yaml');
      writeFileSync(
        publicMeta,
        [
          'templates:',
          '  long-label:',
          '    long_field:',
          '      label: First sentence is the meaningful label. Then a second sentence with more verbose detail that pushes the total length past the 80-character truncation threshold.',
        ].join('\n'),
        'utf8',
      );

      const ctx = loadHumanizeContext(templateDir, { publicFieldMetadataPath: publicMeta });
      expect(ctx.fieldLabels.long_field).toBe('First sentence is the meaningful label');
    });
  });
});

describe('humanize-docx — non-OOXML inputs (early return)', () => {
  it('returns string unchanged when input lacks OOXML namespace declaration', () => {
    const input = '<plain>just some text with {token} that looks templatey.</plain>';
    const out = prettifyTemplateXml(input, { token: 'Token Label' }, {}, { highlight: false });
    // Without an xmlns:w= declaration, the highlight pass short-circuits; token
    // replacement still runs (it does not require XML parsing).
    expect(out).toContain('[Token Label]');
    expect(out).not.toContain('w:val="yellow"');
  });

  it('humanizeDocxBuffer leaves non-XML zip entries untouched', () => {
    const zip = new AdmZip();
    // Non-XML entry should pass through unmodified.
    zip.addFile('media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    zip.addFile(
      'word/document.xml',
      Buffer.from(
        `<?xml version="1.0" encoding="UTF-8"?>` +
          `<w:document xmlns:w="${W_NS}"><w:body><w:p><w:r><w:t>{x}</w:t></w:r></w:p></w:body></w:document>`,
        'utf-8',
      ),
    );
    const ctx: HumanizeContext = {
      fieldLabels: { x: 'X' },
      fieldDefaults: {},
    };
    const out = humanizeDocxBuffer(zip.toBuffer(), ctx);
    const png = new AdmZip(out).getEntry('media/image1.png');
    expect(png).not.toBeNull();
    expect(png!.getData()).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(readPart(out, 'word/document.xml')).toContain('[X]');
  });
});

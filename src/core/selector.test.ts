/**
 * Unit tests for selector.ts — standalone checkbox support.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { applySelections, SelectionsConfigSchema } from './selector.js';
import type { SelectionsConfig } from './selector.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'sel-test-'));
  tempDirs.push(d);
  return d;
}

/**
 * Create a minimal DOCX with a single document.xml containing the given
 * <w:body> inner XML. Returns the path to the .docx file.
 */
function buildTestDocx(bodyInnerXml: string): string {
  const dir = makeTempDir();
  const docxPath = join(dir, 'test.docx');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${bodyInnerXml}</w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes));
  zip.addFile('_rels/.rels', Buffer.from(rels));
  zip.addFile('word/document.xml', Buffer.from(documentXml));
  zip.writeZip(docxPath);
  return docxPath;
}

/** Extract all <w:t> text from a DOCX. */
function extractText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';
  const doc = new DOMParser().parseFromString(entry.getData().toString('utf-8'), 'text/xml');
  const tEls = doc.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tEls.length; i++) {
    parts.push(tEls[i].textContent ?? '');
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Helper to make paragraph XML with marker prefix
// ---------------------------------------------------------------------------

function para(text: string): string {
  return `<w:p xmlns:w="${W_NS}"><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function tableCell(...paragraphs: string[]): string {
  return `<w:tc xmlns:w="${W_NS}"><w:tcPr/>${paragraphs.join('')}</w:tc>`;
}

function tableRow(...cells: string[]): string {
  return `<w:tr xmlns:w="${W_NS}">${cells.join('')}</w:tr>`;
}

function table(...rows: string[]): string {
  return `<w:tbl xmlns:w="${W_NS}"><w:tblPr/>${rows.join('')}</w:tbl>`;
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('SelectionsConfigSchema', () => {
  it('rejects standalone:false group with < 2 options', () => {
    const result = SelectionsConfigSchema.safeParse({
      groups: [{
        id: 'test',
        type: 'checkbox',
        options: [{ marker: 'Only one', trigger: 'default' }],
      }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts standalone:true group with 1 option', () => {
    const result = SelectionsConfigSchema.safeParse({
      groups: [{
        id: 'test',
        type: 'checkbox',
        standalone: true,
        options: [{ marker: 'Just one', trigger: { field: 'flag' } }],
      }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts non-standalone group with 2+ options', () => {
    const result = SelectionsConfigSchema.safeParse({
      groups: [{
        id: 'test',
        type: 'radio',
        options: [
          { marker: 'Option A', trigger: 'default' },
          { marker: 'Option B', trigger: { field: 'pick_b' } },
        ],
      }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts group with cellContext', () => {
    const result = SelectionsConfigSchema.safeParse({
      groups: [{
        id: 'test',
        type: 'radio',
        cellContext: 'General Cap',
        options: [
          { marker: 'Option A', trigger: 'default' },
          { marker: 'Option B', trigger: { field: 'pick_b' } },
        ],
      }],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Standalone checkbox behavior
// ---------------------------------------------------------------------------

describe('standalone checkbox', () => {
  it('removes unselected standalone option paragraph', async () => {
    const body = table(
      tableRow(
        tableCell(
          para('Header text'),
          para('[ ] ISO 27001 certified'),
        ),
      ),
      tableRow(
        tableCell(
          para('[ ] SOC 2 Type II audit'),
        ),
      ),
    );
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'has_iso',
        type: 'checkbox',
        standalone: true,
        options: [{ marker: 'ISO 27001', trigger: { field: 'has_iso' } }],
      }, {
        id: 'has_soc2',
        type: 'checkbox',
        standalone: true,
        options: [{ marker: 'SOC 2 Type II', trigger: { field: 'has_soc2' } }],
      }],
    };

    // Only has_iso is true
    await applySelections(inputPath, outputPath, config, { has_iso: true });

    const text = extractText(outputPath);
    expect(text).toContain('ISO 27001');
    expect(text).not.toContain('SOC 2 Type II');
  });

  it('marks selected standalone option as checked', async () => {
    const body = table(
      tableRow(
        tableCell(para('[ ] GDPR compliant')),
      ),
    );
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'gdpr',
        type: 'checkbox',
        standalone: true,
        options: [{ marker: 'GDPR compliant', trigger: { field: 'is_gdpr' } }],
      }],
    };

    await applySelections(inputPath, outputPath, config, { is_gdpr: true });

    const text = extractText(outputPath);
    expect(text).toContain('[ x ]');
    expect(text).toContain('GDPR compliant');
  });

  it('removes sub-clauses after unselected standalone option', async () => {
    const body = table(
      tableRow(
        tableCell(
          para('[ ] ISO 27001 certified'),
          para('Subcertification details here'),
          para('More details'),
          para('[ ] SOC 2 Type II audit'),
          para('SOC details here'),
        ),
      ),
    );
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'has_iso',
        type: 'checkbox',
        standalone: true,
        options: [{ marker: 'ISO 27001', trigger: { field: 'has_iso' } }],
      }, {
        id: 'has_soc2',
        type: 'checkbox',
        standalone: true,
        options: [{ marker: 'SOC 2 Type II', trigger: { field: 'has_soc2' } }],
      }],
    };

    // Neither selected
    await applySelections(inputPath, outputPath, config, {});

    const text = extractText(outputPath);
    expect(text).not.toContain('ISO 27001');
    expect(text).not.toContain('Subcertification');
    expect(text).not.toContain('More details');
    expect(text).not.toContain('SOC 2 Type II');
    expect(text).not.toContain('SOC details');
  });

  it('handles single qualifying cell without cellContext', async () => {
    const body = table(
      tableRow(
        tableCell(
          para('General Cap Amount'),
          para('( ) Multiplier-based cap'),
          para('( ) Dollar-based cap'),
        ),
      ),
    );
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'general_cap',
        type: 'radio',
        options: [
          { marker: 'Multiplier-based cap', trigger: 'default' },
          { marker: 'Dollar-based cap', trigger: { field: 'use_dollar' } },
        ],
      }],
    };

    await applySelections(inputPath, outputPath, config, {});

    const text = extractText(outputPath);
    expect(text).toContain('Multiplier-based cap');
    expect(text).not.toContain('Dollar-based cap');
  });

  it('preserves selected option but removes unselected in same cell', async () => {
    const body = table(
      tableRow(
        tableCell(
          para('[ ] Option A stuff'),
          para('A details'),
          para('[ ] Option B stuff'),
          para('B details'),
        ),
      ),
    );
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'a',
        type: 'checkbox',
        standalone: true,
        options: [{ marker: 'Option A', trigger: { field: 'want_a' } }],
      }, {
        id: 'b',
        type: 'checkbox',
        standalone: true,
        options: [{ marker: 'Option B', trigger: { field: 'want_b' } }],
      }],
    };

    await applySelections(inputPath, outputPath, config, { want_a: true });

    const text = extractText(outputPath);
    expect(text).toContain('Option A');
    expect(text).toContain('A details');
    expect(text).not.toContain('Option B');
    expect(text).not.toContain('B details');
  });
});

// ---------------------------------------------------------------------------
// Cross-cell disambiguation
// ---------------------------------------------------------------------------

describe('cross-cell disambiguation', () => {
  const duplicateBody = table(
    tableRow(
      tableCell(
        para('General Cap Amount'),
        para('[ ] Multiplier cap'),
        para('[ ] Dollar cap'),
      ),
      tableCell(
        para('Increased Cap Amount'),
        para('[ ] Multiplier cap'),
        para('[ ] Dollar cap'),
      ),
    ),
  );

  it('throws when multiple cells match and no cellContext provided', async () => {
    const inputPath = buildTestDocx(duplicateBody);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'general_cap',
        type: 'checkbox',
        options: [
          { marker: 'Multiplier cap', trigger: { field: 'use_mult' } },
          { marker: 'Dollar cap', trigger: { field: 'use_dollar' } },
        ],
      }],
    };

    await expect(
      applySelections(inputPath, outputPath, config, { use_mult: true }),
    ).rejects.toThrow(/cellContext/);
  });

  it('selects correct cell when cellContext is provided', async () => {
    const inputPath = buildTestDocx(duplicateBody);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [
        {
          id: 'general_cap',
          type: 'checkbox',
          cellContext: 'General Cap Amount',
          options: [
            { marker: 'Multiplier cap', trigger: { field: 'gen_mult' } },
            { marker: 'Dollar cap', trigger: { field: 'gen_dollar' } },
          ],
        },
        {
          id: 'increased_cap',
          type: 'checkbox',
          cellContext: 'Increased Cap Amount',
          options: [
            { marker: 'Multiplier cap', trigger: { field: 'inc_mult' } },
            { marker: 'Dollar cap', trigger: { field: 'inc_dollar' } },
          ],
        },
      ],
    };

    // Select multiplier for General Cap, dollar for Increased Cap
    await applySelections(inputPath, outputPath, config, {
      gen_mult: true,
      inc_dollar: true,
    });

    const text = extractText(outputPath);
    // General Cap cell: multiplier checked, dollar removed
    expect(text).toContain('General Cap Amount');
    expect(text).toContain('Increased Cap Amount');
    // Both cells were processed independently
    expect(text).toContain('Multiplier cap'); // from general cap
    expect(text).toContain('Dollar cap'); // from increased cap
  });

  it('throws when cellContext matches zero cells', async () => {
    const inputPath = buildTestDocx(duplicateBody);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'mystery_cap',
        type: 'checkbox',
        cellContext: 'Nonexistent Section',
        options: [
          { marker: 'Multiplier cap', trigger: { field: 'use_mult' } },
          { marker: 'Dollar cap', trigger: { field: 'use_dollar' } },
        ],
      }],
    };

    await expect(
      applySelections(inputPath, outputPath, config, { use_mult: true }),
    ).rejects.toThrow(/did not match any/);
  });
});

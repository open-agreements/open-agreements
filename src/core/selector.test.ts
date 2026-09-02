/**
 * Unit tests for selector.ts — standalone checkbox support.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import {
  applySelections,
  classifySelectionMatches,
  describeSelectionOption,
  SelectionsConfigSchema,
} from './selector.js';
import type { SelectionsConfig } from './selector.js';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';

const it = itAllure.epic('Filling & Rendering');

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

/** Read the raw word/document.xml from a DOCX (for structural assertions). */
function readDocumentXml(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  return entry ? entry.getData().toString('utf-8') : '';
}

// ---------------------------------------------------------------------------
// Helper to make paragraph XML with marker prefix
// ---------------------------------------------------------------------------

function para(text: string): string {
  return `<w:p xmlns:w="${W_NS}"><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

/**
 * Paragraph containing leading text followed by a complex Word cross-reference
 * field (fldChar begin/separate/end + instrText) whose cached result is `fieldResult`.
 * Mirrors the real NVCA "Additional Closings" clause structure from issue #479.
 */
function paraWithComplexField(leadingText: string, fieldResult: string): string {
  return (
    `<w:p xmlns:w="${W_NS}">` +
    `<w:r><w:t xml:space="preserve">${leadingText}</w:t></w:r>` +
    `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r><w:instrText xml:space="preserve"> REF _Ref137575642 \\r \\h  \\* MERGEFORMAT </w:instrText></w:r>` +
    `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
    `<w:r><w:t>${fieldResult}</w:t></w:r>` +
    `<w:r><w:fldChar w:fldCharType="end"/></w:r>` +
    `</w:p>`
  );
}

/** Paragraph whose ONLY content is a simple field (<w:fldSimple>). */
function paraWithSimpleField(fieldResult: string): string {
  return (
    `<w:p xmlns:w="${W_NS}">` +
    `<w:fldSimple w:instr=" REF _Ref137575642 \\h "><w:r><w:t>${fieldResult}</w:t></w:r></w:fldSimple>` +
    `</w:p>`
  );
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

// ---------------------------------------------------------------------------
// Markerless selections
// ---------------------------------------------------------------------------

describe('markerless selections', () => {
  it('removes paragraph when trigger does not fire', async () => {
    const body = `
      ${para('Section 1.2(a) Initial Closing.')}
      ${para('Additional Closings. The Company may sell additional shares.')}
      ${para('Sub-clause detail about additional closings.')}
      ${para('Section 1.2(c) Tranche Closing.')}
    `;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'additional_closings',
        type: 'checkbox',
        standalone: true,
        markerless: true,
        options: [{
          marker: 'Additional Closings',
          trigger: { field: 'closing_type', equals: 'additional' },
        }],
      }],
    };

    await applySelections(inputPath, outputPath, config, { closing_type: 'single' });

    const text = extractText(outputPath);
    expect(text).toContain('Initial Closing');
    expect(text).not.toContain('Additional Closings');
    expect(text).not.toContain('Sub-clause detail');
    expect(text).toContain('Tranche Closing');
  });

  it('keeps paragraph when trigger fires', async () => {
    const body = `
      ${para('Section 1.2(a) Initial Closing.')}
      ${para('Additional Closings. The Company may sell additional shares.')}
      ${para('Sub-clause detail about additional closings.')}
      ${para('Section 1.2(c) Tranche Closing.')}
    `;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'additional_closings',
        type: 'checkbox',
        standalone: true,
        markerless: true,
        options: [{
          marker: 'Additional Closings',
          trigger: { field: 'closing_type', equals: 'additional' },
        }],
      }],
    };

    await applySelections(inputPath, outputPath, config, { closing_type: 'additional' });

    const text = extractText(outputPath);
    expect(text).toContain('Initial Closing');
    expect(text).toContain('Additional Closings');
    expect(text).toContain('Sub-clause detail');
    expect(text).toContain('Tranche Closing');
  });

  it('replaces paragraph text with replaceWith when unselected', async () => {
    const body = `
      ${para('Section 1.2(a) Initial Closing.')}
      ${para('Additional Closings. The Company may sell additional shares.')}
      ${para('Sub-clause detail about additional closings.')}
      ${para('Section 1.2(c) Tranche Closing.')}
    `;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'additional_closings',
        type: 'checkbox',
        standalone: true,
        markerless: true,
        options: [{
          marker: 'Additional Closings',
          trigger: { field: 'closing_type', equals: 'additional' },
          replaceWith: '[Reserved]',
        }],
      }],
    };

    await applySelections(inputPath, outputPath, config, { closing_type: 'single' });

    const text = extractText(outputPath);
    expect(text).toContain('Initial Closing');
    expect(text).toContain('[Reserved]');
    expect(text).not.toContain('Additional Closings');
    expect(text).not.toContain('Sub-clause detail');
    expect(text).toContain('Tranche Closing');
  });

  it('schema accepts markerless:true group with 1 option', () => {
    const result = SelectionsConfigSchema.safeParse({
      groups: [{
        id: 'test',
        type: 'checkbox',
        standalone: true,
        markerless: true,
        options: [{ marker: 'Some text', trigger: { field: 'flag' } }],
      }],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Inline selections
// ---------------------------------------------------------------------------

describe('inline selections', () => {
  it('deletes inline marker text when trigger does not fire', async () => {
    const body = `
      ${para('Purchase at the Closing). , [Each Purchaser shall buy Tranche Shares.] The Company agrees.')}
    `;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'tranche_inline',
        type: 'checkbox',
        standalone: true,
        markerless: true,
        inline: true,
        options: [{
          marker: ', [Each Purchaser shall buy Tranche Shares.]',
          trigger: { field: 'include_tranche', equals: true },
          replaceWith: '',
        }],
      }],
    };

    await applySelections(inputPath, outputPath, config, {});

    const text = extractText(outputPath);
    expect(text).toContain('Purchase at the Closing).');
    expect(text).toContain('The Company agrees.');
    expect(text).not.toContain('Each Purchaser shall buy Tranche Shares');
  });

  it('keeps inline text when trigger fires', async () => {
    const body = `
      ${para('Purchase at the Closing). , [Each Purchaser shall buy Tranche Shares.] The Company agrees.')}
    `;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'tranche_inline',
        type: 'checkbox',
        standalone: true,
        markerless: true,
        inline: true,
        options: [{
          marker: ', [Each Purchaser shall buy Tranche Shares.]',
          trigger: { field: 'include_tranche', equals: true },
          replaceWith: '',
        }],
      }],
    };

    await applySelections(inputPath, outputPath, config, { include_tranche: true });

    const text = extractText(outputPath);
    expect(text).toContain('Each Purchaser shall buy Tranche Shares');
    expect(text).toContain('Purchase at the Closing).');
    expect(text).toContain('The Company agrees.');
  });

  it('replaces inline text with non-empty replaceWith', async () => {
    const body = `
      ${para('Before [optional clause] after.')}
    `;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'optional_inline',
        type: 'checkbox',
        standalone: true,
        markerless: true,
        inline: true,
        options: [{
          marker: '[optional clause]',
          trigger: { field: 'keep_optional', equals: true },
          replaceWith: '[REPLACED]',
        }],
      }],
    };

    await applySelections(inputPath, outputPath, config, {});

    const text = extractText(outputPath);
    expect(text).toContain('Before [REPLACED] after.');
    expect(text).not.toContain('optional clause');
  });

  it('matches smart quotes against ASCII quotes in marker', async () => {
    // Use smart quotes in the document text (\u201C and \u201D)
    const body = `
      ${para('Purchase at the Closing). , [Each Purchaser\u2019s \u201CShares\u201D here.] Done.')}
    `;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'smart_quote_test',
        type: 'checkbox',
        standalone: true,
        markerless: true,
        inline: true,
        options: [{
          // ASCII quotes in marker — normalizeQuotes should match
          marker: ', [Each Purchaser\'s "Shares" here.]',
          trigger: { field: 'keep_it', equals: true },
          replaceWith: '',
        }],
      }],
    };

    await applySelections(inputPath, outputPath, config, {});

    const text = extractText(outputPath);
    expect(text).toContain('Purchase at the Closing).');
    expect(text).toContain('Done.');
    expect(text).not.toContain('Shares');
  });

  it('schema rejects inline:true without markerless:true', () => {
    const result = SelectionsConfigSchema.safeParse({
      groups: [{
        id: 'bad',
        type: 'checkbox',
        standalone: true,
        inline: true,
        options: [{ marker: 'text', trigger: { field: 'flag' } }],
      }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('inline');
    }
  });
});

// ---------------------------------------------------------------------------
// Field-construct stripping on replaceWith substitution (issue #479)
// ---------------------------------------------------------------------------

describe('replaceWith strips orphaned field constructs', () => {
  const fieldGroup: SelectionsConfig = {
    groups: [{
      id: 'additional_closings',
      type: 'checkbox',
      standalone: true,
      markerless: true,
      options: [{
        marker: 'Additional Closings',
        trigger: { field: 'closing_type', equals: 'additional' },
        replaceWith: '[Reserved]',
      }],
    }],
  };

  it('removes fldChar/instrText when the option is de-selected (the #479 fix)', async () => {
    const body = `
      ${para('Section 1.2(a) Initial Closing.')}
      ${paraWithComplexField('Additional Closings. See ', 'Exhibit A')}
      ${para('Section 1.2(c) Tranche Closing.')}
    `;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    await applySelections(inputPath, outputPath, fieldGroup, { closing_type: 'single' });

    const xml = readDocumentXml(outputPath);
    // No field machinery survives — so nothing re-resolves to "Exhibit A".
    expect(xml).not.toContain('<w:fldChar');
    expect(xml).not.toContain('<w:instrText');

    const text = extractText(outputPath);
    expect(text).toContain('[Reserved]');
    expect(text).not.toContain('Exhibit A');
    expect(text).not.toContain('Additional Closings');
  });

  it('leaves the field intact when the option is selected (control)', async () => {
    const body = `
      ${para('Section 1.2(a) Initial Closing.')}
      ${paraWithComplexField('Additional Closings. See ', 'Exhibit A')}
      ${para('Section 1.2(c) Tranche Closing.')}
    `;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    await applySelections(inputPath, outputPath, fieldGroup, { closing_type: 'additional' });

    const xml = readDocumentXml(outputPath);
    // Kept paragraph: field machinery must remain untouched.
    expect(xml).toContain('<w:fldChar');
    expect(xml).toContain('<w:instrText');

    const text = extractText(outputPath);
    expect(text).toContain('Additional Closings');
    expect(text).toContain('Exhibit A');
  });

  it('renders [Reserved] when the paragraph was entirely a simple field', async () => {
    const body = `
      ${para('Section 1.2(a) Initial Closing.')}
      ${paraWithSimpleField('Additional Closings (Exhibit A)')}
      ${para('Section 1.2(c) Tranche Closing.')}
    `;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    await applySelections(inputPath, outputPath, fieldGroup, { closing_type: 'single' });

    const xml = readDocumentXml(outputPath);
    expect(xml).not.toContain('<w:fldSimple');

    const text = extractText(outputPath);
    // Placeholder is not silently dropped despite there being no <w:t> left after stripping.
    expect(text).toContain('[Reserved]');
    expect(text).not.toContain('Exhibit A');
  });
});

// ---------------------------------------------------------------------------
// Zero-match reporting (#720)
//
// `processMarkerlessGroup()` used to `continue` when an option's marker matched
// nothing. For an UNSELECTED option that inverts the intent: "remove this
// alternative" silently becomes "keep it", and the filled document ships BOTH
// alternatives — a legally wrong document that renders cleanly and passes every
// other check. `applySelections()` now returns per-option match counts so the
// caller can reject that outcome.
// ---------------------------------------------------------------------------

describe('selections zero-match reporting (#720)', () => {
  /**
   * Two mutually-exclusive dispute-resolution alternatives in one document.
   * `driftedArbitrationMarker` reproduces upstream source drift: the config's
   * marker for the arbitration alternative is one word away from the prose that
   * is actually in the document.
   */
  function twoAlternativeDoc(): string {
    return `
      ${para('Governing Law. This Agreement is governed by the laws of the State of Delaware.')}
      ${para('Any dispute arising under this Agreement shall be resolved by binding arbitration before a single arbitrator.')}
      ${para('Each party irrevocably submits to the jurisdiction of the state courts of Delaware for any dispute arising under this Agreement.')}
    `;
  }

  function disputeConfig(arbitrationMarker: string): SelectionsConfig {
    return {
      groups: [{
        id: 'dispute_resolution',
        type: 'radio',
        markerless: true,
        options: [
          {
            marker: arbitrationMarker,
            trigger: { field: 'dispute_resolution_mode', equals: 'arbitration' },
          },
          {
            marker: 'irrevocably submits to the jurisdiction of the state courts of',
            trigger: 'default',
          },
        ],
      }],
    };
  }

  const ACCURATE_ARBITRATION_MARKER = 'shall be resolved by binding arbitration before a single arbitrator';
  // One word drifted ("binding" dropped) — exactly how an NVCA reissue breaks a marker.
  const DRIFTED_ARBITRATION_MARKER = 'shall be resolved by arbitration before a single arbitrator';

  it('[OA-SEL-020] reports a per-option match count and selected flag for every option', async () => {
    const inputPath = buildTestDocx(twoAlternativeDoc());
    const outputPath = join(makeTempDir(), 'out.docx');

    const result = await applySelections(
      inputPath,
      outputPath,
      disputeConfig(ACCURATE_ARBITRATION_MARKER),
      {},
    );

    expect(result.outputPath).toBe(outputPath);
    expect(result.options).toHaveLength(2);
    expect(result.options[0]).toMatchObject({
      groupId: 'dispute_resolution',
      optionIndex: 0,
      selected: false,
      matchCount: 1,
    });
    expect(result.options[1]).toMatchObject({
      groupId: 'dispute_resolution',
      optionIndex: 1,
      selected: true,
      matchCount: 1,
    });
    // Sanity: with an accurate marker the unselected alternative really is removed.
    expect(extractText(outputPath)).not.toContain('binding arbitration');
  });

  it('[OA-SEL-021] a drifted marker on an UNSELECTED option reports zero matches and leaves BOTH alternatives in the document', async () => {
    const inputPath = buildTestDocx(twoAlternativeDoc());
    const outputPath = join(makeTempDir(), 'out.docx');

    const result = await applySelections(
      inputPath,
      outputPath,
      disputeConfig(DRIFTED_ARBITRATION_MARKER),
      {},
    );

    // This is the silent failure the guard exists to catch: the arbitration
    // alternative was meant to be deleted and is still there, alongside the
    // courts alternative that was selected.
    const text = extractText(outputPath);
    expect(text).toContain('binding arbitration before a single arbitrator');
    expect(text).toContain('state courts of Delaware');

    // …and it is now visible in the returned result rather than silent.
    expect(result.options[0]).toMatchObject({ optionIndex: 0, selected: false, matchCount: 0 });
    expect(result.options[1]).toMatchObject({ optionIndex: 1, selected: true, matchCount: 1 });

    const anomalies = classifySelectionMatches(result);
    expect(anomalies.unremovedInEngagedGroup).toHaveLength(1);
    expect(anomalies.unremovedInEngagedGroup[0].optionIndex).toBe(0);
    expect(anomalies.unremovedInInertGroup).toHaveLength(0);
    expect(anomalies.selectedZeroMatch).toHaveLength(0);
    expect(describeSelectionOption(anomalies.unremovedInEngagedGroup[0]))
      .toContain('dispute_resolution[0]');
  });

  it('[OA-SEL-022] a group where NO option matches is classified as inert, not as the dangerous case', async () => {
    // A document that carries neither alternative — a partial fixture or a
    // different source variant. Nothing was left half-removed.
    const inputPath = buildTestDocx(`${para('Governing Law. This Agreement is governed by the laws of the State of Delaware.')}`);
    const outputPath = join(makeTempDir(), 'out.docx');

    const result = await applySelections(
      inputPath,
      outputPath,
      disputeConfig(ACCURATE_ARBITRATION_MARKER),
      { dispute_resolution_mode: 'arbitration' },
    );

    const anomalies = classifySelectionMatches(result);
    expect(anomalies.unremovedInEngagedGroup).toHaveLength(0);
    expect(anomalies.unremovedInInertGroup).toHaveLength(1);
    expect(anomalies.unremovedInInertGroup[0].optionIndex).toBe(1);
    // The SELECTED option also matched nothing — reported separately, because a
    // missing kept-alternative fails visibly rather than silently.
    expect(anomalies.selectedZeroMatch).toHaveLength(1);
    expect(anomalies.selectedZeroMatch[0].optionIndex).toBe(0);
  });

  it('[OA-SEL-023] reports match counts for standalone and cell-based groups too', async () => {
    const body = `
      ${para('Additional Closings. The Company may sell additional shares after the Initial Closing.')}
    `;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [
        {
          id: 'additional_closings',
          type: 'checkbox',
          markerless: true,
          options: [{ marker: 'Additional Closings', trigger: { field: 'closing_type', equals: 'additional' } }],
        },
        {
          // A cell-based group whose markers are nowhere in this document.
          id: 'cell_based_group',
          type: 'radio',
          cellContext: 'Interest Rate',
          options: [
            { marker: 'Fixed rate', trigger: { field: 'rate_mode', equals: 'fixed' } },
            { marker: 'Floating rate', trigger: 'default' },
          ],
        },
        {
          id: 'standalone_group',
          type: 'checkbox',
          standalone: true,
          options: [{ marker: 'Optional covenant', trigger: { field: 'include_covenant', equals: true } }],
        },
      ],
    };

    const result = await applySelections(inputPath, outputPath, config, {});

    // Every (group, option) pair is reported, in config order, even for groups
    // that returned early without touching the document.
    expect(result.options.map((o) => `${o.groupId}[${o.optionIndex}]`)).toEqual([
      'additional_closings[0]',
      'cell_based_group[0]',
      'cell_based_group[1]',
      'standalone_group[0]',
    ]);
    expect(result.options[0].matchCount).toBe(1);
    expect(result.options[1].matchCount).toBe(0);
    expect(result.options[2].matchCount).toBe(0);
    expect(result.options[3].matchCount).toBe(0);

    const anomalies = classifySelectionMatches(result);
    // No group is both engaged and half-removed, so nothing is the dangerous case.
    expect(anomalies.unremovedInEngagedGroup).toHaveLength(0);
  });

  it('[OA-SEL-029] a cell-based group whose options live in DIFFERENT cells is caught even though both markers match', async () => {
    // Found in peer review of #720. `processGroup()` needs every option of a
    // cell-based group to appear in ONE table cell. When they are split across
    // cells it resolves no qualifying cell, returns without touching anything,
    // and BOTH alternatives survive — while every option still reports a
    // non-zero match count. Keying the guard on matchCount alone would have
    // reported nothing here, which is the exact silent-corruption shape #720
    // exists to eliminate.
    const body =
      `<w:tbl xmlns:w="${W_NS}"><w:tr>` +
      `<w:tc>${para('( ) Alternative A: the parties will arbitrate.')}</w:tc>` +
      `<w:tc>${para('( ) Alternative B: the parties will litigate.')}</w:tc>` +
      `</w:tr></w:tbl>`;
    const inputPath = buildTestDocx(body);
    const outputPath = join(makeTempDir(), 'out.docx');

    const config: SelectionsConfig = {
      groups: [{
        id: 'split_cells',
        type: 'radio',
        options: [
          { marker: 'Alternative A', trigger: { field: 'choice', equals: 'a' } },
          { marker: 'Alternative B', trigger: 'default' },
        ],
      }],
    };

    const result = await applySelections(inputPath, outputPath, config, {});

    // Nothing was removed: the document really does still carry both.
    const text = extractText(outputPath);
    expect(text).toContain('Alternative A');
    expect(text).toContain('Alternative B');

    // Both options matched, and neither was acted on.
    expect(result.options[0]).toMatchObject({ optionIndex: 0, selected: false, matchCount: 1, appliedCount: 0 });
    expect(result.options[1]).toMatchObject({ optionIndex: 1, selected: true, matchCount: 1, appliedCount: 0 });

    const anomalies = classifySelectionMatches(result);
    expect(anomalies.unremovedInEngagedGroup).toHaveLength(1);
    expect(anomalies.unremovedInEngagedGroup[0].optionIndex).toBe(0);
    expect(anomalies.selectedZeroMatch).toHaveLength(0);
  });
});

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const tempDirs: string[] = [];
const it = itAllure.epic('Cleaning & Normalization');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

interface DeclarativeOption {
  contains: string;
}

interface DeclarativePruneRule {
  id: string;
  section_heading: string;
  mode_field: string;
  default_mode: string;
  options: Record<string, DeclarativeOption>;
}

interface PruneResult {
  applied: number;
  warnings: string[];
}

interface DeclarativeParagraphRule {
  id: string;
  section_heading: string;
  section_heading_any?: string[];
  ignore_heading?: boolean;
  paragraph_contains: string;
  replacements?: Record<string, string>;
  trim_unmatched_trailing_bracket?: boolean;
}

async function applyDeclarativePrunePrototype(
  inputPath: string,
  outputPath: string,
  rule: DeclarativePruneRule,
  modeValue?: string
): Promise<PruneResult> {
  const selectedMode = modeValue ?? rule.default_mode;
  const selectedOption = rule.options[selectedMode];
  if (!selectedOption) {
    throw new Error(`Unknown mode "${selectedMode}" for rule ${rule.id}`);
  }

  const warnings: string[] = [];
  let applied = 0;

  const zip = new AdmZip(inputPath);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('word/document.xml missing');

  const xml = entry.getData().toString('utf-8');
  const doc = parser.parseFromString(xml, 'text/xml');
  const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  let lastHeading = '';

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i] as any;
    const original = extractParagraphText(para).trim();
    if (!original) continue;

    const isHeadingLike = !original.startsWith('.') && !original.includes('[') && original.replaceAll('.', '').trim().length > 0;
    if (isHeadingLike) {
      lastHeading = original;
      continue;
    }

    if (!lastHeading.includes(rule.section_heading)) {
      continue;
    }

    const segments = extractTopLevelSegments(original);
    if (segments.length === 0) continue;

    let mutated = original;
    let optionMatched = false;

    const ordered = [...segments].sort((a, b) => b.start - a.start);
    for (const segment of ordered) {
      const inner = segment.inner.trim();
      let replacement = segment.raw;

      if (inner.includes(selectedOption.contains)) {
        replacement = selectedOption.contains;
        optionMatched = true;
      } else if (Object.values(rule.options).some((option) => inner.includes(option.contains))) {
        replacement = '';
      }

      mutated = `${mutated.slice(0, segment.start)}${replacement}${mutated.slice(segment.end + 1)}`;
    }

    if (!optionMatched) {
      warnings.push(`Rule ${rule.id}: selected option not found in paragraph under heading "${lastHeading}"`);
      continue;
    }

    mutated = mutated
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+\./g, '.')
      .replace(/^\.\s*/, '')
      .trim();

    setParagraphText(para, mutated);
    applied += 1;
  }

  zip.updateFile('word/document.xml', Buffer.from(serializer.serializeToString(doc), 'utf-8'));
  writeFileSync(outputPath, zip.toBuffer());

  return { applied, warnings };
}

async function applyDeclarativeParagraphRulesPrototype(
  inputPath: string,
  outputPath: string,
  rules: DeclarativeParagraphRule[]
): Promise<PruneResult> {
  const warnings: string[] = [];
  let applied = 0;
  const matchedRuleIds = new Set<string>();

  const zip = new AdmZip(inputPath);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('word/document.xml missing');

  const xml = entry.getData().toString('utf-8');
  const doc = parser.parseFromString(xml, 'text/xml');
  const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  let lastHeading = '';

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i] as any;
    const original = extractParagraphText(para).trim();
    if (!original) continue;

    const isHeadingLike = !original.startsWith('.') && !original.includes('[') && original.replaceAll('.', '').trim().length > 0;
    if (isHeadingLike) {
      lastHeading = original;
      continue;
    }

    for (const rule of rules) {
      if (!matchesHeading(rule, lastHeading)) continue;
      if (!original.includes(rule.paragraph_contains)) continue;

      let mutated = original;

      for (const [token, value] of Object.entries(rule.replacements ?? {})) {
        mutated = mutated.split(token).join(value);
      }

      if (rule.trim_unmatched_trailing_bracket) {
        const openCount = (mutated.match(/\[/g) ?? []).length;
        const closeCount = (mutated.match(/\]/g) ?? []).length;
        if (closeCount > openCount) {
          mutated = mutated.replace(/\]+$/g, '');
        }
      }

      mutated = mutated
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+\./g, '.')
        .trim();

      if (mutated !== original) {
        setParagraphText(para, mutated);
        applied += 1;
      }
      matchedRuleIds.add(rule.id);
      break;
    }
  }

  for (const rule of rules) {
    if (!matchedRuleIds.has(rule.id)) {
      warnings.push(`Rule ${rule.id}: no matching paragraph found`);
    }
  }

  zip.updateFile('word/document.xml', Buffer.from(serializer.serializeToString(doc), 'utf-8'));
  writeFileSync(outputPath, zip.toBuffer());

  return { applied, warnings };
}

function matchesHeading(rule: DeclarativeParagraphRule, heading: string): boolean {
  if (rule.ignore_heading) return true;
  if (heading.includes(rule.section_heading)) return true;
  for (const alias of rule.section_heading_any ?? []) {
    if (heading.includes(alias)) return true;
  }
  return false;
}

function extractTopLevelSegments(text: string): Array<{ start: number; end: number; raw: string; inner: string }> {
  const out: Array<{ start: number; end: number; raw: string; inner: string }> = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === ']') {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start !== -1) {
        const raw = text.slice(start, i + 1);
        out.push({ start, end: i, raw, inner: raw.slice(1, -1) });
        start = -1;
      }
    }
  }

  return out;
}

function buildDocx(paragraphs: string[]): Buffer {
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

  const wordRels =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`)
    .join('');

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(rels, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(wordRels, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  return zip.toBuffer();
}

function readDocText(path: string): string {
  const zip = new AdmZip(path);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';
  const xml = entry.getData().toString('utf-8');
  const paragraphs: string[] = [];
  for (const m of xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)) {
    const text = [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((entryMatch) => entryMatch[1])
      .join('')
      .trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs.join('\n');
}

function extractParagraphText(para: any): string {
  const tElements = para.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tElements.length; i++) {
    parts.push(tElements[i].textContent ?? '');
  }
  return parts.join('');
}

function setParagraphText(para: any, text: string): void {
  const tElements = para.getElementsByTagNameNS(W_NS, 't');
  if (tElements.length === 0) return;
  tElements[0].textContent = text;
  for (let i = 1; i < tElements.length; i++) {
    tElements[i].textContent = '';
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

describe('declarative prune prototype', () => {
  const rule: DeclarativePruneRule = {
    id: 'costs-of-enforcement',
    section_heading: 'Costs of Enforcement',
    mode_field: 'costs_enforcement_mode',
    default_mode: 'each_party_owns_costs',
    options: {
      prevailing_party: {
        contains: 'If any action at law or in equity',
      },
      each_party_owns_costs: {
        contains: 'Each party will bear its own costs in respect of any disputes arising under this Agreement.',
      },
    },
  };

  it('keeps only selected option via declarative anchors', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-prune-prototype-'));
    tempDirs.push(dir);
    const input = join(dir, 'input.docx');
    const output = join(dir, 'output.docx');

    writeFileSync(
      input,
      buildDocx([
        'Costs of Enforcement',
        '. [If any action at law or in equity (including, arbitration) is necessary to enforce or interpret the terms of any of the Transaction Agreements, the prevailing party shall be entitled to reasonable attorneys’ fees, costs and necessary disbursements in addition to any other relief to which such party may be entitled.] [Each party will bear its own costs in respect of any disputes arising under this Agreement.]',
      ])
    );

    const result = await applyDeclarativePrunePrototype(input, output, rule, 'each_party_owns_costs');
    const text = readDocText(output);

    expect(result.applied).toBe(1);
    expect(result.warnings).toEqual([]);
    expect(text).toContain('Costs of Enforcement');
    expect(text).toContain('Each party will bear its own costs in respect of any disputes arising under this Agreement.');
    expect(text).not.toContain('prevailing party shall be entitled');
    expect(text).not.toContain('[');
    expect(text).not.toContain(']');
  });

  it('emits warning when selected option anchor is not found', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-prune-prototype-warning-'));
    tempDirs.push(dir);
    const input = join(dir, 'input.docx');
    const output = join(dir, 'output.docx');

    writeFileSync(
      input,
      buildDocx([
        'Costs of Enforcement',
        '. [If any action at law or in equity is necessary.]',
      ])
    );

    const result = await applyDeclarativePrunePrototype(input, output, rule, 'each_party_owns_costs');
    const text = readDocText(output);

    expect(result.applied).toBe(0);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('selected option not found');
    expect(text).toContain('[If any action at law or in equity is necessary.]');
  });

  it('fills and cleans targeted NVCA clauses via declarative paragraph rules', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-prune-prototype-nvca-'));
    tempDirs.push(dir);
    const input = join(dir, 'input.docx');
    const output = join(dir, 'output.docx');

    writeFileSync(
      input,
      buildDocx([
        'Conditions of the Purchasers’ Obligations at Closing',
        '. The Purchasers shall have received from [___________], counsel for the Company, an opinion, dated as of the Initial Closing, in substantially the form of Exhibit I attached to this Agreement.]',
        '. As of the Initial Closing, the authorized size of the Board of Directors shall be [______], and the Board of Directors shall be comprised of [_________________].]',
        '. A minimum of [_________] Shares must be sold at the Initial Closing.]',
        'Representations and Warranties of the Purchaser',
        '. Except as otherwise disclosed in writing to the Company, the Purchaser is not a “person of a country of concern” within the meaning of the Outbound Investment Security Program.]',
        '. The Purchaser is not a “covered person” as that term is defined in the DSP.]',
        'Unrelated section',
        '. A minimum of [_________] Shares must be sold at the Initial Closing.]',
      ])
    );

    const rules: DeclarativeParagraphRule[] = [
      {
        id: 'opinion-counsel-fill',
        section_heading: 'Conditions of the Purchasers’ Obligations at Closing',
        section_heading_any: ['Qualifications'],
        paragraph_contains: 'The Purchasers shall have received from',
        replacements: {
          '[___________]': 'Cooley LLP',
        },
        trim_unmatched_trailing_bracket: true,
      },
      {
        id: 'board-composition-fill',
        section_heading: 'Conditions of the Purchasers’ Obligations at Closing',
        section_heading_any: ['Qualifications'],
        paragraph_contains: 'authorized size of the Board of Directors',
        replacements: {
          '[______]': '5',
          '[_________________]': 'Jane Founder; Pat Director',
        },
        trim_unmatched_trailing_bracket: true,
      },
      {
        id: 'minimum-shares-fill',
        section_heading: 'Conditions of the Purchasers’ Obligations at Closing',
        section_heading_any: ['Proceedings and Documents', 'Voting Agreement'],
        paragraph_contains: 'A minimum of',
        replacements: {
          '[_________]': '500000',
        },
        trim_unmatched_trailing_bracket: true,
      },
      {
        id: 'country-of-concern-cleanup',
        section_heading: 'Representations and Warranties of the Purchaser',
        section_heading_any: ['Residence'],
        paragraph_contains: 'person of a country of concern',
        trim_unmatched_trailing_bracket: true,
      },
      {
        id: 'covered-person-cleanup',
        section_heading: 'Representations and Warranties of the Purchaser',
        section_heading_any: ['Residence'],
        paragraph_contains: 'covered person',
        trim_unmatched_trailing_bracket: true,
      },
    ];

    const result = await applyDeclarativeParagraphRulesPrototype(input, output, rules);
    const text = readDocText(output);

    expect(result.warnings).toEqual([]);
    expect(result.applied).toBe(5);

    expect(text).toContain('received from Cooley LLP, counsel for the Company');
    expect(text).toContain('authorized size of the Board of Directors shall be 5');
    expect(text).toContain('Board of Directors shall be comprised of Jane Founder; Pat Director.');
    expect(text).toContain('A minimum of 500000 Shares must be sold at the Initial Closing.');
    expect(text).toContain('not a “person of a country of concern” within the meaning of the Outbound Investment Security Program.');
    expect(text).toContain('not a “covered person” as that term is defined in the DSP.');

    // Ensure scope is section-aware: same text in an unrelated heading is untouched.
    expect(text).toContain('Unrelated section');
    expect(text).toContain('. A minimum of [_________] Shares must be sold at the Initial Closing.]');
  });
});

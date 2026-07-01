import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Verification & Drift');

const repoRoot = join(import.meta.dirname, '..');
const checklistSlugs = ['closing-checklist', 'working-group-list'] as const;

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const FOR_RE = /\{FOR\s+(\w+)\s+IN\s+(\w+)\}/;
const END_FOR_RE = /\{END-FOR\s+(\w+)\}/;
const FOR_END_RE = /\{(?:FOR|END-FOR)[^}]*\}/g;

interface LoopWiring {
  forVar: string;       // e.g. "d" — must match {$d.x} placeholders + END-FOR var
  forSource: string;    // e.g. "documents" — the array field iterated over
  endForVar: string;    // separate so the test can assert forVar === endForVar
}

interface TableSection {
  heading: string;
  loop: LoopWiring;
  headerCells: string[];
  protoCells: string[];
}

// ---------------------------------------------------------------------------
// .docx side: parse word/document.xml in document order. For each <w:tbl>,
// the heading is the most recent paragraph text encountered before it, the
// header cells are the first row, and the proto cells are the FIRST data
// row inside the table (which is the row wrapped by {FOR}/{END-FOR}).
//
// Order is preserved: the resulting list of TableSections must compare
// list-equal to the .md side. A column swap, heading rename, or section
// reorder all break this comparison.
// ---------------------------------------------------------------------------

function elementText(el: Element | null): string {
  if (!el) return '';
  const runs = el.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < runs.length; i += 1) {
    const node = runs.item(i);
    if (node && node.textContent != null) parts.push(node.textContent);
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function extractTableSectionsFromDocx(docxPath: string): TableSection[] {
  const zip = new AdmZip(docxPath);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8');
  if (!xml) {
    throw new Error(`document.xml missing in ${docxPath}`);
  }
  const dom = new DOMParser().parseFromString(xml, 'application/xml');
  const body = dom.getElementsByTagNameNS(W_NS, 'body').item(0);
  if (!body) {
    throw new Error(`<w:body> missing in ${docxPath}`);
  }

  const sections: TableSection[] = [];
  let lastHeading = '';

  for (let i = 0; i < body.childNodes.length; i += 1) {
    const node = body.childNodes.item(i);
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    const tagName = el.localName;
    if (tagName === 'p') {
      const text = elementText(el);
      // Track the most recent non-empty paragraph as the candidate heading.
      // Section headings in the generated docx are short standalone paragraphs
      // (Documents / Action Items / Open Issues / Members) that precede each
      // table; the title-line and updated-at paragraphs precede the FIRST table
      // and would otherwise be picked up here, but they get overwritten by the
      // section heading paragraph that immediately follows them.
      if (text) lastHeading = text;
    } else if (tagName === 'tbl') {
      // checklistTable() in scripts/generate_*_template.mjs always emits a
      // four-row structure: [header, FOR-command, data, END-FOR-command].
      // The data row (index 2) is the prototype row docx-templates repeats
      // per iteration. The FOR / END-FOR command rows hold the loop boundary
      // markers in cell 0; we assert on those positions to catch a generator
      // that drops the loop wiring entirely.
      const rows: string[][] = [];
      const trs = el.getElementsByTagNameNS(W_NS, 'tr');
      for (let r = 0; r < trs.length; r += 1) {
        const tr = trs.item(r);
        if (!tr) continue;
        const cells: string[] = [];
        const tcs = tr.getElementsByTagNameNS(W_NS, 'tc');
        for (let c = 0; c < tcs.length; c += 1) {
          cells.push(elementText(tcs.item(c)));
        }
        rows.push(cells);
      }
      if (rows.length !== 4) {
        throw new Error(
          `Table under heading "${lastHeading}" has ${rows.length} rows (expected 4: header, FOR, data, END-FOR)`,
        );
      }
      const [headerCells, forRow, dataRow, endForRow] = rows;
      const forMatch = FOR_RE.exec(forRow[0]);
      if (!forMatch || forRow[0] !== forMatch[0]) {
        throw new Error(
          `Row 1 cell 0 under "${lastHeading}" must hold a {FOR x IN xs} marker; got "${forRow[0]}"`,
        );
      }
      const endForMatch = END_FOR_RE.exec(endForRow[0]);
      if (!endForMatch || endForRow[0] !== endForMatch[0]) {
        throw new Error(
          `Row 3 cell 0 under "${lastHeading}" must hold a {END-FOR x} marker; got "${endForRow[0]}"`,
        );
      }
      sections.push({
        heading: lastHeading,
        loop: {
          forVar: forMatch[1],
          forSource: forMatch[2],
          endForVar: endForMatch[1],
        },
        headerCells,
        protoCells: dataRow,
      });
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// .md side: walk lines. On `## X` heading, set the current heading. On a
// line starting with `|` followed by a `| --- |` separator, capture the
// previous line's cells as headers and the following line's cells as the
// proto row (with {FOR}/{END-FOR} markers stripped).
// ---------------------------------------------------------------------------

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.replace(/\s+/g, ' ').trim());
}

function stripForMarkers(cells: string[]): string[] {
  return cells.map((cell) => cell.replace(FOR_END_RE, '').replace(/\s+/g, ' ').trim());
}

function extractTableSectionsFromMarkdown(mdPath: string): TableSection[] {
  // Strip YAML frontmatter so we don't accidentally parse something inside it.
  const raw = readFileSync(mdPath, 'utf-8');
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const lines = body.split(/\r?\n/);

  const sections: TableSection[] = [];
  let currentHeading = '';

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const headingMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim();
      continue;
    }
    // Detect markdown table: header line | sep line | data line.
    const next = lines[i + 1] ?? '';
    if (line.trim().startsWith('|') && /^\|[\s:|-]+\|?\s*$/.test(next.trim())) {
      const headerCells = splitTableRow(line);
      const dataLine = lines[i + 2] ?? '';
      if (!dataLine.trim().startsWith('|')) {
        throw new Error(`Table at line ${i + 1} (${mdPath}) has no proto row`);
      }
      // Capture loop wiring BEFORE stripping FOR/END-FOR markers so a
      // template.md that loses or case-mutates its {FOR}/{END-FOR} markers
      // surfaces here. Per-cell stripping then runs for the prototype-cell
      // comparison (which the docx data row stores without markers).
      const forMatch = FOR_RE.exec(dataLine);
      const endForMatch = END_FOR_RE.exec(dataLine);
      if (!forMatch) {
        throw new Error(
          `Table under "${currentHeading}" (${mdPath}) is missing a {FOR x IN xs} marker on the proto row`,
        );
      }
      if (!endForMatch) {
        throw new Error(
          `Table under "${currentHeading}" (${mdPath}) is missing a {END-FOR x} marker on the proto row`,
        );
      }
      const protoCells = stripForMarkers(splitTableRow(dataLine));
      sections.push({
        heading: currentHeading,
        loop: {
          forVar: forMatch[1],
          forSource: forMatch[2],
          endForVar: endForMatch[1],
        },
        headerCells,
        protoCells,
      });
      i += 2;
    }
  }

  return sections;
}

describe('checklist canonical markdown structural drift', () => {
  for (const slug of checklistSlugs) {
    it(`${slug} template.md tables match template.docx structure`, () => {
      const templateDir = join(repoRoot, 'templates', slug);
      const docxSections = extractTableSectionsFromDocx(
        join(templateDir, 'template.docx')
      );
      const mdSections = extractTableSectionsFromMarkdown(
        join(templateDir, 'template.md')
      );

      // Compare ordered list of TableSections. A column swap, heading rename,
      // section reorder, or case-only placeholder change in either source will
      // surface here as a structured diff. Equality is exact (case-sensitive,
      // order-preserving) — that's the point.
      expect(
        mdSections,
        `${slug}: template.md table structure drifted from template.docx`
      ).toEqual(docxSections);
    });
  }
});

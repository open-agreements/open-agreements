/**
 * Generate the closing-checklist template.docx for use with docx-templates.
 *
 * Uses the `docx` npm package to create a .docx file with placeholder tags
 * that docx-templates will fill at runtime.
 *
 * Loop syntax: {FOR item IN array}...{END-FOR item}
 * Loop variable access: {$item.field}
 * For table rows the FOR tag goes in the first cell, END-FOR in the last cell.
 * docx-templates repeats just that row per iteration, keeping headers fixed.
 *
 * Run: node scripts/generate_checklist_template.mjs
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopPosition,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'content', 'templates', 'closing-checklist', 'template.docx');
const STYLE_PATH = join(__dirname, 'template-specs', 'styles', 'openagreements-default-v1.json');

// ---------------------------------------------------------------------------
// Load style profile
// ---------------------------------------------------------------------------
const style = JSON.parse(readFileSync(STYLE_PATH, 'utf-8'));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TABLE_WIDTH = 10070; // page content width in DXA (12240 letter − 2×1080 margins)
const CELL_MARGINS = { top: 115, left: 115, bottom: 115, right: 115 };
const HEADER_SHADING = { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F5F5' };

// ---------------------------------------------------------------------------
// Build-time width assertions
// ---------------------------------------------------------------------------
const checklistWidths = {
  checklist_working_group: style.table_widths.checklist_working_group,
  checklist_documents: style.table_widths.checklist_documents,
  checklist_action_items: style.table_widths.checklist_action_items,
  checklist_open_issues: style.table_widths.checklist_open_issues,
};

for (const [name, widths] of Object.entries(checklistWidths)) {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum !== TABLE_WIDTH) {
    throw new Error(`${name}: column widths sum to ${sum}, expected ${TABLE_WIDTH}`);
  }
}

// ---------------------------------------------------------------------------
// Borders (replicates createBorders from cover-standard-signature-v1.mjs)
// ---------------------------------------------------------------------------
const nilBorder = { style: BorderStyle.NIL, color: 'FFFFFF', size: 0 };
const ruleBorder = { style: BorderStyle.SINGLE, color: style.colors.rule, size: style.sizes.table_rule };

const allNilBorders = {
  top: nilBorder,
  left: nilBorder,
  bottom: nilBorder,
  right: nilBorder,
  insideH: nilBorder,
  insideV: nilBorder,
};

function horizontalBorders() {
  return { top: ruleBorder, left: nilBorder, bottom: ruleBorder, right: nilBorder };
}

// ---------------------------------------------------------------------------
// Document styles (replicates buildDocumentStyles from cover-standard-signature-v1.mjs)
// ---------------------------------------------------------------------------
function buildDocumentStyles() {
  return {
    default: {
      document: {
        run: {
          font: style.fonts.body,
          size: 22,
          color: style.colors.ink,
        },
        paragraph: {
          spacing: {
            before: 0,
            after: 0,
            line: style.spacing.line,
            lineRule: LineRuleType.AUTO,
          },
        },
      },
    },
    paragraphStyles: [
      {
        id: 'Normal',
        name: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          font: style.fonts.body,
          size: 22,
          color: style.colors.ink,
        },
        paragraph: {
          spacing: {
            before: 0,
            after: 0,
            line: style.spacing.line,
            lineRule: LineRuleType.AUTO,
          },
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Page header (replicates sectionHeader from cover-standard-signature-v1.mjs)
// ---------------------------------------------------------------------------
function pageHeader(label) {
  return new Header({
    children: [
      new Table({
        width: { size: TABLE_WIDTH, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        columnWidths: style.table_widths.section_header,
        borders: {
          top: {
            style: BorderStyle.SINGLE,
            color: style.colors.accent_deep,
            size: style.sizes.header_accent_rule,
          },
          left: nilBorder,
          bottom: nilBorder,
          right: nilBorder,
          insideH: nilBorder,
          insideV: nilBorder,
        },
        rows: [
          new TableRow({
            height: { value: 360, rule: HeightRule.ATLEAST },
            children: [
              new TableCell({
                borders: { top: nilBorder, left: nilBorder, bottom: nilBorder, right: nilBorder },
                margins: { top: 36, left: 0, bottom: 0, right: 0 },
                children: [new Paragraph({ children: [new TextRun('')] })],
              }),
              new TableCell({
                borders: { top: nilBorder, left: nilBorder, bottom: nilBorder, right: nilBorder },
                margins: { top: 36, left: 0, bottom: 0, right: 0 },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: label.toUpperCase(),
                        font: style.fonts.body,
                        size: 18,
                        bold: true,
                        color: style.colors.accent_deep,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun('')] }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Page footer (replicates sectionFooter from cover-standard-signature-v1.mjs)
// ---------------------------------------------------------------------------
function pageFooter() {
  const baseRun = { font: style.fonts.body, size: 13, color: style.colors.ink_soft };
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: 'OpenAgreements Closing Checklist (v1.0). Free to use under CC BY 4.0.', ...baseRun }),
          new TextRun({ text: '\tPage ', ...baseRun }),
          new TextRun({ children: [PageNumber.CURRENT], ...baseRun }),
          new TextRun({ text: ' of ', ...baseRun }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], ...baseRun }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Title paragraph (replicates titleParagraph from cover-standard-signature-v1.mjs)
// ---------------------------------------------------------------------------
function titleParagraph(text) {
  return new Paragraph({
    spacing: { before: style.spacing.title_before, after: style.spacing.title_after },
    children: [
      new TextRun({
        text,
        font: style.fonts.heading,
        size: 44,
        color: style.colors.ink,
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Section title paragraph (replicates sectionTitleParagraph)
// ---------------------------------------------------------------------------
function sectionTitleParagraph(text) {
  return new Paragraph({
    contextualSpacing: false,
    spacing: {
      before: 0,
      after: style.spacing.section_title_after,
      line: style.spacing.line,
      beforeAutoSpacing: false,
      afterAutoSpacing: false,
    },
    children: [
      new TextRun({
        text,
        font: style.fonts.body,
        size: 22,
        bold: true,
        color: style.colors.accent,
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Header cell — bold text with accent_deep color and light gray shading
// ---------------------------------------------------------------------------
function headerCell(text) {
  return new TableCell({
    borders: horizontalBorders(),
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    shading: HEADER_SHADING,
    children: [
      new Paragraph({
        spacing: { after: 0, line: style.spacing.line },
        children: [
          new TextRun({
            text,
            font: style.fonts.body,
            size: 20,
            bold: true,
            color: style.colors.accent_deep,
          }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Data cell — normal body text with optional extra runs (for loop markers)
// ---------------------------------------------------------------------------
function dataCell(text, opts = {}) {
  const runs = [];

  // Optional leading tiny run (FOR marker)
  if (opts.prefixCmd) {
    runs.push(new TextRun({ text: opts.prefixCmd, font: style.fonts.body, size: 2, color: style.colors.ink }));
  }

  runs.push(new TextRun({ text, font: style.fonts.body, size: 20, color: style.colors.ink }));

  // Optional trailing tiny run (END-FOR marker)
  if (opts.suffixCmd) {
    runs.push(new TextRun({ text: opts.suffixCmd, font: style.fonts.body, size: 2, color: style.colors.ink }));
  }

  return new TableCell({
    borders: horizontalBorders(),
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: 0, line: style.spacing.line },
        children: runs,
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Build a checklist table with header row + single data row (looped by docx-templates)
// ---------------------------------------------------------------------------
function checklistTable(columnWidths, headers, dataCells) {
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths,
    borders: allNilBorders,
    rows: [
      // Header row
      new TableRow({
        tableHeader: true,
        height: { value: style.sizes.checklist_row_height, rule: HeightRule.ATLEAST },
        children: headers.map((label) => headerCell(label)),
      }),
      // Data row — docx-templates repeats this row per iteration
      new TableRow({
        height: { value: style.sizes.checklist_row_height, rule: HeightRule.ATLEAST },
        children: dataCells,
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Build document
// ---------------------------------------------------------------------------
const doc = new Document({
  styles: buildDocumentStyles(),
  sections: [
    {
      properties: {
        page: { margin: style.page_margin },
      },
      headers: { default: pageHeader('Closing Checklist') },
      footers: { default: pageFooter() },
      children: [
        // Title
        titleParagraph('{deal_name} — Closing Checklist'),

        // Date line
        new Paragraph({
          spacing: { before: 0, after: 300 },
          children: [
            new TextRun({
              text: 'Updated: {updated_at}',
              font: style.fonts.body,
              size: 20,
              italics: true,
              color: style.colors.ink_soft,
            }),
          ],
        }),

        // ------ Working Group ------
        sectionTitleParagraph('Working Group'),
        checklistTable(
          style.table_widths.checklist_working_group,
          ['Name', 'Organization', 'Role', 'Email'],
          [
            dataCell('{$m.name}', { prefixCmd: '{FOR m IN working_group}' }),
            dataCell('{$m.organization}'),
            dataCell('{$m.role}'),
            dataCell('{$m.email}', { suffixCmd: '{END-FOR m}' }),
          ],
        ),

        // Spacer
        new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

        // ------ Documents ------
        sectionTitleParagraph('Documents'),
        checklistTable(
          style.table_widths.checklist_documents,
          ['Document', 'Status'],
          [
            dataCell('{$d.document_name}', { prefixCmd: '{FOR d IN documents}' }),
            dataCell('{$d.status}', { suffixCmd: '{END-FOR d}' }),
          ],
        ),

        // Spacer
        new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

        // ------ Action Items ------
        sectionTitleParagraph('Action Items'),
        checklistTable(
          style.table_widths.checklist_action_items,
          ['ID', 'Description', 'Status', 'Assigned To', 'Due Date'],
          [
            dataCell('{$a.item_id}', { prefixCmd: '{FOR a IN action_items}' }),
            dataCell('{$a.description}'),
            dataCell('{$a.status}'),
            dataCell('{$a.assigned_to.organization}'),
            dataCell('{$a.due_date}', { suffixCmd: '{END-FOR a}' }),
          ],
        ),

        // Spacer
        new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

        // ------ Open Issues (5-column summary) ------
        sectionTitleParagraph('Open Issues'),
        checklistTable(
          style.table_widths.checklist_open_issues,
          ['ID', 'Title', 'Status', 'Escalation', 'Resolution'],
          [
            dataCell('{$i.issue_id}', { prefixCmd: '{FOR i IN open_issues}' }),
            dataCell('{$i.title}'),
            dataCell('{$i.status}'),
            dataCell('{$i.escalation_tier}'),
            dataCell('{$i.resolution}', { suffixCmd: '{END-FOR i}' }),
          ],
        ),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(OUTPUT, buffer);
console.log(`Generated ${OUTPUT}`);

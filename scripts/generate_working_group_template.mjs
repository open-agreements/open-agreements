/**
 * Generate the working-group-list template.docx for use with docx-templates.
 *
 * Uses the `docx` npm package to create a .docx file with placeholder tags
 * that docx-templates will fill at runtime.
 *
 * Loop syntax: {FOR item IN array}...{END-FOR item}
 * Loop variable access: {$item.field}
 * For table rows the FOR tag goes in the first cell, END-FOR in the last cell.
 * docx-templates repeats just that row per iteration, keeping headers fixed.
 *
 * Run: node scripts/generate_working_group_template.mjs
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
const OUTPUT = join(__dirname, '..', 'content', 'templates', 'working-group-list', 'template.docx');
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
// Build-time width assertion
// ---------------------------------------------------------------------------
const wgWidths = style.table_widths.checklist_working_group;
const wgSum = wgWidths.reduce((a, b) => a + b, 0);
if (wgSum !== TABLE_WIDTH) {
  throw new Error(`checklist_working_group: column widths sum to ${wgSum}, expected ${TABLE_WIDTH}`);
}

// ---------------------------------------------------------------------------
// Borders
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
// Document styles
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
// Page header — teal header badge with label text
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
// Page footer — attribution + page numbers (CC0 1.0)
// ---------------------------------------------------------------------------
function pageFooter() {
  const baseRun = { font: style.fonts.body, size: 13, color: style.colors.ink_soft };
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: 'OpenAgreements Working Group List (v1.0). Free to use under CC0 1.0.', ...baseRun }),
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
// Title paragraph — Georgia 22pt
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
// Section title paragraph — teal section heading
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
// Data cell — normal body text
// ---------------------------------------------------------------------------
function dataCell(text) {
  return new TableCell({
    borders: horizontalBorders(),
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: 0, line: style.spacing.line },
        children: [new TextRun({ text, font: style.fonts.body, size: 20, color: style.colors.ink })],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Command cell — tiny invisible text for FOR / END-FOR loop markers
// ---------------------------------------------------------------------------
function cmdCell(cmd) {
  return new TableCell({
    borders: horizontalBorders(),
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: 0, line: style.spacing.line },
        children: [new TextRun({ text: cmd, font: style.fonts.body, size: 2, color: style.colors.ink })],
      }),
    ],
  });
}

function emptyCell() {
  return new TableCell({
    borders: horizontalBorders(),
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: 0, line: style.spacing.line },
        children: [new TextRun({ text: '', font: style.fonts.body, size: 2 })],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Build a table with header row + 3-row loop pattern:
//   Row 1: {FOR x IN array} (command row — removed by docx-templates)
//   Row 2: data cells (repeated per iteration)
//   Row 3: {END-FOR x} (command row — removed by docx-templates)
// ---------------------------------------------------------------------------
function checklistTable(columnWidths, headers, dataCells, forCmd, endForCmd) {
  const colCount = columnWidths.length;
  const forRowCells = [cmdCell(forCmd)];
  const endForRowCells = [cmdCell(endForCmd)];
  for (let i = 1; i < colCount; i++) {
    forRowCells.push(emptyCell());
    endForRowCells.push(emptyCell());
  }

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
      // FOR command row
      new TableRow({
        height: { value: 0, rule: HeightRule.ATLEAST },
        children: forRowCells,
      }),
      // Data row — docx-templates repeats this row per iteration
      new TableRow({
        height: { value: style.sizes.checklist_row_height, rule: HeightRule.ATLEAST },
        children: dataCells,
      }),
      // END-FOR command row
      new TableRow({
        height: { value: 0, rule: HeightRule.ATLEAST },
        children: endForRowCells,
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
      headers: { default: pageHeader('Working Group List') },
      footers: { default: pageFooter() },
      children: [
        // Title
        titleParagraph('{deal_name} — Working Group List'),

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

        // ------ Members (4-column: Name | Organization | Role | Email) ------
        sectionTitleParagraph('Members'),
        checklistTable(
          style.table_widths.checklist_working_group,
          ['Name', 'Organization', 'Role', 'Email'],
          [
            dataCell('{$m.name}'),
            dataCell('{$m.organization}'),
            dataCell('{$m.role}'),
            dataCell('{$m.email}'),
          ],
          '{FOR m IN working_group}',
          '{END-FOR m}',
        ),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(OUTPUT, buffer);
console.log(`Generated ${OUTPUT}`);

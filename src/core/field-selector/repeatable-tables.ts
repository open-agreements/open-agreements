import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';
import { z } from 'zod';
import type { FieldDefinition } from '../metadata.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const ColumnSchema = z.object({
  field: z.string().min(1),
  format: z.enum(['text', 'integer', 'decimal', 'currency']).default('text'),
}).strict();

const TableSchema = z.object({
  id: z.string().min(1),
  rows_field: z.string().min(1),
  header_cells: z.array(z.string()).min(1),
  columns: z.array(ColumnSchema).min(1),
  prototype_row_index: z.number().int().positive().optional(),
}).strict().refine((table) => table.header_cells.length === table.columns.length, {
  message: 'header_cells and columns must have the same length',
});

export const RepeatableTablesConfigSchema = z.object({
  schema_version: z.literal(1),
  tables: z.array(TableSchema).min(1),
}).strict();

export type RepeatableTablesConfig = z.infer<typeof RepeatableTablesConfigSchema>;

export function loadRepeatableTablesConfig(templateDir: string): RepeatableTablesConfig | undefined {
  const configPath = join(templateDir, 'repeatable-tables.json');
  if (!existsSync(configPath)) return undefined;
  return RepeatableTablesConfigSchema.parse(JSON.parse(readFileSync(configPath, 'utf8')));
}

export function validateRepeatableTableFields(config: RepeatableTablesConfig, fields: FieldDefinition[]): void {
  const byName = new Map(fields.map((field) => [field.name, field]));
  for (const table of config.tables) {
    const rowsField = byName.get(table.rows_field);
    if (!rowsField || rowsField.type !== 'array' || !rowsField.items) {
      throw new Error(`repeatable table "${table.id}" rows_field "${table.rows_field}" must reference an array field with items`);
    }
    const itemNames = new Set(rowsField.items.map((item) => item.name));
    for (const column of table.columns) {
      if (!itemNames.has(column.field)) {
        throw new Error(`repeatable table "${table.id}" column field "${column.field}" is not declared in ${table.rows_field}.items`);
      }
    }
  }
}

function directChildren(element: XmlElement, localName: string): XmlElement[] {
  return Array.from(element.childNodes).filter(
    (node) => node.nodeType === 1 && (node as XmlElement).localName === localName,
  ) as XmlElement[];
}

function textOf(element: XmlElement): string {
  return Array.from(element.getElementsByTagNameNS(W_NS, 't'))
    .map((node) => node.textContent ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatValue(value: unknown, format: z.infer<typeof ColumnSchema>['format']): string {
  if (value === null || value === undefined || value === '') return '';
  if (format === 'text') return String(value);
  const number = typeof value === 'number' ? value : Number(String(value).replace(/[$,]/g, ''));
  if (!Number.isFinite(number)) throw new Error(`cannot format non-numeric repeatable-table value ${JSON.stringify(value)} as ${format}`);
  if (format === 'integer') return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(number);
  if (format === 'currency') return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(number);
}

function setCellText(doc: XmlDocument, cell: XmlElement, value: string): void {
  const paragraphs = directChildren(cell, 'p');
  const paragraph = paragraphs[0] ?? doc.createElementNS(W_NS, 'w:p');
  if (paragraph.parentNode === null) cell.appendChild(paragraph);
  for (const child of Array.from(paragraph.childNodes)) {
    if (child.nodeType === 1 && (child as XmlElement).localName !== 'pPr') paragraph.removeChild(child);
  }
  value.split('\n').forEach((line, index) => {
    if (index > 0) {
      const breakRun = doc.createElementNS(W_NS, 'w:r');
      breakRun.appendChild(doc.createElementNS(W_NS, 'w:br'));
      paragraph.appendChild(breakRun);
    }
    const run = doc.createElementNS(W_NS, 'w:r');
    const text = doc.createElementNS(W_NS, 'w:t');
    if (/^\s|\s$/.test(line)) text.setAttribute('xml:space', 'preserve');
    text.appendChild(doc.createTextNode(line));
    run.appendChild(text);
    paragraph.appendChild(run);
  });
  for (const extra of paragraphs.slice(1)) cell.removeChild(extra);
}

function isBlankRow(row: XmlElement): boolean {
  return directChildren(row, 'tc').every((cell) => textOf(cell) === '');
}

function stripHeaderSemantics(row: XmlElement): void {
  for (const marker of Array.from(row.getElementsByTagNameNS(W_NS, 'tblHeader'))) {
    marker.parentNode?.removeChild(marker);
  }
  for (const shading of Array.from(row.getElementsByTagNameNS(W_NS, 'shd'))) {
    shading.parentNode?.removeChild(shading);
  }
}

export function applyRepeatableTables(
  inputPath: string,
  outputPath: string,
  config: RepeatableTablesConfig,
  values: Record<string, unknown>,
): void {
  const zip = new AdmZip(inputPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('repeatable tables require word/document.xml');
  const doc = new DOMParser().parseFromString(entry.getData().toString('utf8'), 'text/xml');
  const tables = Array.from(doc.getElementsByTagNameNS(W_NS, 'tbl')) as XmlElement[];

  for (const binding of config.tables) {
    const candidates = tables.filter((table) => {
      const header = directChildren(table, 'tr')[0];
      if (!header) return false;
      return directChildren(header, 'tc').map(textOf).every((text, index) => text === binding.header_cells[index])
        && directChildren(header, 'tc').length === binding.header_cells.length;
    });
    if (candidates.length !== 1) {
      throw new Error(`repeatable table "${binding.id}" matched ${candidates.length} tables; expected exactly one`);
    }
    const table = candidates[0];
    const rows = directChildren(table, 'tr');
    if (binding.prototype_row_index === undefined) {
      const nonblank = rows.slice(1).find((row) => !isBlankRow(row));
      if (nonblank) {
        throw new Error(`repeatable table "${binding.id}" has a nonblank post-header row; use an explicit prototype_row_index or remove stale data`);
      }
    }
    const prototype = binding.prototype_row_index === undefined
      ? rows[0].cloneNode(true) as XmlElement
      : rows[binding.prototype_row_index];
    if (!prototype) throw new Error(`repeatable table "${binding.id}" has no prototype row at index ${binding.prototype_row_index}`);
    if (binding.prototype_row_index === undefined) stripHeaderSemantics(prototype);
    const prototypeCells = directChildren(prototype, 'tc');
    if (prototypeCells.length !== binding.columns.length) {
      throw new Error(`repeatable table "${binding.id}" prototype has ${prototypeCells.length} cells; expected ${binding.columns.length}`);
    }
    const rawRows = values[binding.rows_field] ?? [];
    if (!Array.isArray(rawRows)) throw new Error(`repeatable table field "${binding.rows_field}" must be an array`);
    for (const [rowIndex, rawRow] of rawRows.entries()) {
      if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
        throw new Error(`repeatable table field "${binding.rows_field}" entry ${rowIndex} must be an object`);
      }
      const row = prototype.cloneNode(true) as XmlElement;
      const cells = directChildren(row, 'tc');
      for (let columnIndex = 0; columnIndex < binding.columns.length; columnIndex++) {
        const column = binding.columns[columnIndex];
        setCellText(doc, cells[columnIndex], formatValue((rawRow as Record<string, unknown>)[column.field], column.format));
      }
      table.appendChild(row);
    }
    for (const row of rows.slice(1)) {
      if (binding.prototype_row_index === undefined ? isBlankRow(row) : row === prototype) {
        table.removeChild(row);
      }
    }
  }

  zip.updateFile('word/document.xml', Buffer.from(new XMLSerializer().serializeToString(doc), 'utf8'));
  zip.writeZip(outputPath);
}

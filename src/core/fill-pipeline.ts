/**
 * Shared fill pipeline used by all three fill paths (template, external, fieldSelector).
 * Centralizes: defaults, boolean coercion, display fields, currency sanitization,
 * drafting note removal, and the docx-templates createReport() call.
 */

import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import { createReport } from 'docx-templates';
import { sanitizeCurrencyValuesFromDocx, BLANK_PLACEHOLDER } from './fill-utils.js';
import {
  copyEntriesSkippingDirs,
  enumerateTextParts,
  getGeneralTextPartNames,
  rezipWithoutDirEntries,
} from './field-selector/ooxml-parts.js';
import type { FieldDefinition } from './metadata.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface PrepareFillDataOptions {
  /** User-provided values. */
  values: Record<string, unknown>;

  /** Field definitions from metadata. */
  fields: FieldDefinition[];

  /** Priority field names from metadata.priority_fields. */
  priorityFieldNames?: string[];

  /**
   * When true, unfilled optional fields default to BLANK_PLACEHOLDER ('_______')
   * so omissions are visible. When false, they default to '' (empty string).
   * All fill paths use true by default.
   */
  useBlankPlaceholder?: boolean;

  /** Coerce boolean-typed fields to actual JS booleans for IF conditions. */
  coerceBooleans?: boolean;

  /**
   * Optional callback for computing display fields (template-specific).
   * Called after defaults and boolean coercion are applied.
   */
  computeDisplayFields?: (data: Record<string, unknown>) => void;

  /**
   * Statutory-compliance-representation (`confirm=`) clauses in the template,
   * distilled from the compiled spec. Used to derive `any_confirmation_pending`
   * for the cover-page confirmation notice: true when any APPLICABLE confirm
   * clause (its `condition`/`when=` gate is true, or it has none) is still
   * unconfirmed (its boolean confirm field is not true). Omit for templates
   * without confirm clauses.
   */
  confirmClauses?: ConfirmClauseDescriptor[];
}

/** A `confirm=` clause distilled from the compiled contract spec. */
export interface ConfirmClauseDescriptor {
  /** Clause id (e.g. `choice-act-counsel-notice`). */
  id: string;
  /** Boolean confirm field gating the in-body CONFIRM bracket. */
  confirm: string;
  /** Optional `when=` applicability gate field; clause is absent when false. */
  condition?: string;
}

export interface FillDocxOptions {
  /** Template DOCX buffer (already patched with {tags}). */
  templateBuffer: Buffer;

  /**
   * Prepared fill data from prepareFillData(). Every `{IF <var>}` referenced by
   * the template DOCX must have a corresponding key here, or docx-templates throws
   * on the undefined variable. In particular, a template with a `confirm=` clause
   * carries `{IF any_confirmation_pending}` (the cover notice) — prepareFillData
   * derives it; direct fillDocx callers must supply it (default false).
   */
  data: Record<string, unknown>;

  /** Apply docx-templates smart quote normalization. */
  fixSmartQuotes?: boolean;

  /**
   * Regex patterns for paragraphs to remove before filling.
   * Paragraphs whose text matches any pattern are stripped from the DOCX.
   * If a matched paragraph is the only content in a table row, the entire
   * row is removed to avoid empty highlighted rows.
   *
   * Default: `[/\bDrafting note\b/i]` — removes Common Paper drafting notes.
   * Pass `[]` to disable.
   */
  stripParagraphPatterns?: RegExp[];
}

/** Default patterns for paragraphs stripped before filling. */
const DEFAULT_STRIP_PATTERNS = [/\bDrafting note\b/i];

/** Fixed month-name table for deterministic date formatting (index 0 = January). */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Format an ISO `YYYY-MM-DD` string as a document date ("2026-07-15" →
 * "July 15, 2026").
 *
 * Deterministic and timezone-independent by construction: the string is split
 * into year/month/day components and rendered from {@link MONTH_NAMES}. It
 * NEVER constructs a `Date` — `new Date('2026-07-15')` parses as UTC midnight
 * and `toLocaleDateString` can render the previous calendar day in
 * negative-offset timezones — and never calls any locale/`Intl` API.
 *
 * Any value that is not a strict `YYYY-MM-DD` string denoting a REAL calendar
 * date is returned UNCHANGED. Beyond the coarse month (01–12) / day (01–31)
 * range, per-month day limits and leap years are enforced, so impossible dates
 * ("2026-02-31", "2025-02-29") are never dressed up as an authoritative document
 * date — they fall through exactly like a non-ISO string. This preserves
 * backward compatibility for callers/fixtures that already supply a display-ready
 * date string (e.g. "March 20, 2026") and passes through empty-but-non-null
 * placeholders (`''`, the blank placeholder) untouched.
 */
export function formatDocumentDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const yearStr = match[1];
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return value;
  // Reject impossible calendar dates (Feb 30/31, Apr 31, Feb 29 in a non-leap
  // year, …). Deterministic arithmetic only — no Date/locale.
  const year = Number(yearStr);
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) return value;
  // Number(match[3]) drops the leading zero: "05" → 5. yearStr keeps any leading
  // zeros the (unrealistic) 4-digit year might carry.
  return `${MONTH_NAMES[month - 1]} ${day}, ${yearStr}`;
}

/**
 * Prepare fill data with all normalization steps:
 * 1. Apply defaults for optional fields not provided
 * 2. Normalize multiselect fields and derive booleans (optional)
 * 3. Warn about unfilled priority fields
 * 4. Coerce boolean fields (optional)
 * 5. Compute display fields (optional, template-specific)
 */
export function prepareFillData(options: PrepareFillDataOptions): Record<string, unknown> {
  const {
    values,
    fields,
    priorityFieldNames = [],
    useBlankPlaceholder = false,
    coerceBooleans = false,
    computeDisplayFields,
    confirmClauses,
  } = options;

  // Apply defaults for fields not provided
  const defaultValue = useBlankPlaceholder ? BLANK_PLACEHOLDER : '';
  const data: Record<string, unknown> = { ...values };

  for (const field of fields) {
    if (!(field.name in data)) {
      if (field.type === 'array') {
        data[field.name] = [];
      } else if (field.type === 'multiselect') {
        data[field.name] = field.default ? JSON.parse(field.default) : [];
      } else {
        data[field.name] = field.default ?? defaultValue;
      }
    }
  }

  // Format ISO `YYYY-MM-DD` values on `type: date` fields as document dates
  // ("2026-07-15" → "July 15, 2026"). Scoped to date fields ONLY — never a
  // blanket transform of all values. Non-ISO strings (already display-ready) and
  // empty-but-non-null placeholders pass through unchanged, so fixtures that
  // supply "March 20, 2026" are unaffected. Deterministic and
  // timezone-independent — see formatDocumentDate.
  for (const field of fields) {
    if (field.type !== 'date') continue;
    const value = data[field.name];
    if (typeof value === 'string') {
      data[field.name] = formatDocumentDate(value);
    }
  }

  for (const field of fields) {
    if (field.type !== 'multiselect') continue;

    let raw = data[field.name];
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (err) {
        throw new Error(
          `Multiselect field "${field.name}" received malformed JSON input: ${(err as Error).message}`
        );
      }
    }
    if (!Array.isArray(raw)) {
      throw new Error(
        `Multiselect field "${field.name}" must be a JSON array of strings; got ${typeof raw}`
      );
    }
    const allowed = new Set(field.options ?? []);
    const normalized: string[] = [];
    for (const [index, value] of raw.entries()) {
      if (typeof value !== 'string') {
        throw new Error(
          `Multiselect field "${field.name}" entry at index ${index} must be a string; got ${typeof value}`
        );
      }
      if (!allowed.has(value)) {
        throw new Error(
          `Multiselect field "${field.name}" received unknown option "${value}"; allowed: ${[...allowed].join(', ')}`
        );
      }
      normalized.push(value);
    }
    data[field.name] = normalized;

    if (field.derive_booleans === true) {
      const selected = new Set(normalized);
      for (const option of field.options ?? []) {
        data[`${option}_enabled`] = selected.has(option);
      }
    }
  }

  // Reject empty priority collection fields outright. A consent template that
  // loops over an empty signer array would silently render a Signatures
  // heading with zero signatures — that's a correctness bug, not a soft warning.
  const prioritySet = new Set(priorityFieldNames);
  const emptyPriorityArrays = fields
    .filter((f) => prioritySet.has(f.name) && (f.type === 'array' || f.type === 'multiselect'))
    .filter((f) => !Array.isArray(data[f.name]) || (data[f.name] as unknown[]).length === 0)
    .map((f) => f.name);
  if (emptyPriorityArrays.length > 0) {
    throw new Error(
      `Required collection fields are empty: ${emptyPriorityArrays.join(', ')}. Provide at least one entry.`
    );
  }

  // Warn about priority fields that are still unfilled (no value, no default)
  const missing = fields
    .filter((f) => prioritySet.has(f.name))
    .filter((f) => {
      const value = data[f.name];
      if (Array.isArray(value)) {
        return value.length === 0;
      }
      return value === '' || value === BLANK_PLACEHOLDER;
    })
    .map((f) => f.name);
  if (missing.length > 0) {
    console.warn(`Note: ${missing.length} priority fields are unfilled: ${missing.join(', ')}`);
  }

  // Coerce boolean fields to actual JS booleans.
  // docx-templates evaluates {IF field} in JS context where "false" is truthy.
  if (coerceBooleans) {
    for (const field of fields) {
      if (field.type === 'boolean' && field.name in data) {
        const v = data[field.name];
        data[field.name] = v === true || v === 'true';
      }
    }
  }

  // Derive `any_confirmation_pending` for the cover-page confirmation notice.
  // True when any APPLICABLE confirm clause (its `when=` gate is true, or it has
  // none) is still unconfirmed. The per-bullet visibility is handled in the DOCX
  // by nesting `{IF condition}{IF !confirm}…`; only the banner wrapper needs this
  // OR-of-applicable-clauses boolean (the {IF} grammar is single-field). Computed
  // after coercion so gate/confirm values are real booleans.
  if (confirmClauses && confirmClauses.length > 0) {
    const truthy = (v: unknown) => v === true || v === 'true';
    data.any_confirmation_pending = confirmClauses.some((clause) => {
      const applicable = clause.condition ? truthy(data[clause.condition]) : true;
      // Use the same truthy() coercion for the confirm field as for the gate, so
      // a string "true" counts as confirmed even when coerceBooleans is off.
      return applicable && !truthy(data[clause.confirm]);
    });
  }

  // Compute display fields (template-specific: radio/checkbox groups)
  if (computeDisplayFields) {
    computeDisplayFields(data);
  }

  return data;
}

/**
 * Extract paragraph text by concatenating all <w:t> elements.
 */
function extractParagraphText(para: Element): string {
  if (!para.getElementsByTagNameNS) return '';
  const tElements = para.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tElements.length; i++) {
    parts.push(tElements[i].textContent ?? '');
  }
  return parts.join('').trim();
}

/**
 * Check if a table row contains ONLY paragraphs that match the strip patterns
 * (or are empty). If so, the entire row can be safely removed.
 */
function isRowOnlyDraftingNotes(tr: Element, patterns: RegExp[]): boolean {
  const paras = tr.getElementsByTagNameNS(W_NS, 'p');
  if (paras.length === 0) return false;
  for (let i = 0; i < paras.length; i++) {
    const text = extractParagraphText(paras[i]);
    if (text === '') continue; // empty paragraphs are fine to remove
    if (!patterns.some((r) => r.test(text))) return false; // non-matching content
  }
  return true;
}

/**
 * Remove paragraphs matching the given patterns from a DOCX buffer.
 * If a matched paragraph is the sole content of a table row, the entire
 * row is removed (avoids empty highlighted rows in Common Paper docs).
 *
 * Returns a new DOCX buffer with the paragraphs removed.
 */
function stripParagraphs(docxBuffer: Buffer, patterns: RegExp[]): Buffer {
  if (patterns.length === 0) return docxBuffer;

  const zip = new AdmZip(docxBuffer);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  let modified = false;

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc: Document = parser.parseFromString(xml, 'text/xml');

    // Collect table rows to remove (whole row when only drafting notes)
    const rowsToRemove = new Set<Element>();
    // Collect standalone paragraphs to remove
    const parasToRemove: Element[] = [];

    const allParagraphs = doc.getElementsByTagNameNS(W_NS, 'p');
    for (let i = 0; i < allParagraphs.length; i++) {
      const para = allParagraphs[i];
      const text = extractParagraphText(para);
      if (!text || !patterns.some((r) => r.test(text))) continue;

      // Walk up to find if this is inside a table cell
      let node: Node | null = para.parentNode;
      let inTableCell = false;
      let tableRow: Element | null = null;
      while (node) {
        if (node.nodeType === 1) {
          const element = node as Element;
          if (element.localName === 'tc' && element.namespaceURI === W_NS) {
            inTableCell = true;
          }
          if (element.localName === 'tr' && element.namespaceURI === W_NS) {
            tableRow = element;
            break;
          }
        }
        node = node.parentNode;
      }

      if (inTableCell && tableRow && isRowOnlyDraftingNotes(tableRow, patterns)) {
        rowsToRemove.add(tableRow);
      } else {
        parasToRemove.push(para);
      }
    }

    if (rowsToRemove.size > 0 || parasToRemove.length > 0) {
      modified = true;
      for (const row of rowsToRemove) {
        row.parentNode?.removeChild(row);
      }
      for (const para of parasToRemove) {
        para.parentNode?.removeChild(para);
      }

      // Update the zip entry
      const outXml = serializer.serializeToString(doc);
      zip.updateFile(partName, Buffer.from(outXml, 'utf-8'));
    }
  }

  if (!modified) return docxBuffer;

  // Rebuild the zip from scratch (adm-zip data descriptor workaround)
  const outZip = new AdmZip();
  copyEntriesSkippingDirs(zip, outZip);
  return outZip.toBuffer();
}

/**
 * Extract all text from a run (<w:r>) by concatenating its <w:t> elements.
 */
function extractRunText(run: Element): string {
  const tElements = run.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tElements.length; i++) {
    parts.push(tElements[i].textContent ?? '');
  }
  return parts.join('');
}

/**
 * Remove <w:highlight> elements only from runs whose template tags
 * are being filled with non-empty values. Unfilled fields keep their
 * yellow highlighting so users can see what still needs attention.
 *
 * Works by finding runs containing {field_name} tags, checking whether
 * the corresponding field has a non-empty value in the data, and only
 * stripping the highlight if it does.
 */
function stripFilledHighlighting(
  docxBuffer: Buffer,
  filledFields: Set<string>,
): Buffer {
  if (filledFields.size === 0) return docxBuffer;

  const zip = new AdmZip(docxBuffer);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  // Match {field_name} but not {IF ...} or {END-IF ...} etc.
  const tagPattern = /\{(\w+)\}/g;

  let modified = false;

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc: Document = parser.parseFromString(xml, 'text/xml');

    const allRuns = doc.getElementsByTagNameNS(W_NS, 'r');
    const toRemove: Element[] = [];

    for (let i = 0; i < allRuns.length; i++) {
      const run = allRuns[i];
      const rPr = run.getElementsByTagNameNS(W_NS, 'rPr');
      if (rPr.length === 0) continue;

      const highlights = rPr[0].getElementsByTagNameNS(W_NS, 'highlight');
      if (highlights.length === 0) continue;

      // Check if this run's text contains a tag for a filled field
      const runText = extractRunText(run);
      let hasFilled = false;
      let match: RegExpExecArray | null = null;
      tagPattern.lastIndex = 0;
      while ((match = tagPattern.exec(runText)) !== null) {
        if (filledFields.has(match[1])) {
          hasFilled = true;
          break;
        }
      }

      if (hasFilled) {
        for (let j = 0; j < highlights.length; j++) {
          toRemove.push(highlights[j]);
        }
      }
    }

    if (toRemove.length > 0) {
      modified = true;
      for (const el of toRemove) {
        el.parentNode?.removeChild(el);
      }
      const outXml = serializer.serializeToString(doc);
      zip.updateFile(partName, Buffer.from(outXml, 'utf-8'));
    }
  }

  if (!modified) return docxBuffer;

  const outZip = new AdmZip();
  copyEntriesSkippingDirs(zip, outZip);
  return outZip.toBuffer();
}

/**
 * Remove malformed/empty table rows that can be produced by conditional tags
 * (for example false {IF ...} blocks wrapped around full row content).
 *
 * Some viewers (notably Apple Pages) may render entire tables incorrectly when
 * a <w:tr> remains with <w:trPr> but no <w:tc> cells.
 */
function stripEmptyTableRows(docxBuffer: Buffer): Buffer {
  const zip = new AdmZip(docxBuffer);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  let modified = false;

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc: Document = parser.parseFromString(xml, 'text/xml');
    const rows = doc.getElementsByTagNameNS(W_NS, 'tr');

    const rowsToRemove: Element[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let hasCell = false;
      let allCellsEmpty = true;
      for (let c = 0; c < row.childNodes.length; c++) {
        const child = row.childNodes[c];
        if (child?.nodeType === 1) {
          const childElement = child as Element;
          if (childElement.localName === 'tc' && childElement.namespaceURI === W_NS) {
            hasCell = true;
            const cellText = (childElement.textContent || '').trim();
            if (cellText.length > 0) {
              allCellsEmpty = false;
            }
          }
        }
      }
      if (!hasCell || (hasCell && allCellsEmpty)) {
        rowsToRemove.push(row);
      }
    }

    // Deduplicate tcPr elements within table cells (docx-templates {IF} processing
    // can create duplicate <w:tcPr> blocks where the first has default properties
    // that override the intended ones in the second)
    const allCells = doc.getElementsByTagNameNS(W_NS, 'tc');
    for (let i = 0; i < allCells.length; i++) {
      const cell = allCells[i];
      const tcPrs: Element[] = [];
      for (let c = 0; c < cell.childNodes.length; c++) {
        const child = cell.childNodes[c];
        if (child.nodeType === 1 && (child as Element).localName === 'tcPr' && (child as Element).namespaceURI === W_NS) {
          tcPrs.push(child as Element);
        }
      }
      if (tcPrs.length > 1) {
        modified = true;
        // Keep only the last tcPr (has the correct properties from our renderer)
        for (let t = 0; t < tcPrs.length - 1; t++) {
          cell.removeChild(tcPrs[t]);
        }
      }
    }

    // Also strip empty paragraphs within table cells (artifacts from {IF} tag processing)
    const cells = doc.getElementsByTagNameNS(W_NS, 'tc');
    const parasToRemove: Element[] = [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const paras = cell.getElementsByTagNameNS(W_NS, 'p');
      // Only strip empty paras if the cell has at least 2 paragraphs
      // (keep the last one — Word requires at least one <w:p> per cell)
      if (paras.length < 2) continue;
      let nonEmptyCount = 0;
      for (let p = 0; p < paras.length; p++) {
        if ((paras[p].textContent || '').trim().length > 0) nonEmptyCount++;
      }
      if (nonEmptyCount === 0) continue; // Don't strip if all are empty
      for (let p = 0; p < paras.length; p++) {
        if ((paras[p].textContent || '').trim().length === 0 && paras[p].parentNode === cell) {
          parasToRemove.push(paras[p]);
        }
      }
    }
    for (const para of parasToRemove) {
      para.parentNode?.removeChild(para);
    }

    if (rowsToRemove.length > 0 || parasToRemove.length > 0) {
      modified = true;
      for (const row of rowsToRemove) {
        row.parentNode?.removeChild(row);
      }
      const outXml = serializer.serializeToString(doc);
      zip.updateFile(partName, Buffer.from(outXml, 'utf-8'));
    }
  }

  if (!modified) return docxBuffer;

  const outZip = new AdmZip();
  copyEntriesSkippingDirs(zip, outZip);
  return outZip.toBuffer();
}

/**
 * True if `borders` (a `<w:tcBorders>` or `<w:pBdr>` element) declares a visible
 * bottom border — i.e. the line is already "ruled". A `<w:bottom>` with val
 * `none`/`nil` (or absent) is not a rule.
 */
function hasVisibleBottomBorder(borders: Element | null): boolean {
  if (!borders) return false;
  const bottoms = borders.getElementsByTagNameNS(W_NS, 'bottom');
  for (let i = 0; i < bottoms.length; i++) {
    if (bottoms[i].parentNode !== borders) continue; // direct child only
    const val = bottoms[i].getAttribute('w:val');
    if (val && val !== 'none' && val !== 'nil') return true;
  }
  return false;
}

/** First matching `<w:NAME>` element that is a direct child of `parent`, or null. */
function directChild(parent: Element | null, name: string): Element | null {
  if (!parent) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i] as Element;
    if (child?.nodeType === 1 && child.localName === name && child.namespaceURI === W_NS) {
      return child;
    }
  }
  return null;
}

/** Last `<w:p>` that is a direct child of `cell` — the line its bottom border underlines. */
function lastDirectParagraph(cell: Element): Element | null {
  let last: Element | null = null;
  for (let i = 0; i < cell.childNodes.length; i++) {
    const child = cell.childNodes[i] as Element;
    if (child?.nodeType === 1 && child.localName === 'p' && child.namespaceURI === W_NS) {
      last = child;
    }
  }
  return last;
}

/**
 * True when `run` sits on a line that already carries a bottom-border rule:
 * - its paragraph has its own bottom border (`<w:p>/<w:pPr>/<w:pBdr>/<w:bottom>`), or
 * - it is in the LAST paragraph of a table cell whose bottom border is visible
 *   (`<w:tc>/<w:tcPr>/<w:tcBorders>/<w:bottom>`).
 *
 * The last-paragraph guard matters: a cell's bottom border only underlines the
 * cell's final line, so a placeholder in an earlier paragraph of a multi-line
 * cell is NOT on the rule and must be left alone. Purely structural — it asks
 * what the OOXML draws, never what the field means.
 */
function sitsOnRuledLine(run: Element): boolean {
  let cell: Element | null = null;
  let para: Element | null = null;
  let node: Node | null = run.parentNode;
  while (node) {
    if (node.nodeType === 1) {
      const el = node as Element;
      if (el.namespaceURI === W_NS) {
        if (!para && el.localName === 'p') para = el;
        if (!cell && el.localName === 'tc') cell = el;
      }
    }
    node = node.parentNode;
  }

  const paraBorders = directChild(directChild(para, 'pPr'), 'pBdr');
  if (hasVisibleBottomBorder(paraBorders)) return true;

  const cellBorders = directChild(directChild(cell, 'tcPr'), 'tcBorders');
  if (hasVisibleBottomBorder(cellBorders) && cell && para === lastDirectParagraph(cell)) {
    return true;
  }
  return false;
}

/**
 * Suppress the blank-fill placeholder ('_______') on runs that already sit on a
 * ruled line. The placeholder exists to draw a "write a value here" line where
 * the template provides none; on a line that is already ruled (a signature
 * block, an underlined field) it just stacks a second underline on top of the
 * existing rule. This clears the redundant underscores — leaving the rule as the
 * clean blank line — and drops any authoring highlight left on the run.
 *
 * Structural by design: it keys off the OOXML border, not off field names, so it
 * needs no knowledge of which fields are "signatures". A blank placeholder on an
 * un-ruled line is left untouched (its underscores are the intended cue).
 */
function stripBlankPlaceholderOnRuledLines(docxBuffer: Buffer): Buffer {
  const zip = new AdmZip(docxBuffer);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  let modified = false;

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const doc: Document = parser.parseFromString(entry.getData().toString('utf-8'), 'text/xml');
    const runs = doc.getElementsByTagNameNS(W_NS, 'r');
    let changed = false;

    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      // Only a run whose entire text IS the blank placeholder — not underscores
      // embedded in real prose.
      if (extractRunText(run).trim() !== BLANK_PLACEHOLDER) continue;
      if (!sitsOnRuledLine(run)) continue;

      // Remove only the placeholder underscores, preserving any surrounding
      // whitespace — a trailing space can be a signing-anchor callers rely on
      // (#109) — and keeping the run/paragraph so the rule itself survives.
      const tEls = run.getElementsByTagNameNS(W_NS, 't');
      for (let t = 0; t < tEls.length; t++) {
        tEls[t].textContent = (tEls[t].textContent ?? '').replace(BLANK_PLACEHOLDER, '');
      }

      // Drop any leftover authoring highlight on the now-empty run.
      const rPr = run.getElementsByTagNameNS(W_NS, 'rPr');
      if (rPr.length > 0) {
        const highlights = rPr[0].getElementsByTagNameNS(W_NS, 'highlight');
        for (let h = highlights.length - 1; h >= 0; h--) {
          highlights[h].parentNode?.removeChild(highlights[h]);
        }
      }
      changed = true;
    }

    if (changed) {
      modified = true;
      zip.updateFile(partName, Buffer.from(serializer.serializeToString(doc), 'utf-8'));
    }
  }

  if (!modified) return docxBuffer;

  const outZip = new AdmZip();
  copyEntriesSkippingDirs(zip, outZip);
  return outZip.toBuffer();
}

/**
 * Fill a DOCX template with prepared data:
 * 1. Strip drafting note paragraphs (configurable, on by default)
 * 2. Strip highlighting from runs with filled fields (unfilled keep their highlight)
 * 3. Sanitize currency values by scanning the template buffer for ${field} patterns
 * 4. Call docx-templates createReport() with standard delimiters
 * 5. Remove structurally empty table rows left by conditional rendering
 * 6. Suppress the blank-fill placeholder on lines that already carry a rule
 * 7. Return the filled buffer
 */
export async function fillDocx(options: FillDocxOptions): Promise<Uint8Array> {
  const {
    data,
    fixSmartQuotes = false,
    stripParagraphPatterns = DEFAULT_STRIP_PATTERNS,
  } = options;
  let { templateBuffer } = options;

  // Step 1: Strip drafting notes (and other configured patterns)
  if (stripParagraphPatterns.length > 0) {
    templateBuffer = stripParagraphs(templateBuffer, stripParagraphPatterns);
  }

  // Step 2: Strip highlighting only from fields that have non-empty values.
  // Unfilled fields keep their yellow highlight as a visual cue.
  const filledFields = new Set<string>();
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string' && val !== '' && val !== BLANK_PLACEHOLDER) {
      filledFields.add(key);
    } else if (typeof val === 'boolean') {
      filledFields.add(key); // booleans are always "filled"
    }
  }
  templateBuffer = stripFilledHighlighting(templateBuffer, filledFields);

  // Step 3: Strip leading $ from values where the template has ${ before the tag
  const sanitizedData = sanitizeCurrencyValuesFromDocx(data, templateBuffer);

  // Step 4: Fill template
  const filled = await createReport({
    template: templateBuffer,
    data: sanitizedData,
    cmdDelimiter: ['{', '}'],
    fixSmartQuotes,
    // Emit line breaks as separate text runs for viewer compatibility.
    processLineBreaks: true,
    processLineBreaksAsNewText: true,
  });

  const filledBuffer = rezipWithoutDirEntries(new AdmZip(Buffer.from(filled))).toBuffer();

  // Step 5: Remove malformed empty table rows from conditional rendering
  const cleaned = stripEmptyTableRows(filledBuffer);
  // Step 6: Drop the blank placeholder where the line is already ruled, so an
  // unfilled field on a signature/underlined line shows a single clean rule
  // instead of stacking underscores on top of the existing border.
  const deruled = stripBlankPlaceholderOnRuledLines(cleaned);
  // Step 7: Renumber clause headings so fully-omitted clauses leave no gap
  return renumberClauseHeadings(deruled);
}

/** The OAClauseHeading style marks the numbered standard-terms clause headings. */
const CLAUSE_HEADING_STYLE = 'OAClauseHeading';

/** Read a paragraph's direct pStyle value (or null). */
function paragraphStyle(p: Element): string | null {
  for (let i = 0; i < p.childNodes.length; i++) {
    const child = p.childNodes[i] as Element;
    if (child?.nodeType === 1 && child.localName === 'pPr' && child.namespaceURI === W_NS) {
      const styles = child.getElementsByTagNameNS(W_NS, 'pStyle');
      return styles.length > 0 ? styles[0].getAttribute('w:val') : null;
    }
  }
  return null;
}

/**
 * Replace the characters in [start, end) across an ordered list of <w:t> text
 * nodes with `replacement` (inserted at `start`). Preserves run formatting by
 * editing only the affected runs' text. Used to swap a clause heading's leading
 * number even if it is split across runs.
 */
function rewriteTextRange(
  segments: { node: Element; text: string }[],
  start: number,
  end: number,
  replacement: string,
): void {
  let offset = 0;
  let inserted = false;
  for (const seg of segments) {
    const segStart = offset;
    const segEnd = offset + seg.text.length;
    offset = segEnd;
    if (segEnd <= start || segStart >= end) continue; // untouched run
    const localStart = Math.max(0, start - segStart);
    const localEnd = Math.min(seg.text.length, end - segStart);
    const before = seg.text.slice(0, localStart);
    const after = seg.text.slice(localEnd);
    seg.text = before + (inserted ? '' : replacement) + after;
    seg.node.textContent = seg.text;
    inserted = true;
  }
}

/** Read the `<w:t>` text nodes of a paragraph as an ordered, editable segment list. */
function paragraphTextSegments(p: Element): { node: Element; text: string }[] {
  const tEls = p.getElementsByTagNameNS(W_NS, 't');
  const segments: { node: Element; text: string }[] = [];
  for (let j = 0; j < tEls.length; j++) {
    segments.push({ node: tEls[j], text: tEls[j].textContent ?? '' });
  }
  return segments;
}

/** Matches a cover-notice cross-reference sentinel "<<xref:oa_xref_…>>". */
const XREF_SENTINEL_RE = /<<xref:(oa_xref_[0-9a-f]+)>>/;

/**
 * Renumber standard-terms clause headings (style OAClauseHeading) sequentially
 * (1..N) in `word/document.xml` after {IF} resolution, so a fully-omitted clause
 * leaves no gap. Clause numbers are literal text (not Word list numbering), so a
 * dropped clause would otherwise skip a number. Idempotent: a heading already
 * carrying its sequential number is untouched.
 *
 * Same pass resolves the cover confirmation notice's cross-reference sentinels:
 * each `<<xref:<bookmark>>>` is rewritten to the live, post-renumber "Section N"
 * of the clause whose heading carries that bookmark (the renderer wraps the
 * sentinel in an internal hyperlink to the same bookmark, so the visible number
 * also becomes the clickable jump target). Name-based `[[clause:id]]` references
 * resolve to heading text upstream, so renumbering breaks no references.
 */
function renumberClauseHeadings(docxBuffer: Buffer): Buffer {
  const zip = new AdmZip(docxBuffer);
  const docEntry = zip.getEntry('word/document.xml');
  if (!docEntry) return docxBuffer;

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const doc = parser.parseFromString(docEntry.getData().toString('utf-8'), 'text/xml');

  const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  let counter = 0;
  let changed = false;

  // First pass: assign sequential numbers and map each heading's xref bookmark
  // (if any) to its resolved number, so the cover-notice sentinels can link to it.
  const numberByBookmark = new Map<string, number>();

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (paragraphStyle(p) !== CLAUSE_HEADING_STYLE) continue;

    const segments = paragraphTextSegments(p);
    const full = segments.map((s) => s.text).join('');
    const m = full.match(/^(\s*)(\d+)\./);
    if (!m) continue; // a heading without a leading "N." — leave it alone

    counter += 1;

    const bookmarkStarts = p.getElementsByTagNameNS(W_NS, 'bookmarkStart');
    for (let k = 0; k < bookmarkStarts.length; k++) {
      const name = bookmarkStarts[k].getAttribute('w:name');
      if (name && name.startsWith('oa_xref_')) numberByBookmark.set(name, counter);
    }

    const newDigits = String(counter);
    if (m[2] === newDigits) continue; // already correct (idempotent)

    const start = m[1].length;
    rewriteTextRange(segments, start, start + m[2].length, newDigits);
    changed = true;
  }

  // Second pass: resolve cover-notice cross-reference sentinels to "Section N".
  // A present bullet always has a present (un-omitted) target heading, so the
  // bookmark is in the map; the empty-string fallback is purely defensive.
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const segments = paragraphTextSegments(p);
    if (segments.length === 0) continue;

    let match = segments.map((s) => s.text).join('').match(XREF_SENTINEL_RE);
    while (match && match.index !== undefined) {
      const num = numberByBookmark.get(match[1]);
      const replacement = num !== undefined ? `Section ${num}` : '';
      rewriteTextRange(segments, match.index, match.index + match[0].length, replacement);
      changed = true;
      match = segments.map((s) => s.text).join('').match(XREF_SENTINEL_RE);
    }
  }

  if (!changed) return docxBuffer;
  zip.updateFile('word/document.xml', Buffer.from(serializer.serializeToString(doc), 'utf-8'));

  const outZip = new AdmZip();
  copyEntriesSkippingDirs(zip, outZip);
  return outZip.toBuffer();
}

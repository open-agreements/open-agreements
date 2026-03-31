/**
 * Shared fill pipeline used by all three fill paths (template, external, recipe).
 * Centralizes: defaults, boolean coercion, display fields, currency sanitization,
 * drafting note removal, and the docx-templates createReport() call.
 */

import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import { createReport } from 'docx-templates';
import { sanitizeCurrencyValuesFromDocx, BLANK_PLACEHOLDER } from './fill-utils.js';
import { enumerateTextParts, getGeneralTextPartNames } from './recipe/ooxml-parts.js';
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
   * Default values for signature tag fields from signing.yaml.
   * These are {tag}s in the DOCX that aren't in metadata.yaml (e.g., {sig_party_1}).
   * When a signing provider is connected, these are filled with provider-specific
   * anchor strings. When no provider is connected, they default to empty strings
   * to prevent docx-templates from treating them as undefined JS expressions.
   */
  signingTagDefaults?: Record<string, string>;

  /**
   * Optional callback for computing display fields (template-specific).
   * Called after defaults and boolean coercion are applied.
   */
  computeDisplayFields?: (data: Record<string, unknown>) => void;
}

export interface FillDocxOptions {
  /** Template DOCX buffer (already patched with {tags}). */
  templateBuffer: Buffer;

  /** Prepared fill data from prepareFillData(). */
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

/**
 * Prepare fill data with all normalization steps:
 * 1. Warn about unfilled priority fields
 * 2. Apply defaults for optional fields not provided
 * 3. Coerce boolean fields (optional)
 * 4. Compute display fields (optional, template-specific)
 */
export function prepareFillData(options: PrepareFillDataOptions): Record<string, unknown> {
  const {
    values,
    fields,
    priorityFieldNames = [],
    useBlankPlaceholder = false,
    coerceBooleans = false,
    computeDisplayFields,
    signingTagDefaults,
  } = options;

  // Apply defaults for fields not provided
  const defaultValue = useBlankPlaceholder ? BLANK_PLACEHOLDER : '';
  const data: Record<string, unknown> = { ...values };

  // Inject signing tag defaults (empty strings unless provider anchors are supplied)
  if (signingTagDefaults) {
    for (const [key, val] of Object.entries(signingTagDefaults)) {
      if (!(key in data)) {
        data[key] = val;
      }
    }
  }
  for (const field of fields) {
    if (!(field.name in data)) {
      // Array fields default to empty array, not blank placeholder
      if (field.type === 'array') {
        data[field.name] = [];
      } else {
        data[field.name] = field.default ?? defaultValue;
      }
    }
  }

  // Warn about priority fields that are still unfilled (no value, no default)
  const prioritySet = new Set(priorityFieldNames);
  const missing = fields
    .filter((f) => prioritySet.has(f.name) && (data[f.name] === '' || data[f.name] === BLANK_PLACEHOLDER))
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
  for (const entry of zip.getEntries()) {
    outZip.addFile(entry.entryName, entry.getData());
  }
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
  for (const entry of zip.getEntries()) {
    outZip.addFile(entry.entryName, entry.getData());
  }
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
  for (const entry of zip.getEntries()) {
    outZip.addFile(entry.entryName, entry.getData());
  }
  return outZip.toBuffer();
}

/**
 * Fill a DOCX template with prepared data:
 * 1. Strip drafting note paragraphs (configurable, on by default)
 * 2. Strip highlighting from runs with filled fields (unfilled keep their highlight)
 * 3. Sanitize currency values by scanning the template buffer for ${field} patterns
 * 4. Call docx-templates createReport() with standard delimiters
 * 5. Remove structurally empty table rows left by conditional rendering
 * 6. Return the filled buffer
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

  // Step 5: Remove malformed empty table rows from conditional rendering
  const cleaned = stripEmptyTableRows(Buffer.from(filled));
  return cleaned;
}

// Human-fillable bracket-prose transform for catalog preview parity.
//
// The CLI fill path (`fillDocx`) swaps `{snake_case}` tokens for caller-supplied
// values — that is the API consumers use programmatically. Humans never see it.
//
// What humans DO see is the file served from usejunior.com/template-downloads/<id>.docx,
// which is run through a different transform that turns `{employer_name}` into
// `[Employer Legal Name]` (with a yellow highlight) so a lawyer opening the file in Word
// can read it as prose and tab through the must-fills.
//
// This module is a TypeScript port of dev-website's `scripts/generate_template_downloads.js`
// transform, so the catalog preview PNGs match what users actually download. The
// CLI fill path is unchanged — design split is intentional.

import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';
import yaml from 'js-yaml';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const W_P_TAG = 'p';
const W_R_TAG = 'r';
const W_RPR_TAG = 'rPr';
const W_T_TAG = 't';
const W_TC_TAG = 'tc';
const W_HIGHLIGHT_TAG = 'highlight';
const XML_SPACE_ATTR = 'xml:space';

const XML_PATH_RE = /^(word|docProps)\/.+\.xml$/;
const IF_MARKER_RE = /\{IF [^}]+\}/g;
const END_IF_MARKER_RE = /\{END-IF\}/g;
const FIELD_RE = /\{([a-z0-9_]+)\}/g;
const PLACEHOLDER_RE = /\{([a-z0-9_]+)\}/g;
const MULTI_SPACE_RE = /\s{2,}/g;
const EXACT_IF_MARKER_RE = /^\{IF\s+(!?[^}]+)\}$/;
const EXACT_END_IF_MARKER_RE = /^\{END-IF\}$/;
const HIGHLIGHT_PLACEHOLDER_RE = /(\[[^\]]+\])/g;
const PLACEHOLDER_ONLY_RE = /^\[[^\]]+\]$/;
const GENERIC_SUBLABELS = new Set(['duration']);

export interface HumanizeContext {
  fieldLabels: Record<string, string>;
  fieldDefaults: Record<string, string>;
}

export interface HumanizeOptions {
  publicFieldMetadataPath?: string;
  templateSpecsDir?: string;
}

interface TemplateField {
  name?: string;
  description?: string;
  default?: unknown;
}

interface TemplateMetadata {
  fields?: TemplateField[];
}

interface PublicFieldEntry {
  label?: string;
  default?: string;
}

interface PublicFieldMetadata {
  global?: Record<string, PublicFieldEntry>;
  templates?: Record<string, Record<string, PublicFieldEntry>>;
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))];
}

function fallbackFieldLabel(fieldName: string): string {
  return String(fieldName || '').trim();
}

function normalizeDisplayLabel(rawLabel: unknown): string {
  let label = String(rawLabel ?? '').replace(MULTI_SPACE_RE, ' ').trim();
  if (label.length > 80) {
    const sentence = label.split(/(?<=[.!?])\s+/, 1)[0];
    if (sentence) {
      label = sentence;
    }
  }
  return label.replace(/\.$/, '');
}

function normalizeDefaultText(rawDefault: unknown): string | null {
  if (rawDefault == null || typeof rawDefault === 'boolean') return null;
  const text = String(rawDefault).replace(MULTI_SPACE_RE, ' ').trim();
  return text;
}

function loadTemplateMetadataFields(templateDir: string): Record<string, TemplateField> {
  const metadataPath = join(templateDir, 'metadata.yaml');
  let raw: string;
  try {
    raw = readFileSync(metadataPath, 'utf8');
  } catch {
    return {};
  }
  const metadata = (yaml.load(raw) as TemplateMetadata | null) ?? {};
  const fields: Record<string, TemplateField> = {};
  for (const field of metadata.fields ?? []) {
    if (field && field.name) {
      fields[field.name] = field;
    }
  }
  return fields;
}

function loadStructuredPublicFieldMetadata(
  templateDir: string,
  publicFieldMetadataPath?: string,
): Record<string, PublicFieldEntry> {
  if (!publicFieldMetadataPath) return {};
  let raw: string;
  try {
    raw = readFileSync(publicFieldMetadataPath, 'utf8');
  } catch {
    return {};
  }
  const metadata = (yaml.load(raw) as PublicFieldMetadata | null) ?? {};
  const templateId = basename(templateDir);
  const globalFields = metadata.global ?? {};
  const templateFields = metadata.templates?.[templateId] ?? {};

  const structuredFields: Record<string, PublicFieldEntry> = {};
  for (const fieldName of unique([...Object.keys(globalFields), ...Object.keys(templateFields)])) {
    const entry = { ...(globalFields[fieldName] ?? {}), ...(templateFields[fieldName] ?? {}) };
    const normalizedEntry: PublicFieldEntry = {};

    if (hasOwn(entry, 'label')) {
      const label = normalizeDisplayLabel(entry.label);
      if (label) normalizedEntry.label = label;
    }

    if (hasOwn(entry, 'default')) {
      const defaultText = normalizeDefaultText(entry.default);
      if (defaultText !== null) normalizedEntry.default = defaultText;
    }

    if (Object.keys(normalizedEntry).length > 0) {
      structuredFields[fieldName] = normalizedEntry;
    }
  }

  return structuredFields;
}

function buildFieldDefaults(templateDir: string): Record<string, string> {
  const metadataFields = loadTemplateMetadataFields(templateDir);
  const defaults: Record<string, string> = {};
  for (const [fieldName, field] of Object.entries(metadataFields)) {
    if (!hasOwn(field, 'default')) continue;
    const defaultText = normalizeDefaultText(field.default);
    if (defaultText !== null) defaults[fieldName] = defaultText;
  }
  return defaults;
}

function extractPlaceholderNames(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return [...value.matchAll(PLACEHOLDER_RE)].map((match) => match[1]);
}

function buildEffectiveLabel(label: string, parentLabel: string, isSubRow: boolean): string {
  if (!label) return '';
  if (!isSubRow || !parentLabel) return label;
  if (GENERIC_SUBLABELS.has(label.toLowerCase())) return `${parentLabel} ${label}`;
  return label;
}

interface SpecRow {
  label?: string;
  sub?: boolean;
  value?: unknown;
  left?: unknown;
  right?: unknown;
}

function collectRowLabels(rows: SpecRow[], labels: Record<string, string>): void {
  let parentLabel = '';
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rowLabel = normalizeDisplayLabel(row.label ?? '');
    if (rowLabel && !row.sub) parentLabel = rowLabel;
    const effectiveLabel = buildEffectiveLabel(rowLabel, parentLabel, Boolean(row.sub));
    if (!effectiveLabel) continue;
    for (const key of ['value', 'left', 'right'] as const) {
      for (const fieldName of extractPlaceholderNames(row[key])) {
        if (!labels[fieldName]) labels[fieldName] = effectiveLabel;
      }
    }
  }
}

function collectStructuredLabels(node: unknown, labels: Record<string, string> = {}): Record<string, string> {
  if (Array.isArray(node)) {
    for (const item of node) collectStructuredLabels(item, labels);
    return labels;
  }
  if (!node || typeof node !== 'object') return labels;
  const rec = node as Record<string, unknown>;
  if (Array.isArray(rec.rows)) collectRowLabels(rec.rows as SpecRow[], labels);
  const label = normalizeDisplayLabel(rec.label ?? '');
  if (label) {
    for (const key of ['value', 'left', 'right'] as const) {
      for (const fieldName of extractPlaceholderNames(rec[key])) {
        if (!labels[fieldName]) labels[fieldName] = label;
      }
    }
  }
  for (const value of Object.values(rec)) collectStructuredLabels(value, labels);
  return labels;
}

function loadTemplateSpec(templateDir: string, templateSpecsDir?: string): unknown {
  if (!templateSpecsDir) return null;
  const specPath = join(templateSpecsDir, `${basename(templateDir)}.json`);
  let raw: string;
  try {
    raw = readFileSync(specPath, 'utf8');
  } catch {
    return null;
  }
  return JSON.parse(raw);
}

function buildFieldLabels(templateDir: string, templateSpecsDir?: string): Record<string, string> {
  const metadataFields = loadTemplateMetadataFields(templateDir);
  const templateSpec = loadTemplateSpec(templateDir, templateSpecsDir);
  const templateSpecLabels = templateSpec ? collectStructuredLabels(templateSpec) : {};

  const fieldLabels: Record<string, string> = {};
  for (const [fieldName, field] of Object.entries(metadataFields)) {
    const baseFieldName = fieldName.endsWith('_footer') ? fieldName.slice(0, -7) : fieldName;
    const displayFieldName = metadataFields[baseFieldName] ? baseFieldName : fieldName;
    const displayField = metadataFields[displayFieldName] ?? field;
    const description = field.description ? normalizeDisplayLabel(field.description) : '';
    const displayDescription = displayField.description ? normalizeDisplayLabel(displayField.description) : '';
    fieldLabels[fieldName] =
      templateSpecLabels[fieldName] ||
      templateSpecLabels[displayFieldName] ||
      displayDescription ||
      description ||
      fallbackFieldLabel(displayFieldName);
  }

  return fieldLabels;
}

export function loadHumanizeContext(templateDir: string, opts: HumanizeOptions = {}): HumanizeContext {
  const publicFieldMetadata = loadStructuredPublicFieldMetadata(templateDir, opts.publicFieldMetadataPath);

  const fieldLabels = buildFieldLabels(templateDir, opts.templateSpecsDir);
  for (const [fieldName, metadata] of Object.entries(publicFieldMetadata)) {
    if (metadata.label) fieldLabels[fieldName] = metadata.label;
  }

  const fieldDefaults = buildFieldDefaults(templateDir);
  for (const [fieldName, metadata] of Object.entries(publicFieldMetadata)) {
    if (hasOwn(metadata, 'default') && metadata.default !== undefined) {
      fieldDefaults[fieldName] = metadata.default;
    }
  }

  return { fieldLabels, fieldDefaults };
}

// --- XML transforms ---

function extractParagraphText(paragraph: Element): string {
  const textNodes = paragraph.getElementsByTagNameNS(W_NS, W_T_TAG);
  const parts: string[] = [];
  for (let i = 0; i < textNodes.length; i += 1) {
    parts.push(textNodes[i].textContent || '');
  }
  return parts.join('');
}

function isWordElement(node: unknown, localName: string): boolean {
  if (!node || typeof node !== 'object') return false;
  const el = node as Element;
  return el.nodeType === 1 && el.namespaceURI === W_NS && el.localName === localName;
}

function cleanupConditionalParagraphs(text: string): string {
  if (!text.includes(W_NS) || !text.includes('<w:p')) return text;

  const parser = new DOMParser();
  let root: Document;
  try {
    root = parser.parseFromString(text, 'text/xml');
  } catch {
    return text;
  }

  let changed = false;

  while (true) {
    let updated = false;
    const parents: Element[] = [root.documentElement as Element];
    const allDescendants = root.getElementsByTagName('*');
    for (let i = 0; i < allDescendants.length; i += 1) {
      parents.push(allDescendants[i] as Element);
    }

    for (const parent of parents) {
      if (!parent || !parent.childNodes) continue;
      const children: unknown[] = [];
      for (let i = 0; i < parent.childNodes.length; i += 1) {
        children.push(parent.childNodes[i]);
      }

      for (let index = 0; index < children.length; index += 1) {
        const child = children[index] as Element;
        if (!isWordElement(child, W_P_TAG)) continue;

        const paragraphText = extractParagraphText(child).trim();
        const ifMatch = paragraphText.match(EXACT_IF_MARKER_RE);
        const isEndIf = EXACT_END_IF_MARKER_RE.test(paragraphText);
        if (!ifMatch && !isEndIf) continue;

        // Inside a table cell, just strip the marker paragraph — preserves cell width.
        if (parent.namespaceURI === W_NS && (parent as Element).localName === W_TC_TAG) {
          parent.removeChild(child);
          changed = true;
          updated = true;
          break;
        }

        if (isEndIf || !ifMatch) {
          parent.removeChild(child);
          changed = true;
          updated = true;
          break;
        }

        let endIndex: number | null = null;
        const blockChildren: unknown[] = [];
        for (let offset = index + 1; offset < children.length; offset += 1) {
          const sibling = children[offset] as Element;
          if (
            isWordElement(sibling, W_P_TAG) &&
            EXACT_END_IF_MARKER_RE.test(extractParagraphText(sibling).trim())
          ) {
            endIndex = offset;
            break;
          }
          blockChildren.push(sibling);
        }

        parent.removeChild(child);
        changed = true;

        if (endIndex !== null) {
          const endMarker = children[endIndex] as Element;
          if (endMarker && endMarker.parentNode === parent) {
            parent.removeChild(endMarker);
          }
          // Negated condition `{IF !foo}` — strip the block content too.
          if (ifMatch[1].trim().startsWith('!')) {
            for (const blockChild of blockChildren) {
              const bc = blockChild as Element;
              if (bc && bc.parentNode === parent) {
                parent.removeChild(bc);
              }
            }
          }
        }

        updated = true;
        break;
      }

      if (updated) break;
    }

    if (!updated) break;
  }

  if (!changed) return text;
  return new XMLSerializer().serializeToString(root);
}

function replaceFieldTokens(
  text: string,
  fieldLabels: Record<string, string>,
  fieldDefaults: Record<string, string>,
): string {
  return text.replace(FIELD_RE, (_match, fieldName: string) => {
    if (hasOwn(fieldDefaults, fieldName)) {
      return fieldDefaults[fieldName];
    }
    const label = fieldLabels[fieldName] || fallbackFieldLabel(fieldName);
    return `[${label}]`;
  });
}

function highlightPlaceholderRuns(text: string): string {
  if (!text.includes(W_NS) || !text.includes('<w:r')) return text;

  const parser = new DOMParser();
  let root: Document;
  try {
    root = parser.parseFromString(text, 'text/xml');
  } catch {
    return text;
  }

  let changed = false;

  while (true) {
    let updated = false;
    const runs: Element[] = [];
    const runList = root.getElementsByTagNameNS(W_NS, W_R_TAG);
    for (let i = 0; i < runList.length; i += 1) runs.push(runList[i] as Element);

    for (const run of runs) {
      const childNodes: unknown[] = [];
      for (let i = 0; i < run.childNodes.length; i += 1) childNodes.push(run.childNodes[i]);

      const textChildren = childNodes.filter((node) => isWordElement(node, W_T_TAG)) as Element[];
      const nonTextChildren = childNodes.filter((node) => {
        const el = node as Element;
        return (
          el && el.nodeType === 1 && el.namespaceURI === W_NS &&
          el.localName !== W_T_TAG && el.localName !== W_RPR_TAG
        );
      });

      if (textChildren.length === 0 || nonTextChildren.length > 0) continue;

      const runText = textChildren.map((node) => node.textContent || '').join('');
      const parts = runText.split(HIGHLIGHT_PLACEHOLDER_RE);
      if (parts.length === 1) continue;

      const parent = run.parentNode as Element | null;
      if (!parent || parent.nodeType !== 1) continue;

      const baseRPr = childNodes.find((node) => isWordElement(node, W_RPR_TAG)) as Element | undefined;
      if (
        baseRPr &&
        baseRPr.getElementsByTagNameNS(W_NS, W_HIGHLIGHT_TAG).length > 0 &&
        PLACEHOLDER_ONLY_RE.test(runText)
      ) {
        continue;
      }

      const insertBefore = run.nextSibling;
      // Reset lastIndex on the global regex between checks — same instance is reused.
      HIGHLIGHT_PLACEHOLDER_RE.lastIndex = 0;
      for (const part of parts) {
        if (!part) continue;

        const newRun = root.createElementNS(W_NS, 'w:r');
        let newRPr: Element | null = null;
        if (baseRPr) {
          newRPr = baseRPr.cloneNode(true) as Element;
          newRun.appendChild(newRPr);
        }

        // Whole part is a [bracket placeholder] — add yellow highlight.
        if (PLACEHOLDER_ONLY_RE.test(part)) {
          if (!newRPr) {
            newRPr = root.createElementNS(W_NS, 'w:rPr') as Element;
            newRun.appendChild(newRPr);
          }
          if (newRPr.getElementsByTagNameNS(W_NS, W_HIGHLIGHT_TAG).length === 0) {
            const highlight = root.createElementNS(W_NS, 'w:highlight');
            highlight.setAttributeNS(W_NS, 'w:val', 'yellow');
            newRPr.appendChild(highlight);
          }
        }

        const textNode = root.createElementNS(W_NS, 'w:t');
        textNode.setAttributeNS(XML_NS, XML_SPACE_ATTR, 'preserve');
        textNode.appendChild(root.createTextNode(part));
        newRun.appendChild(textNode);
        parent.insertBefore(newRun, insertBefore);
      }

      parent.removeChild(run);
      changed = true;
      updated = true;
      break;
    }

    if (!updated) break;
  }

  if (!changed) return text;
  return new XMLSerializer().serializeToString(root);
}

export function prettifyTemplateXml(
  text: string,
  fieldLabels: Record<string, string>,
  fieldDefaults: Record<string, string>,
  options: { highlight?: boolean } = {},
): string {
  let output = cleanupConditionalParagraphs(text);
  output = output.replace(IF_MARKER_RE, '');
  output = output.replace(END_IF_MARKER_RE, '');
  output = replaceFieldTokens(output, fieldLabels, fieldDefaults);
  output = output.replace(MULTI_SPACE_RE, ' ');
  if (options.highlight !== false) {
    output = highlightPlaceholderRuns(output);
  }
  return output;
}

export function humanizeDocxBuffer(input: Buffer, ctx: HumanizeContext): Buffer {
  const sourceZip = new AdmZip(input);
  const destinationZip = new AdmZip();

  for (const entry of sourceZip.getEntries()) {
    let data = entry.getData();
    if (XML_PATH_RE.test(entry.entryName)) {
      let text = data.toString('utf8');
      text = cleanupConditionalParagraphs(text);
      text = text.replace(IF_MARKER_RE, '');
      text = text.replace(END_IF_MARKER_RE, '');
      text = replaceFieldTokens(text, ctx.fieldLabels, ctx.fieldDefaults);
      text = text.replace(MULTI_SPACE_RE, ' ');
      if (entry.entryName.startsWith('word/')) {
        text = highlightPlaceholderRuns(text);
      }
      data = Buffer.from(text, 'utf8');
    }
    destinationZip.addFile(entry.entryName, data);
  }

  return destinationZip.toBuffer();
}

/**
 * Public API. Reads template.docx from `templateDir`, applies the same humanize
 * transform that dev-website's `generate_template_downloads.js` applies, and
 * returns the resulting Buffer. The buffer is suitable for rasterizing into a
 * catalog preview PNG that matches what users download.
 */
export async function humanizeDocx(templateDir: string, opts: HumanizeOptions = {}): Promise<Buffer> {
  const sourceDocx = resolve(templateDir, 'template.docx');
  const input = readFileSync(sourceDocx);
  const ctx = loadHumanizeContext(templateDir, opts);
  return humanizeDocxBuffer(input, ctx);
}

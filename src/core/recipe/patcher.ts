import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import {
  replaceParagraphTextRange,
  getParagraphText,
  SafeDocxError,
} from '@usejunior/docx-core';
import { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';
import { parseReplacementKey, resolveReplacementValue } from './replacement-keys.js';
import type { ParsedKey, ReplacementValue } from './replacement-keys.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Normalize smart/typographic quotes to ASCII equivalents for matching.
 * Uses the same canonical quote set as verifier's normalizeText().
 * This is a 1-to-1 character mapping so charMap positions remain valid.
 */
function normalizeQuotes(text: string): string {
  return text
    .replace(/[\u2018\u2019\u2039\u203A]/g, "'")
    .replace(/[\u201C\u201D\u201A\u201E\u00AB\u00BB]/g, '"');
}

interface CharMapEntry {
  runIndex: number;
  charOffset: number;
}

export interface PatchResult {
  outputPath: string;
  zeroMatchKeys: string[];
}

/** Maximum replacement iterations per key per paragraph to prevent infinite loops. */
const MAX_REPLACEMENTS_PER_KEY = 200;

/**
 * Element local names that indicate a run is NOT safe to remove even if its text is empty.
 * These are non-text children that carry visual or structural meaning.
 */
const UNSAFE_RUN_CHILDREN = new Set([
  'drawing', 'pict', 'object', 'fldChar', 'instrText',
  'br', 'cr', 'tab', 'footnoteReference', 'endnoteReference',
]);

/**
 * Patch a DOCX document by replacing bracketed placeholders with template tags.
 * Uses a char_map algorithm to handle cross-run replacements where Word splits
 * placeholder text across multiple XML run elements.
 *
 * Supports two key syntax types:
 * - Simple: "search text" → replaces all occurrences
 * - Context: "context > placeholder" → in tables, replaces placeholder in rows
 *   where label matches; in paragraphs, replaces first placeholder after context
 *
 * Processing order: context keys first, simple keys last.
 * This ensures qualified rules claim their targets before simple rules sweep up the rest.
 */
export interface PatchOptions {
  /** Hex color (e.g. "000000") to apply to replacement text. When set, the
   *  patcher explicitly sets <w:color> on runs that receive replacement text,
   *  overriding any inherited placeholder styling (e.g. gray). */
  replacementColor?: string;
}

export async function patchDocument(
  inputPath: string,
  outputPath: string,
  replacements: Record<string, ReplacementValue>,
  options?: PatchOptions,
): Promise<PatchResult> {
  const zip = new AdmZip(inputPath);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  if (partNames.length === 0) {
    throw new Error('No OOXML text parts found in DOCX');
  }

  // Parse and classify all keys, normalizing smart quotes
  const parsedKeys: ParsedKey[] = [];
  for (const [key, rawValue] of Object.entries(replacements)) {
    const value = resolveReplacementValue(rawValue);
    const parsed = parseReplacementKey(key, value);
    // Normalize smart quotes in search text and context for matching
    if (parsed.type === 'context') {
      parsed.searchText = normalizeQuotes(parsed.searchText);
      parsed.context = normalizeQuotes(parsed.context);
    } else {
      parsed.searchText = normalizeQuotes(parsed.searchText);
    }
    parsedKeys.push(parsed);
  }

  // Deduplicate keys that collide after quote normalization
  const seenSearchKeys = new Map<string, ParsedKey>();
  const deduplicatedKeys: ParsedKey[] = [];
  for (const pk of parsedKeys) {
    const dedupKey = pk.type === 'context' ? `${pk.context} > ${pk.searchText}` : pk.searchText;
    const existing = seenSearchKeys.get(dedupKey);
    if (existing) {
      if (existing.value !== pk.value) {
        console.warn(`Patcher: quote-normalized key collision for "${dedupKey}" with different values`);
      }
      // Skip duplicate
    } else {
      seenSearchKeys.set(dedupKey, pk);
      deduplicatedKeys.push(pk);
    }
  }

  // Separate by type and sort
  const contextKeys = deduplicatedKeys
    .filter((k): k is ParsedKey & { type: 'context' } => k.type === 'context')
    .sort((a, b) => b.searchText.length - a.searchText.length);

  const simpleKeys = deduplicatedKeys
    .filter((k): k is ParsedKey & { type: 'simple' } => k.type === 'simple')
    .sort((a, b) => b.searchText.length - a.searchText.length);

  // Track which parts we modify so we can rebuild the zip cleanly
  const modifiedParts = new Map<string, Buffer>();

  // Collect all pre-patch paragraph text for zero-match detection
  const preMatchTexts: string[] = [];

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc: Document = parser.parseFromString(xml, 'text/xml');

    const allParagraphs = doc.getElementsByTagNameNS(W_NS, 'p');

    // Collect paragraph text before any replacements for zero-match detection
    for (let i = 0; i < allParagraphs.length; i++) {
      const text = getParagraphText(allParagraphs[i] as unknown as globalThis.Element);
      if (!text) continue;
      preMatchTexts.push(normalizeQuotes(text));
    }

    // Phase 1: Context keys
    for (const ck of contextKeys) {
      for (let i = 0; i < allParagraphs.length; i++) {
        const para = allParagraphs[i];
        const paraText = getParagraphText(para as unknown as globalThis.Element);
        if (!paraText) continue;

        const normalizedText = normalizeQuotes(paraText);
        if (!normalizedText.includes(ck.searchText)) continue;

        const rowContext = getTableRowContext(para);
        if (rowContext !== null) {
          const normalizedRowContext = normalizeQuotes(rowContext);
          if (!normalizedRowContext.includes(ck.context)) continue;
          replaceInParagraph(para, { [ck.searchText]: ck.value }, [ck.searchText], options?.replacementColor);
        } else {
          if (!normalizedText.includes(ck.context)) continue;
          replaceFirstAfterContext(para, ck.searchText, ck.context, ck.value, options?.replacementColor);
        }
      }
    }

    // Phase 2: Simple keys
    if (simpleKeys.length > 0) {
      const simpleReplacements: Record<string, string> = {};
      const simpleSortedKeys: string[] = [];
      for (const sk of simpleKeys) {
        simpleReplacements[sk.searchText] = sk.value;
        simpleSortedKeys.push(sk.searchText);
      }

      for (let i = 0; i < allParagraphs.length; i++) {
        replaceInParagraph(allParagraphs[i], simpleReplacements, simpleSortedKeys, options?.replacementColor);
      }

    }

    modifiedParts.set(partName, Buffer.from(serializer.serializeToString(doc), 'utf-8'));
  }

  // Compute zero-match keys by checking pre-patch paragraph text
  const preMatchFullText = preMatchTexts.join('\n');
  const zeroMatchKeys: string[] = [];
  for (const pk of deduplicatedKeys) {
    const keyLabel = pk.type === 'context' ? `${pk.context} > ${pk.searchText}` : pk.searchText;
    if (!preMatchFullText.includes(pk.searchText)) {
      zeroMatchKeys.push(keyLabel);
    }
  }

  // Rebuild the zip from scratch using addFile() to avoid adm-zip data
  // descriptor issues. Some DOCX files use streaming (bit 3) flags which
  // adm-zip's updateFile/writeZip/toBuffer handle incorrectly.
  const outZip = new AdmZip();
  for (const entry of zip.getEntries()) {
    const data = modifiedParts.get(entry.entryName) ?? entry.getData();
    outZip.addFile(entry.entryName, data);
  }
  writeFileSync(outputPath, outZip.toBuffer());
  return { outputPath, zeroMatchKeys };
}

/**
 * Get the text content of the first table cell (label cell) in the same row
 * as the paragraph. Returns null if the paragraph is not inside a table cell.
 */
export function getTableRowContext(para: Element): string | null {
  // Walk up to find the containing <w:tr>
  let node: Node | null = para.parentNode;
  let inTc = false;
  while (node) {
    const el = node as Element;
    if (el.localName === 'tc' && el.namespaceURI === W_NS) {
      inTc = true;
    }
    if (el.localName === 'tr' && el.namespaceURI === W_NS) {
      if (!inTc) return null; // para wasn't in a table cell
      // Get the first <w:tc> in this row
      const children = el.childNodes;
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as Element;
        if (child.localName === 'tc' && child.namespaceURI === W_NS) {
          return extractCellText(child);
        }
      }
      return null;
    }
    node = node.parentNode;
  }
  return null;
}

function extractCellText(tc: Element): string {
  const tElements = tc.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tElements.length; i++) {
    parts.push(tElements[i].textContent ?? '');
  }
  return parts.join('').trim();
}

function buildCharMap(runs: Element[]): { fullText: string; charMap: CharMapEntry[] } {
  const charMap: CharMapEntry[] = [];
  let fullText = '';

  for (let runIndex = 0; runIndex < runs.length; runIndex++) {
    const text = getRunText(runs[runIndex]);
    for (let offset = 0; offset < text.length; offset++) {
      charMap.push({ runIndex, charOffset: offset });
    }
    fullText += text;
  }

  return { fullText, charMap };
}

export function getRunText(run: Element): string {
  const tElements = run.getElementsByTagNameNS(W_NS, 't');
  let text = '';
  for (let i = 0; i < tElements.length; i++) {
    text += tElements[i].textContent ?? '';
  }
  return text;
}

/**
 * Set <w:color w:val="..."/> on a run's <w:rPr>. Creates <w:rPr> if absent.
 * Overwrites any existing <w:color>.
 */
function setRunColor(run: Element, colorHex: string): void {
  const doc = run.ownerDocument as Document;
  let rPr: Element | null = null;

  // Find existing <w:rPr>
  const children = run.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (child.localName === 'rPr' && child.namespaceURI === W_NS) {
      rPr = child;
      break;
    }
  }

  if (!rPr) {
    rPr = doc.createElementNS(W_NS, 'w:rPr');
    run.insertBefore(rPr, run.firstChild);
  }

  // Find or create <w:color>
  const rPrChildren = rPr.childNodes;
  for (let i = 0; i < rPrChildren.length; i++) {
    const prop = rPrChildren[i] as Element;
    if (prop.localName === 'color' && prop.namespaceURI === W_NS) {
      prop.setAttributeNS(W_NS, 'w:val', colorHex);
      return;
    }
  }

  const color = doc.createElementNS(W_NS, 'w:color');
  color.setAttributeNS(W_NS, 'w:val', colorHex);
  rPr.appendChild(color);
}

function setRunText(run: Element, text: string): void {
  const tElements = run.getElementsByTagNameNS(W_NS, 't');
  if (tElements.length === 0) {
    const doc = run.ownerDocument as Document;
    const t = doc.createElementNS(W_NS, 'w:t');
    t.setAttribute('xml:space', 'preserve');
    t.textContent = text;
    run.appendChild(t);
    return;
  }

  tElements[0].textContent = text;
  if (text.startsWith(' ') || text.endsWith(' ')) {
    tElements[0].setAttribute('xml:space', 'preserve');
  }
  for (let i = 1; i < tElements.length; i++) {
    tElements[i].textContent = '';
  }
}

/**
 * Collect all <w:r> elements in document order within a paragraph, including
 * runs nested inside wrapper elements like <w:hyperlink>, <w:ins>, <w:del>, etc.
 */
function getRunElements(para: Element): Element[] {
  const runs: Element[] = [];
  collectRunsRecursive(para, runs);
  return runs;
}

function collectRunsRecursive(node: Node, runs: Element[]): void {
  const children = (node as Element).childNodes;
  if (!children) return;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Node;
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    if (el.localName === 'r' && el.namespaceURI === W_NS) {
      runs.push(el);
    } else if (el.localName !== 'p') {
      // Recurse into wrapper elements (hyperlink, ins, del, smartTag, etc.)
      // but don't recurse into nested paragraphs
      collectRunsRecursive(el, runs);
    }
  }
}

/**
 * Check if a run is safe to remove when its text is empty.
 * Returns true only if all element children are <w:rPr> or <w:t>.
 * Returns false if the run contains drawings, fields, breaks, or other non-text elements.
 */
export function isRunSafeToRemove(run: Element): boolean {
  const children = run.childNodes;
  if (!children) return true;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Node;
    if (child.nodeType !== 1) continue; // skip text/comment nodes
    const name = (child as Element).localName;
    if (!name) return false;
    if (name === 'rPr' || name === 't') continue;
    if (UNSAFE_RUN_CHILDREN.has(name)) return false;
    // Any other element child we don't recognize — not safe
    return false;
  }
  return true;
}

/**
 * Legacy charMap-based splice: replace `searchTextLength` characters starting at
 * `matchStart` with `value`, cleaning up empty runs afterwards.
 * Used as a fallback when replaceParagraphTextRange throws UNSAFE_CONTAINER_BOUNDARY
 * (e.g. replacements spanning across hyperlinks or SDTs) or UNSUPPORTED_EDIT
 * (e.g. replacement spans field results).
 */
function replaceAtPositionLegacy(
  runs: Element[],
  charMap: CharMapEntry[],
  matchStart: number,
  searchTextLength: number,
  value: string,
  replacementColor?: string,
): void {
  const end = matchStart + searchTextLength;
  const firstEntry = charMap[matchStart];
  const lastEntry = charMap[end - 1];

  if (firstEntry.runIndex === lastEntry.runIndex) {
    const runText = getRunText(runs[firstEntry.runIndex]);
    setRunText(
      runs[firstEntry.runIndex],
      runText.slice(0, firstEntry.charOffset) + value + runText.slice(lastEntry.charOffset + 1)
    );
  } else {
    const firstRunText = getRunText(runs[firstEntry.runIndex]);
    setRunText(runs[firstEntry.runIndex], firstRunText.slice(0, firstEntry.charOffset) + value);
    const lastRunText = getRunText(runs[lastEntry.runIndex]);
    setRunText(runs[lastEntry.runIndex], lastRunText.slice(lastEntry.charOffset + 1));
    for (let mid = firstEntry.runIndex + 1; mid < lastEntry.runIndex; mid++) {
      setRunText(runs[mid], '');
    }
  }

  if (replacementColor) {
    setRunColor(runs[firstEntry.runIndex], replacementColor);
  }

  // Sweep: remove empty runs that are safe to remove
  for (let i = runs.length - 1; i >= 0; i--) {
    if (getRunText(runs[i]) === '' && isRunSafeToRemove(runs[i])) {
      runs[i].parentNode?.removeChild(runs[i]);
    }
  }
}

/**
 * Perform a single replacement of searchText with value in the paragraph.
 * Does NOT loop — replaces only the first match found.
 * Uses docx-core's replaceParagraphTextRange for correct formatting preservation,
 * with a legacy charMap fallback for container-boundary cases (hyperlinks, SDTs).
 */
/**
 * Replace the first occurrence of searchText that appears AFTER contextText
 * in the same paragraph. Each call is self-contained — no chaining or order dependency.
 * Uses docx-core's replaceParagraphTextRange with legacy charMap fallback.
 */
function replaceFirstAfterContext(
  para: Element,
  searchText: string,
  contextText: string,
  value: string,
  replacementColor?: string,
): void {
  const fullText = getParagraphText(para as unknown as globalThis.Element);
  const normalizedFull = normalizeQuotes(fullText);
  const ctxPos = normalizedFull.indexOf(contextText);
  if (ctxPos === -1) return;
  const matchStart = normalizedFull.indexOf(searchText, ctxPos + contextText.length);
  if (matchStart === -1) return;

  try {
    replaceParagraphTextRange(
      para as unknown as globalThis.Element,
      matchStart,
      matchStart + searchText.length,
      replacementColor
        ? [{ text: value, addRunProps: { color: replacementColor } }]
        : value,
    );
  } catch (e) {
    if (e instanceof SafeDocxError && (e.code === 'UNSAFE_CONTAINER_BOUNDARY' || e.code === 'UNSUPPORTED_EDIT')) {
      const runs = getRunElements(para);
      const { fullText: legacyText, charMap } = buildCharMap(runs);
      const normalizedLegacy = normalizeQuotes(legacyText);
      const legacyCtxPos = normalizedLegacy.indexOf(contextText);
      if (legacyCtxPos === -1) return;
      const legacyPos = normalizedLegacy.indexOf(searchText, legacyCtxPos + contextText.length);
      if (legacyPos === -1) return;
      replaceAtPositionLegacy(runs, charMap, legacyPos, searchText.length, value, replacementColor);
    } else {
      throw e;
    }
  }
}

function replaceInParagraph(
  para: Element,
  replacements: Record<string, string>,
  sortedKeys: string[],
  replacementColor?: string,
): void {
  // Quick check: skip if no keys match
  const initialText = getParagraphText(para as unknown as globalThis.Element);
  if (!initialText) return;
  const normalizedInitial = normalizeQuotes(initialText);
  if (!sortedKeys.some((key) => normalizedInitial.includes(key))) return;

  for (const key of sortedKeys) {
    let iterations = 0;
    let paraText = getParagraphText(para as unknown as globalThis.Element);

    while (normalizeQuotes(paraText).includes(key)) {
      iterations++;
      if (iterations > MAX_REPLACEMENTS_PER_KEY) {
        throw new Error(
          `Patcher: exceeded ${MAX_REPLACEMENTS_PER_KEY} replacements for key "${key}" ` +
          `in a single paragraph. This usually means the replacement value contains ` +
          `the search key, creating an infinite loop.`
        );
      }

      const prevText = paraText;
      const matchStart = normalizeQuotes(paraText).indexOf(key);
      const replacement = replacements[key];

      try {
        replaceParagraphTextRange(
          para as unknown as globalThis.Element,
          matchStart,
          matchStart + key.length,
          replacementColor
            ? [{ text: replacement, addRunProps: { color: replacementColor } }]
            : replacement,
        );
      } catch (e) {
        if (e instanceof SafeDocxError && (e.code === 'UNSAFE_CONTAINER_BOUNDARY' || e.code === 'UNSUPPORTED_EDIT')) {
          // Fallback: use legacy charMap splice for this specific match
          const runs = getRunElements(para);
          const { fullText: legacyText, charMap } = buildCharMap(runs);
          const legacyPos = normalizeQuotes(legacyText).indexOf(key);
          if (legacyPos === -1) break;
          replaceAtPositionLegacy(runs, charMap, legacyPos, key.length, replacement, replacementColor);
        } else {
          throw e;
        }
      }

      // Re-read paragraph text after DOM modification
      paraText = getParagraphText(para as unknown as globalThis.Element);

      // Progress guard: if text didn't change, we're stuck
      if (paraText === prevText) {
        throw new Error(
          `Patcher: no progress replacing key "${key}" — replacement value may contain the search key.`
        );
      }
    }
  }

  // Sweep: remove empty runs that are safe to remove (no drawings, fields, etc.)
  const finalRuns = getRunElements(para);
  for (let i = finalRuns.length - 1; i >= 0; i--) {
    if (getRunText(finalRuns[i]) === '' && isRunSafeToRemove(finalRuns[i])) {
      finalRuns[i].parentNode?.removeChild(finalRuns[i]);
    }
  }
}

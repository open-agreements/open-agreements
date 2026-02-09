import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';
import { parseReplacementKey } from './replacement-keys.js';
import type { ParsedKey } from './replacement-keys.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

interface CharMapEntry {
  runIndex: number;
  charOffset: number;
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
 * Supports three key syntax types:
 * - Simple: "search text" → replaces all occurrences
 * - Context: "label > placeholder" → replaces placeholder only in matching table rows
 * - Nth: "text#N" → replaces only the Nth occurrence across the document
 *
 * Processing order: context keys first, nth keys second, simple keys last.
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
  replacements: Record<string, string>,
  options?: PatchOptions,
): Promise<string> {
  const zip = new AdmZip(inputPath);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  if (partNames.length === 0) {
    throw new Error('No OOXML text parts found in DOCX');
  }

  // Parse and classify all keys
  const parsedKeys: ParsedKey[] = [];
  for (const [key, value] of Object.entries(replacements)) {
    parsedKeys.push(parseReplacementKey(key, value));
  }

  // Separate by type and sort
  const contextKeys = parsedKeys
    .filter((k): k is ParsedKey & { type: 'context' } => k.type === 'context')
    .sort((a, b) => b.searchText.length - a.searchText.length);

  const nthKeys = parsedKeys
    .filter((k): k is ParsedKey & { type: 'nth' } => k.type === 'nth')
    .sort((a, b) => {
      // Group by searchText, then by N ascending
      if (a.searchText !== b.searchText) return b.searchText.length - a.searchText.length;
      return a.n - b.n;
    });

  const simpleKeys = parsedKeys
    .filter((k): k is ParsedKey & { type: 'simple' } => k.type === 'simple')
    .sort((a, b) => b.searchText.length - a.searchText.length);

  // Track which parts we modify so we can rebuild the zip cleanly
  const modifiedParts = new Map<string, Buffer>();

  // Occurrence counter for nth keys (shared across all parts, reset per patchDocument call)
  const nthCounters = new Map<string, number>();

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc: Document = parser.parseFromString(xml, 'text/xml');

    const allParagraphs = doc.getElementsByTagNameNS(W_NS, 'p');

    // Phase 1: Context keys
    for (const ck of contextKeys) {
      for (let i = 0; i < allParagraphs.length; i++) {
        const para = allParagraphs[i];
        const runs = getRunElements(para);
        if (runs.length === 0) continue;

        const { fullText } = buildCharMap(runs);
        if (!fullText.includes(ck.searchText)) continue;

        const rowContext = getTableRowContext(para);
        if (rowContext === null || !rowContext.includes(ck.context)) continue;

        replaceInParagraph(para, { [ck.searchText]: ck.value }, [ck.searchText], options?.replacementColor);
      }
    }

    // Phase 2: Nth occurrence keys — group by searchText for a single pass each
    const nthGroups = new Map<string, Array<ParsedKey & { type: 'nth' }>>();
    for (const nk of nthKeys) {
      const group = nthGroups.get(nk.searchText) ?? [];
      group.push(nk);
      nthGroups.set(nk.searchText, group);
    }

    for (const [searchText, group] of nthGroups) {
      // Build a map from occurrence number → value for this group
      const nthMap = new Map<number, string>();
      for (const nk of group) {
        nthMap.set(nk.n, nk.value);
      }

      let counter = nthCounters.get(searchText) ?? 0;
      for (let i = 0; i < allParagraphs.length; i++) {
        const para = allParagraphs[i];
        const runs = getRunElements(para);
        if (runs.length === 0) continue;

        const { fullText } = buildCharMap(runs);
        if (!fullText.includes(searchText)) continue;

        counter++;
        const value = nthMap.get(counter);
        if (value !== undefined) {
          replaceInParagraphOnce(para, searchText, value, options?.replacementColor);
        }
      }
      nthCounters.set(searchText, counter);
    }

    // Phase 3: Simple keys
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

  // Rebuild the zip from scratch using addFile() to avoid adm-zip data
  // descriptor issues. Some DOCX files use streaming (bit 3) flags which
  // adm-zip's updateFile/writeZip/toBuffer handle incorrectly.
  const outZip = new AdmZip();
  for (const entry of zip.getEntries()) {
    const data = modifiedParts.get(entry.entryName) ?? entry.getData();
    outZip.addFile(entry.entryName, data);
  }
  writeFileSync(outputPath, outZip.toBuffer());
  return outputPath;
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
 * Compute the length of the common prefix between two strings.
 */
function commonPrefixLen(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Compute the length of the common suffix between two strings,
 * not overlapping with a known common prefix.
 */
function commonSuffixLen(a: string, b: string, prefixLen: number): number {
  let i = 0;
  while (
    i < a.length - prefixLen &&
    i < b.length - prefixLen &&
    a[a.length - 1 - i] === b[b.length - 1 - i]
  ) i++;
  return i;
}

/**
 * Perform a single replacement of searchText with value in the paragraph.
 * Does NOT loop — replaces only the first match found.
 * Used for nth-occurrence keys where the value may contain the searchText.
 */
function replaceInParagraphOnce(
  para: Element,
  searchText: string,
  value: string,
  replacementColor?: string,
): void {
  const runs = getRunElements(para);
  if (runs.length === 0) return;

  const rebuilt = buildCharMap(runs);
  const matchStart = rebuilt.fullText.indexOf(searchText);
  if (matchStart === -1) return;

  // Always use full replacement for single-shot mode
  const start = matchStart;
  const end = matchStart + searchText.length;

  const firstEntry = rebuilt.charMap[start];
  const lastEntry = rebuilt.charMap[end - 1];

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

function replaceInParagraph(
  para: Element,
  replacements: Record<string, string>,
  sortedKeys: string[],
  replacementColor?: string,
): void {
  const runs = getRunElements(para);
  if (runs.length === 0) return;

  const { fullText } = buildCharMap(runs);
  if (!sortedKeys.some((key) => fullText.includes(key))) return;

  for (const key of sortedKeys) {
    let rebuilt = buildCharMap(runs);
    let iterations = 0;
    while (rebuilt.fullText.includes(key)) {
      iterations++;
      if (iterations > MAX_REPLACEMENTS_PER_KEY) {
        throw new Error(
          `Patcher: exceeded ${MAX_REPLACEMENTS_PER_KEY} replacements for key "${key}" ` +
          `in a single paragraph. This usually means the replacement value contains ` +
          `the search key, creating an infinite loop.`
        );
      }

      const prevText = rebuilt.fullText;
      const matchStart = rebuilt.fullText.indexOf(key);
      const replacement = replacements[key];

      // Surgical replacement: compute common prefix/suffix between key and value
      // so we only modify the differing middle, preserving formatting on context text.
      const cpLen = commonPrefixLen(key, replacement);
      const csLen = commonSuffixLen(key, replacement, cpLen);

      let start: number;
      let end: number;
      let replText: string;

      if (cpLen + csLen >= key.length || cpLen + csLen >= replacement.length) {
        // No useful common prefix/suffix — full replacement (current behavior)
        start = matchStart;
        end = matchStart + key.length;
        replText = replacement;
      } else {
        // Surgical: only replace the differing middle
        start = matchStart + cpLen;
        end = matchStart + key.length - csLen;
        replText = replacement.slice(cpLen, replacement.length - csLen);
      }

      const firstEntry = rebuilt.charMap[start];
      const lastEntry = rebuilt.charMap[end - 1];

      if (firstEntry.runIndex === lastEntry.runIndex) {
        const runText = getRunText(runs[firstEntry.runIndex]);
        setRunText(
          runs[firstEntry.runIndex],
          runText.slice(0, firstEntry.charOffset) + replText + runText.slice(lastEntry.charOffset + 1)
        );
      } else {
        const firstRunText = getRunText(runs[firstEntry.runIndex]);
        setRunText(runs[firstEntry.runIndex], firstRunText.slice(0, firstEntry.charOffset) + replText);
        const lastRunText = getRunText(runs[lastEntry.runIndex]);
        setRunText(runs[lastEntry.runIndex], lastRunText.slice(lastEntry.charOffset + 1));
        for (let mid = firstEntry.runIndex + 1; mid < lastEntry.runIndex; mid++) {
          setRunText(runs[mid], '');
        }
      }

      if (replacementColor) {
        setRunColor(runs[firstEntry.runIndex], replacementColor);
      }

      rebuilt = buildCharMap(runs);

      // Progress guard: if text didn't change, we're stuck
      if (rebuilt.fullText === prevText) {
        throw new Error(
          `Patcher: no progress replacing key "${key}" — replacement value may contain the search key.`
        );
      }
    }
  }

  // Sweep: remove empty runs that are safe to remove (no drawings, fields, etc.)
  for (let i = runs.length - 1; i >= 0; i--) {
    if (getRunText(runs[i]) === '' && isRunSafeToRemove(runs[i])) {
      runs[i].parentNode?.removeChild(runs[i]);
    }
  }
}

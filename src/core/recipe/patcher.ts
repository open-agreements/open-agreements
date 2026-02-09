import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';

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
 * Processes all general OOXML text parts (document, headers, footers, endnotes).
 */
export async function patchDocument(
  inputPath: string,
  outputPath: string,
  replacements: Record<string, string>
): Promise<string> {
  const zip = new AdmZip(inputPath);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  if (partNames.length === 0) {
    throw new Error('No OOXML text parts found in DOCX');
  }

  // Sort keys longest-first to prevent partial matches
  const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);

  // Track which parts we modify so we can rebuild the zip cleanly
  const modifiedParts = new Map<string, Buffer>();

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc: Document = parser.parseFromString(xml, 'text/xml');

    // Process all paragraphs (body + tables)
    const allParagraphs = doc.getElementsByTagNameNS(W_NS, 'p');
    for (let i = 0; i < allParagraphs.length; i++) {
      replaceInParagraph(allParagraphs[i], replacements, sortedKeys);
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

function replaceInParagraph(
  para: Element,
  replacements: Record<string, string>,
  sortedKeys: string[]
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

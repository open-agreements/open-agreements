/**
 * Declarative option selection for DOCX templates.
 *
 * Handles radio-button `( )` and checkbox `[ ]` option groups in table cells.
 * A per-template `selections.json` config defines groups, and this module
 * deletes unselected options + their sub-clauses from the DOCX XML before filling.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import { getParagraphText, replaceParagraphTextRange, SafeDocxError } from '@usejunior/docx-core';
import { enumerateTextParts, getGeneralTextPartNames } from './recipe/ooxml-parts.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** Normalize smart quotes to ASCII equivalents for matching. */
function normalizeQuotes(text: string): string {
  return text
    .replace(/[\u2018\u2019\u2039\u203A]/g, "'")
    .replace(/[\u201C\u201D\u201A\u201E\u00AB\u00BB]/g, '"');
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const TriggerSchema = z.union([
  z.literal('default'),
  z.object({ field: z.string(), equals: z.union([z.string(), z.boolean()]) }),
  z.object({ field: z.string() }),
]);
type Trigger = z.infer<typeof TriggerSchema>;

const OptionSchema = z.object({
  marker: z.string(),
  trigger: TriggerSchema,
  replaceWith: z.string().optional(),
});

const GroupSchema = z
  .object({
    id: z.string(),
    type: z.enum(['radio', 'checkbox']),
    standalone: z.boolean().optional(),
    markerless: z.boolean().optional(),
    inline: z.boolean().optional(),
    cellContext: z.string().optional(),
    subClauseStopPatterns: z.array(z.string()).optional(),
    options: z.array(OptionSchema).min(1),
  })
  .refine(
    (g) => g.standalone === true || g.markerless === true || g.options.length >= 2,
    { message: 'Non-standalone/non-markerless groups require at least 2 options' },
  )
  .refine(
    (g) => {
      if (!g.subClauseStopPatterns) return true;
      for (const p of g.subClauseStopPatterns) {
        try { new RegExp(p, 'i'); } catch { return false; }
      }
      return true;
    },
    { message: 'subClauseStopPatterns must contain valid regular expressions' },
  )
  .refine(
    (g) => !g.inline || g.markerless === true,
    { message: 'inline: true requires markerless: true' },
  );

export const SelectionsConfigSchema = z.object({
  groups: z.array(GroupSchema).min(1),
});
export type SelectionsConfig = z.infer<typeof SelectionsConfigSchema>;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export function loadSelectionsConfig(path: string): SelectionsConfig {
  const raw = readFileSync(path, 'utf-8');
  return SelectionsConfigSchema.parse(JSON.parse(raw));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract paragraph text by concatenating all <w:t> elements. */
function extractParagraphText(para: Element): string {
  if (!para.getElementsByTagNameNS) return '';
  const tElements = para.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tElements.length; i++) {
    parts.push(tElements[i].textContent ?? '');
  }
  return parts.join('').trim();
}

/** Extract all text from a table cell by concatenating its paragraph texts. */
function extractCellText(cell: Element): string {
  const paras = cell.getElementsByTagNameNS(W_NS, 'p');
  const parts: string[] = [];
  for (let i = 0; i < paras.length; i++) {
    parts.push(extractParagraphText(paras[i]));
  }
  return parts.join(' ');
}

/** Check if a paragraph's text starts with a radio or checkbox marker. */
const MARKER_RE = /^\(\s*x?\s*\)|^\[\s*x?\s*\]|^[\u2610\u2611\u2612]/i;

function hasOptionPrefix(text: string): boolean {
  return MARKER_RE.test(text);
}

/** Update a paragraph's marker prefix to checked state. */
function setChecked(para: Element, type: 'radio' | 'checkbox'): void {
  const tElements = para.getElementsByTagNameNS(W_NS, 't');
  if (tElements.length === 0) return;

  // Reconstruct the full text from all <w:t> elements
  const fullText = extractParagraphText(para);
  if (!fullText) return;

  // Unicode ballot box: swap ☐/☒ → ☑
  if (/^[\u2610\u2612]/.test(fullText)) {
    for (let i = 0; i < tElements.length; i++) {
      const content = tElements[i].textContent ?? '';
      if (/[\u2610\u2612]/.test(content)) {
        tElements[i].textContent = content.replace(/[\u2610\u2612]/, '\u2611');
        return;
      }
    }
    return;
  }

  // Determine marker style from the paragraph text first. Some templates use
  // square-bracket markers ([ ]) with radio semantics.
  let openBracket = '[';
  let closeBracket = ']';
  if (/\(\s*[xX]?\s*\)/.test(fullText)) {
    openBracket = '(';
    closeBracket = ')';
  } else if (/\[\s*[xX]?\s*\]/.test(fullText)) {
    openBracket = '[';
    closeBracket = ']';
  } else if (type === 'radio') {
    openBracket = '(';
    closeBracket = ')';
  }

  const checkedPrefix = openBracket === '(' ? '( x )' : '[ x ]';

  // Walk through <w:t> elements to find and replace the marker
  let foundOpen = false;
  let foundClose = false;
  const tToBlank: Element[] = [];

  for (let i = 0; i < tElements.length; i++) {
    const t = tElements[i];
    const content = t.textContent ?? '';

    if (!foundOpen) {
      const openIdx = content.indexOf(openBracket);
      if (openIdx >= 0) {
        foundOpen = true;

        // Check if close bracket is in the same <w:t>
        const closeIdx = content.indexOf(closeBracket, openIdx + 1);
        if (closeIdx >= 0) {
          // Both brackets in same element — simple replacement
          const before = content.substring(0, openIdx);
          const after = content.substring(closeIdx + 1);
          t.textContent = before + checkedPrefix + after;
          foundClose = true;
          break;
        } else {
          // Open bracket found, close bracket in a later element
          t.textContent = content.substring(0, openIdx) + checkedPrefix;
        }
      }
    } else if (!foundClose) {
      const closeIdx = content.indexOf(closeBracket);
      if (closeIdx >= 0) {
        // Found the closing bracket — keep everything after it
        t.textContent = content.substring(closeIdx + 1);
        foundClose = true;
        break;
      } else {
        // Between open and close — blank out this text node
        tToBlank.push(t);
      }
    }
  }

  // Blank out intermediate text nodes (between open and close brackets)
  for (const t of tToBlank) {
    t.textContent = '';
  }
}

/** Evaluate a trigger against fill data. */
function triggerFires(trigger: Trigger, data: Record<string, unknown>): boolean {
  if (trigger === 'default') return false; // default never "fires" — it's the fallback

  if ('equals' in trigger) {
    const val = data[trigger.field];
    return val !== undefined && val !== '' && String(val) === String(trigger.equals);
  }

  // { field: "x" } — truthy check
  const val = data[trigger.field];
  return val !== undefined && val !== '' && val !== false && val !== 'false';
}

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Apply option selections to a DOCX buffer and return the modified buffer.
 *
 * For each group in the config:
 * 1. Find option paragraphs by marker text + radio/checkbox prefix
 * 2. Verify they share the same table cell
 * 3. Classify paragraphs as header, option, or sub-clause
 * 4. Evaluate triggers to determine selected options
 * 5. Remove unselected options + sub-clauses
 * 6. Mark selected options as checked
 */
export async function applySelections(
  inputPath: string,
  outputPath: string,
  config: SelectionsConfig,
  data: Record<string, unknown>,
): Promise<void> {
  const inputBuf = readFileSync(inputPath);
  const zip = new AdmZip(inputBuf);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc = parser.parseFromString(xml, 'text/xml');

    let partModified = false;
    for (const group of config.groups) {
      const result = processGroup(doc, group, data);
      if (result) partModified = true;
    }

    if (partModified) {
      const outXml = serializer.serializeToString(doc);
      zip.updateFile(partName, Buffer.from(outXml, 'utf-8'));
    }
  }

  // Rebuild zip from scratch (adm-zip data descriptor workaround)
  const outZip = new AdmZip();
  for (const entry of zip.getEntries()) {
    outZip.addFile(entry.entryName, entry.getData());
  }
  const outBuf = outZip.toBuffer();
  writeFileSync(outputPath, outBuf);
}

interface OptionMatch {
  para: Element;
  optionIndex: number;
}

/**
 * Process a single option group within a parsed XML document.
 * Returns true if any modifications were made.
 */
function processGroup(
  doc: Document,
  group: z.infer<typeof GroupSchema>,
  data: Record<string, unknown>,
): boolean {
  if (group.markerless) {
    return processMarkerlessGroup(doc, group, data);
  }

  if (group.standalone) {
    return processStandaloneGroup(doc, group, data);
  }

  // Step 1: Find ALL candidate paragraphs for each option's marker
  const allParagraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  const candidatesPerOption: OptionMatch[][] = group.options.map(() => []);

  for (let oi = 0; oi < group.options.length; oi++) {
    const option = group.options[oi];
    for (let pi = 0; pi < allParagraphs.length; pi++) {
      const para = allParagraphs[pi];
      const text = extractParagraphText(para);
      if (text && hasOptionPrefix(text) && text.includes(option.marker)) {
        candidatesPerOption[oi].push({ para, optionIndex: oi });
      }
    }
  }

  // Step 2: Find a cell where ALL options have at least one candidate
  // Group candidates by their parent cell
  const cellCandidates = new Map<Element, OptionMatch[]>();

  for (const candidates of candidatesPerOption) {
    for (const match of candidates) {
      const cell = findAncestor(match.para, 'tc');
      if (!cell) continue;
      if (!cellCandidates.has(cell)) cellCandidates.set(cell, []);
      cellCandidates.get(cell)!.push(match);
    }
  }

  // Collect all qualifying cells (where all options are represented)
  const qualifyingCells: { cell: Element; matches: OptionMatch[] }[] = [];

  for (const [candidateCell, matches] of cellCandidates) {
    const representedOptions = new Set(matches.map((m) => m.optionIndex));
    if (representedOptions.size >= 2 && representedOptions.size >= group.options.length) {
      const seen = new Set<number>();
      const deduped: OptionMatch[] = [];
      for (const match of matches) {
        if (!seen.has(match.optionIndex)) {
          seen.add(match.optionIndex);
          deduped.push(match);
        }
      }
      qualifyingCells.push({ cell: candidateCell, matches: deduped });
    }
  }

  if (qualifyingCells.length === 0) return false;

  let cell: Element;
  let optionMatches: OptionMatch[];

  if (qualifyingCells.length === 1) {
    cell = qualifyingCells[0].cell;
    optionMatches = qualifyingCells[0].matches;
  } else if (group.cellContext) {
    const filtered = qualifyingCells.filter(({ cell: c }) => {
      const cellText = extractCellText(c);
      return cellText.includes(group.cellContext!);
    });
    if (filtered.length === 1) {
      cell = filtered[0].cell;
      optionMatches = filtered[0].matches;
    } else if (filtered.length === 0) {
      throw new Error(
        `[selector] Group "${group.id}": cellContext "${group.cellContext}" did not match any of ${qualifyingCells.length} candidate cells.`,
      );
    } else {
      throw new Error(
        `[selector] Group "${group.id}": cellContext "${group.cellContext}" matched ${filtered.length} cells (expected 1). Use a more specific cellContext.`,
      );
    }
  } else {
    const snippets = qualifyingCells.map(({ cell: c }, i) => {
      const text = extractCellText(c);
      return `  Cell ${i + 1}: "${text.substring(0, 120)}..."`;
    });
    throw new Error(
      `[selector] Group "${group.id}": ${qualifyingCells.length} candidate cells with identical markers. ` +
      `Add "cellContext" to disambiguate.\nCandidates:\n${snippets.join('\n')}`,
    );
  }

  // Step 3: Collect all <w:p> in this cell and classify them
  const cellParas = cell.getElementsByTagNameNS(W_NS, 'p');

  // Build an ordered list of { para, ownerOptionIndex }
  // Header paragraphs (before first option) have ownerOptionIndex = -1
  interface ClassifiedPara {
    para: Element;
    ownerOptionIndex: number;
    isOption: boolean;
  }
  const classified: ClassifiedPara[] = [];
  let currentOwner = -1; // -1 = header

  for (let i = 0; i < cellParas.length; i++) {
    const p = cellParas[i];
    const match = optionMatches.find((m) => m.para === p);
    if (match) {
      currentOwner = match.optionIndex;
      classified.push({ para: p, ownerOptionIndex: currentOwner, isOption: true });
    } else {
      classified.push({ para: p, ownerOptionIndex: currentOwner, isOption: false });
    }
  }

  // Step 4: Evaluate triggers to determine selected options
  const selectedIndices = evaluateTriggers(group, data);

  // Step 5 & 6: Remove unselected options + sub-clauses, mark selected as checked
  let madeChanges = false;

  for (const item of classified) {
    if (item.ownerOptionIndex === -1) continue; // header — always keep

    if (selectedIndices.has(item.ownerOptionIndex)) {
      // Selected: mark the option paragraph as checked
      if (item.isOption) {
        setChecked(item.para, group.type);
        madeChanges = true;
      }
    } else {
      // Unselected: remove paragraph
      item.para.parentNode?.removeChild(item.para);
      madeChanges = true;
    }
  }

  // Ensure at least one <w:p> remains in the cell (OOXML requirement)
  const remainingParas = cell.getElementsByTagNameNS(W_NS, 'p');
  if (remainingParas.length === 0) {
    const newP = doc.createElementNS(W_NS, 'w:p');
    cell.appendChild(newP);
  }

  return madeChanges;
}

/**
 * Evaluate triggers against fill data and return the set of selected option indices.
 */
function evaluateTriggers(
  group: z.infer<typeof GroupSchema>,
  data: Record<string, unknown>,
): Set<number> {
  const selectedIndices = new Set<number>();

  if (group.type === 'radio') {
    // Radio: first trigger that fires wins; if none, use default
    let found = false;
    for (let i = 0; i < group.options.length; i++) {
      if (triggerFires(group.options[i].trigger, data)) {
        selectedIndices.add(i);
        found = true;
        break;
      }
    }
    if (!found) {
      const defaultIdx = group.options.findIndex((o) => o.trigger === 'default');
      if (defaultIdx >= 0) selectedIndices.add(defaultIdx);
    }
  } else {
    // Checkbox: select each option whose trigger fires
    for (let i = 0; i < group.options.length; i++) {
      if (group.options[i].trigger === 'default') continue;
      if (triggerFires(group.options[i].trigger, data)) {
        selectedIndices.add(i);
      }
    }
    // Handle defaults for checkbox
    if (selectedIndices.size === 0) {
      for (let i = 0; i < group.options.length; i++) {
        if (group.options[i].trigger === 'default') {
          selectedIndices.add(i);
        }
      }
    }
  }

  return selectedIndices;
}

/**
 * Process a standalone checkbox group where each option may be in a different
 * table cell. If trigger fires → mark checked; if not → remove the option
 * paragraph and any non-option sub-clause paragraphs that follow it in the
 * same cell.
 */
function processStandaloneGroup(
  doc: Document,
  group: z.infer<typeof GroupSchema>,
  data: Record<string, unknown>,
): boolean {
  const allParagraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  const selectedIndices = evaluateTriggers(group, data);
  let madeChanges = false;

  for (let oi = 0; oi < group.options.length; oi++) {
    const option = group.options[oi];

    // Find the marker paragraph
    let markerPara: Element | null = null;
    for (let pi = 0; pi < allParagraphs.length; pi++) {
      const para = allParagraphs[pi];
      const text = extractParagraphText(para);
      if (text && hasOptionPrefix(text) && text.includes(option.marker)) {
        markerPara = para;
        break;
      }
    }
    if (!markerPara) continue;

    if (selectedIndices.has(oi)) {
      setChecked(markerPara, group.type);
      madeChanges = true;
    } else {
      // Remove: marker paragraph + consecutive non-option sub-clauses in same cell
      const cell = findAncestor(markerPara, 'tc');
      if (cell) {
        const cellParas = cell.getElementsByTagNameNS(W_NS, 'p');
        // Find marker index within cell
        let markerIdx = -1;
        for (let ci = 0; ci < cellParas.length; ci++) {
          if (cellParas[ci] === markerPara) { markerIdx = ci; break; }
        }
        if (markerIdx >= 0) {
          // Collect sub-clause paragraphs after the marker (until next option or end)
          const toRemove: Element[] = [markerPara];
          for (let ci = markerIdx + 1; ci < cellParas.length; ci++) {
            const p = cellParas[ci];
            const text = extractParagraphText(p);
            if (text && hasOptionPrefix(text)) break; // next option — stop
            toRemove.push(p);
          }
          for (const p of toRemove) {
            p.parentNode?.removeChild(p);
          }
          // Ensure at least one <w:p> remains in cell
          const remaining = cell.getElementsByTagNameNS(W_NS, 'p');
          if (remaining.length === 0) {
            const newP = doc.createElementNS(W_NS, 'w:p');
            cell.appendChild(newP);
          }
        }
      } else {
        // No cell parent — just remove the paragraph
        markerPara.parentNode?.removeChild(markerPara);
      }
      madeChanges = true;
    }
  }

  return madeChanges;
}

/** Replace all <w:t> content in a paragraph with new text. First node gets the text, rest get empty string. */
function replaceParagraphText(para: Element, newText: string): void {
  const tElements = para.getElementsByTagNameNS(W_NS, 't');
  for (let i = 0; i < tElements.length; i++) {
    tElements[i].textContent = i === 0 ? newText : '';
  }
}

/**
 * Process a markerless group where option paragraphs are matched by content text
 * without requiring [ ] / ( ) prefix markers.
 *
 * When selected → keep paragraph as-is.
 * When unselected + replaceWith → replace paragraph text, remove sub-clause paragraphs.
 * When unselected + no replaceWith → remove paragraph + sub-clause paragraphs.
 */
function processMarkerlessGroup(
  doc: Document,
  group: z.infer<typeof GroupSchema>,
  data: Record<string, unknown>,
): boolean {
  const selectedIndices = evaluateTriggers(group, data);
  let madeChanges = false;

  for (let oi = 0; oi < group.options.length; oi++) {
    const option = group.options[oi];

    // Snapshot all paragraphs before mutating to avoid live NodeList issues
    const allParagraphs = doc.getElementsByTagNameNS(W_NS, 'p');
    const matchedParas: Element[] = [];
    const normalizedMarkerText = normalizeQuotes(option.marker);
    for (let pi = 0; pi < allParagraphs.length; pi++) {
      const para = allParagraphs[pi];
      const text = extractParagraphText(para);
      if (text && normalizeQuotes(text).includes(normalizedMarkerText)) {
        matchedParas.push(para);
      }
    }

    if (matchedParas.length === 0) continue;

    if (selectedIndices.has(oi)) {
      // Selected — keep paragraphs as-is, no changes needed
      continue;
    }

    // Unselected — inline mode: delete/replace marker text within the paragraph
    if (group.inline) {
      for (const markerPara of matchedParas) {
        const normalizedMarker = normalizeQuotes(option.marker);
        const replacement = option.replaceWith ?? '';
        const globalPara = markerPara as unknown as globalThis.Element;
        let text = normalizeQuotes(getParagraphText(globalPara));
        let safety = 0;
        while (safety++ < 50) {
          const idx = text.indexOf(normalizedMarker);
          if (idx === -1) break;
          try {
            replaceParagraphTextRange(globalPara, idx, idx + normalizedMarker.length, replacement);
            madeChanges = true;
          } catch (e) {
            if (e instanceof SafeDocxError) {
              // Fallback: formatting-destructive text splice via xmldom w:t elements
              const rawText = extractParagraphText(markerPara);
              const rawIdx = normalizeQuotes(rawText).indexOf(normalizedMarker);
              if (rawIdx !== -1) {
                const newText = rawText.slice(0, rawIdx) + replacement + rawText.slice(rawIdx + normalizedMarker.length);
                replaceParagraphText(markerPara, newText);
                madeChanges = true;
              }
            }
            break;
          }
          text = normalizeQuotes(getParagraphText(globalPara));
        }
      }
      continue;
    }

    // Unselected — process each matched paragraph (paragraph-level deletion)
    for (const markerPara of matchedParas) {
      const parent = markerPara.parentNode;
      if (!parent) continue;

      // Collect sub-clause paragraphs following the match
      const siblings: Element[] = [];
      const childNodes = parent.childNodes;
      let foundMarker = false;
      for (let ci = 0; ci < childNodes.length; ci++) {
        const node = childNodes[ci];
        if (node.nodeType !== 1) continue;
        const el = node as Element;
        if (el.localName !== 'p' || el.namespaceURI !== W_NS) continue;
        siblings.push(el);
      }

      const markerIdx = siblings.indexOf(markerPara);
      if (markerIdx < 0) continue;

      // Walk forward to collect sub-clause paragraphs
      const subClauses: Element[] = [];
      const customStopRe = group.subClauseStopPatterns?.length
        ? new RegExp(group.subClauseStopPatterns.map(p => `(?:${p})`).join('|'), 'i')
        : null;

      // Get marker paragraph's numbering level for level-aware stop
      const markerIlvl = getNumberingLevel(markerPara);

      for (let si = markerIdx + 1; si < siblings.length; si++) {
        const p = siblings[si];

        // Stop at auto-numbered paragraphs at same or higher level
        if (hasAutoNumbering(p, markerIlvl !== -1 ? markerIlvl : undefined)) break;

        const text = extractParagraphText(p);
        // Stop at next section heading or another option's marker
        if (text) {
          const isAnotherMarker = group.options.some((o) => text.includes(o.marker));
          // Stop at what looks like a section heading (e.g., "(c)", "1.3", "SECTION")
          const isSectionHeading = /^\(?[a-z]\)|^\d+\.\d+|^SECTION\b|^ARTICLE\b/i.test(text);
          const isCustomStop = customStopRe ? customStopRe.test(text) : false;
          if (isAnotherMarker || isSectionHeading || isCustomStop) break;
        }
        subClauses.push(p);
      }

      if (option.replaceWith !== undefined) {
        // Replace matched paragraph text, remove sub-clauses
        replaceParagraphText(markerPara, option.replaceWith);
        for (const p of subClauses) {
          p.parentNode?.removeChild(p);
        }
      } else {
        // Remove matched paragraph + sub-clauses
        markerPara.parentNode?.removeChild(markerPara);
        for (const p of subClauses) {
          p.parentNode?.removeChild(p);
        }
      }
      madeChanges = true;
    }
  }

  return madeChanges;
}

/** Check if a paragraph has Word auto-numbering at or above the given level. */
function hasAutoNumbering(para: Element, maxIlvl?: number): boolean {
  for (let i = 0; i < para.childNodes.length; i++) {
    const child = para.childNodes[i] as Element;
    if (child.nodeType !== 1) continue;
    if (child.localName === 'pPr' && child.namespaceURI === W_NS) {
      const numPrs = child.getElementsByTagNameNS(W_NS, 'numPr');
      if (numPrs.length === 0) return false;
      if (maxIlvl === undefined) return true;
      const ilvlEl = numPrs[0].getElementsByTagNameNS(W_NS, 'ilvl');
      if (ilvlEl.length === 0) return true; // no level = top-level
      const level = parseInt(ilvlEl[0].getAttribute('w:val') ?? '0', 10);
      return level <= maxIlvl;
    }
  }
  return false;
}

/** Get the numbering level (ilvl) of a paragraph, or -1 if not numbered. */
function getNumberingLevel(para: Element): number {
  for (let i = 0; i < para.childNodes.length; i++) {
    const child = para.childNodes[i] as Element;
    if (child.nodeType !== 1) continue;
    if (child.localName === 'pPr' && child.namespaceURI === W_NS) {
      const numPrs = child.getElementsByTagNameNS(W_NS, 'numPr');
      if (numPrs.length === 0) return -1;
      const ilvlEl = numPrs[0].getElementsByTagNameNS(W_NS, 'ilvl');
      return parseInt(ilvlEl[0]?.getAttribute('w:val') ?? '0', 10);
    }
  }
  return -1;
}

/** Walk up the DOM to find an ancestor with the given local name. */
function findAncestor(node: Element, localName: string): Element | null {
  let current: Node | null = node.parentNode;
  while (current) {
    if (current.nodeType === 1) {
      const element = current as Element;
      if (element.localName === localName && element.namespaceURI === W_NS) {
        return element;
      }
    }
    current = current.parentNode;
  }
  return null;
}

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
import { enumerateTextParts, getGeneralTextPartNames } from './recipe/ooxml-parts.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

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
});

const GroupSchema = z.object({
  id: z.string(),
  type: z.enum(['radio', 'checkbox']),
  options: z.array(OptionSchema).min(2),
});

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

/* eslint-disable @typescript-eslint/no-explicit-any --
   @xmldom/xmldom types are incompatible with global DOM types */

/** Extract paragraph text by concatenating all <w:t> elements. */
function extractParagraphText(para: any): string {
  if (!para.getElementsByTagNameNS) return '';
  const tElements = para.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tElements.length; i++) {
    parts.push(tElements[i].textContent ?? '');
  }
  return parts.join('').trim();
}

/** Check if a paragraph's text starts with a radio or checkbox marker. */
const MARKER_RE = /^\(\s*x?\s*\)|^\[\s*x?\s*\]|^[\u2610\u2611\u2612]/i;

function hasOptionPrefix(text: string): boolean {
  return MARKER_RE.test(text);
}

/** Update a paragraph's marker prefix to checked state. */
function setChecked(para: any, type: 'radio' | 'checkbox'): void {
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
  let firstT: any = null;
  const tToBlank: any[] = [];

  for (let i = 0; i < tElements.length; i++) {
    const t = tElements[i];
    const content = t.textContent ?? '';

    if (!foundOpen) {
      const openIdx = content.indexOf(openBracket);
      if (openIdx >= 0) {
        foundOpen = true;
        firstT = t;

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

  let modified = false;

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc = parser.parseFromString(xml, 'text/xml');

    for (const group of config.groups) {
      const result = processGroup(doc, group, data);
      if (result) modified = true;
    }

    if (modified) {
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
  para: any;
  optionIndex: number;
}

/**
 * Process a single option group within a parsed XML document.
 * Returns true if any modifications were made.
 */
function processGroup(
  doc: any,
  group: z.infer<typeof GroupSchema>,
  data: Record<string, unknown>,
): boolean {
  // Step 1: Find paragraphs matching each option's marker
  const allParagraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  const optionMatches: OptionMatch[] = [];

  for (let oi = 0; oi < group.options.length; oi++) {
    const option = group.options[oi];
    for (let pi = 0; pi < allParagraphs.length; pi++) {
      const para = allParagraphs[pi];
      const text = extractParagraphText(para);
      if (text && hasOptionPrefix(text) && text.includes(option.marker)) {
        optionMatches.push({ para, optionIndex: oi });
        break; // first match per option
      }
    }
  }

  // If we couldn't find all option markers, skip this group
  if (optionMatches.length < 2) return false;

  // Step 2: Verify all matched paragraphs share the same parent <w:tc>
  const cells = optionMatches.map((m) => findAncestor(m.para, 'tc'));
  const cell = cells[0];
  if (!cell || !cells.every((c) => c === cell)) return false;

  // Step 3: Collect all <w:p> in this cell and classify them
  const cellParas = cell.getElementsByTagNameNS(W_NS, 'p');
  const optionParaSet = new Set(optionMatches.map((m) => m.para));

  // Build an ordered list of { para, ownerOptionIndex }
  // Header paragraphs (before first option) have ownerOptionIndex = -1
  interface ClassifiedPara {
    para: any;
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
      // Find the default option
      const defaultIdx = group.options.findIndex((o) => o.trigger === 'default');
      if (defaultIdx >= 0) selectedIndices.add(defaultIdx);
    }
  } else {
    // Checkbox: select each option whose trigger fires
    for (let i = 0; i < group.options.length; i++) {
      if (group.options[i].trigger === 'default') {
        // Default for checkbox: selected if no other option fires
        // (evaluated after checking all others)
        continue;
      }
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

/** Walk up the DOM to find an ancestor with the given local name. */
function findAncestor(node: any, localName: string): any {
  let current = node.parentNode;
  while (current) {
    if (current.localName === localName && current.namespaceURI === W_NS) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

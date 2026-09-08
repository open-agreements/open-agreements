import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import { replaceParagraphTextRange } from '@usejunior/docx-core';
import { copyEntriesSkippingDirs, enumerateTextParts, getGeneralTextPartNames, preserveXmlSpace } from './ooxml-parts.js';
import { BLANK_PLACEHOLDER } from '../fill-utils.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface BracketNormalizationStats {
  unbracketedSegments: number;
  removedSegments: number;
  removedParagraphs: number;
  normalizedParagraphs: number;
  formattingFallbackCount: number;
  declarativeRuleApplications: number;
  declarativeRuleMatchCounts: Record<string, number>;
  declarativeRuleMutationCounts: Record<string, number>;
  declarativeRuleExpectationFailures: string[];
  declarativeRuleExamples: Array<{
    rule_id: string;
    heading: string;
    before: string;
    after: string;
  }>;
}

export interface DeclarativeParagraphNormalizeRule {
  id: string;
  section_heading: string;
  section_heading_any?: string[];
  ignore_heading?: boolean;
  paragraph_contains: string;
  paragraph_end_contains?: string;
  replacements?: Record<string, string>;
  trim_unmatched_trailing_bracket?: boolean;
  expected_min_matches?: number;
  expected_max_matches?: number;
}

export interface DeclarativeNormalizeConfig {
  paragraph_rules: DeclarativeParagraphNormalizeRule[];
}

export interface BracketNormalizationOptions {
  rules?: DeclarativeParagraphNormalizeRule[];
  fieldValues?: Record<string, unknown>;
  blankPlaceholder?: string;
}

/**
 * Normalize residual bracket artifacts in generated fieldSelector documents.
 *
 * Only operates when declarative rules are provided (via normalize.json).
 * Without declarative rules, returns zero-change stats (no-op).
 * Uses formatting-preserving replaceParagraphTextRange for all text mutations.
 */
export async function normalizeBracketArtifacts(
  inputPath: string,
  outputPath: string,
  options?: BracketNormalizationOptions
): Promise<BracketNormalizationStats> {
  const zip = new AdmZip(inputPath);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  const stats: BracketNormalizationStats = {
    unbracketedSegments: 0,
    removedSegments: 0,
    removedParagraphs: 0,
    normalizedParagraphs: 0,
    formattingFallbackCount: 0,
    declarativeRuleApplications: 0,
    declarativeRuleMatchCounts: {},
    declarativeRuleMutationCounts: {},
    declarativeRuleExpectationFailures: [],
    declarativeRuleExamples: [],
  };
  const rules = options?.rules ?? [];
  const fieldValues = options?.fieldValues ?? {};
  const blankPlaceholder = options?.blankPlaceholder ?? BLANK_PLACEHOLDER;
  const hasDeclarativeRules = rules.length > 0;

  // No declarative rules → no-op. Brackets remain visible for lawyers.
  if (!hasDeclarativeRules) {
    const outZip = new AdmZip();
    copyEntriesSkippingDirs(zip, outZip);
    writeFileSync(outputPath, outZip.toBuffer());
    return stats;
  }

  for (const rule of rules) {
    if (!(rule.id in stats.declarativeRuleMatchCounts)) {
      stats.declarativeRuleMatchCounts[rule.id] = 0;
      stats.declarativeRuleMutationCounts[rule.id] = 0;
    }
  }

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc: Document = parser.parseFromString(xml, 'text/xml');
    const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');
    let lastHeading = '';

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      const original = extractParagraphText(para);
      if (!original.trim()) continue;

      const trimmedOriginal = original.trim();
      if (isHeadingLike(trimmedOriginal)) {
        lastHeading = trimmedOriginal;
      }

      const declarativeResult = applyDeclarativeRulesToParagraph({
        text: original,
        heading: lastHeading,
        rules,
        fieldValues,
        blankPlaceholder,
      });
      if (declarativeResult.applied) {
        stats.declarativeRuleApplications += 1;
      }
      if (declarativeResult.rule_id) {
        const ruleId = declarativeResult.rule_id;
        stats.declarativeRuleMatchCounts[ruleId] =
          (stats.declarativeRuleMatchCounts[ruleId] ?? 0) + 1;
        if (declarativeResult.text !== original) {
          stats.declarativeRuleMutationCounts[ruleId] =
            (stats.declarativeRuleMutationCounts[ruleId] ?? 0) + 1;
        }
        const existingExamples = stats.declarativeRuleExamples.filter(
          (example) => example.rule_id === ruleId
        ).length;
        if (existingExamples < 2) {
          stats.declarativeRuleExamples.push({
            rule_id: ruleId,
            heading: lastHeading,
            before: original,
            after: declarativeResult.text,
          });
        }
      }

      let finalText = declarativeResult.text;
      // Sanitize double-dollar artifacts ($$ or $ $) → single $
      finalText = finalText.replace(/\$[\s\u00A0\t]*\$/g, '$');
      if (finalText !== original) {
        try {
          const replacement = applyEditHunks(para, original, finalText);
          para.parentNode!.replaceChild(replacement, para);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`Normalization refused in ${partName}, paragraph ${i}: ${reason}`);
        }
        stats.normalizedParagraphs += 1;
      }
    }

    zip.updateFile(partName, Buffer.from(serializer.serializeToString(doc), 'utf-8'));
  }

  for (const rule of rules) {
    const actualMatches = stats.declarativeRuleMatchCounts[rule.id] ?? 0;
    if (rule.expected_min_matches !== undefined && actualMatches < rule.expected_min_matches) {
      stats.declarativeRuleExpectationFailures.push(
        `${rule.id}: expected at least ${rule.expected_min_matches} match(es), found ${actualMatches}`
      );
    }
    if (rule.expected_max_matches !== undefined && actualMatches > rule.expected_max_matches) {
      stats.declarativeRuleExpectationFailures.push(
        `${rule.id}: expected at most ${rule.expected_max_matches} match(es), found ${actualMatches}`
      );
    }
  }

  const outZip = new AdmZip();
  copyEntriesSkippingDirs(zip, outZip);
  writeFileSync(outputPath, outZip.toBuffer());

  return stats;
}

/** A single disjoint edit: replace oldText[start, end) with `replacement`. */
export interface EditHunk {
  start: number;
  end: number;
  replacement: string;
}

function codePoints(text: string): { points: string[]; offsets: number[] } {
  const points = Array.from(text), offsets = [0];
  for (const point of points) {
    const code = point.charCodeAt(0);
    if (point.length === 1 && code >= 0xD800 && code <= 0xDFFF) throw new Error('Unpaired surrogate in normalization text');
    offsets.push(offsets[offsets.length - 1] + point.length);
  }
  return { points, offsets };
}

/**
 * Return exact deletion hunks when `newText` is a subsequence of `oldText`.
 * The leftmost embedding is deterministic and, unlike a wide replacement,
 * never crosses text that survives the transformation (including REF field
 * results). The caller still verifies the reconstructed text before mutation.
 */
export function computeDeletionHunks(
  oldText: string,
  newText: string,
  offset = 0,
): EditHunk[] | null {
  if (newText.length >= oldText.length) return null;
  const old = codePoints(oldText), next = codePoints(newText);
  const left: number[] = [];
  let oldIndex = 0;
  for (const char of next.points) {
    const found = old.points.indexOf(char, oldIndex);
    if (found < 0) return null;
    left.push(found);
    oldIndex = found + 1;
  }

  const retained = new Set(left);
  const hunks: EditHunk[] = [];
  let start = -1;
  for (let i = 0; i <= old.points.length; i++) {
    if (i < old.points.length && !retained.has(i)) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      hunks.push({ start: offset + old.offsets[start], end: offset + old.offsets[i], replacement: '' });
      start = -1;
    }
  }
  return hunks;
}

// At most 16 MB of alignment cells per changed paragraph. Larger ambiguous
// transformations fail visibly rather than falling back to a wide style rewrite.
const MAX_ALIGNMENT_CELLS = 4_000_000;

/**
 * Compute DISJOINT edit hunks turning `oldText` into `newText`, in ascending
 * `start` order. Exact codepoint LCS retains even one-character interior anchors;
 * returned offsets remain UTF-16 offsets for the DOCX mutation API. Ties prefer
 * deletion, making repeated-text alignment deterministic.
 */
export function computeEditHunks(
  oldText: string,
  newText: string,
  offset = 0,
): EditHunk[] {
  const old = codePoints(oldText), next = codePoints(newText);
  const deletionHunks = computeDeletionHunks(oldText, newText, offset);
  if (deletionHunks) return deletionHunks;
  let start = 0;
  while (start < Math.min(old.points.length, next.points.length) && old.points[start] === next.points[start]) start++;
  let oldEnd = old.points.length, newEnd = next.points.length;
  while (oldEnd > start && newEnd > start && old.points[oldEnd - 1] === next.points[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  if (oldEnd === start && newEnd === start) return [];

  const a = old.points.slice(start, oldEnd), b = next.points.slice(start, newEnd);
  if (!a.length || !b.length) return [{start: offset + old.offsets[start], end: offset + old.offsets[oldEnd], replacement: b.join('')}];
  const width = b.length + 1, cells = (a.length + 1) * width;
  if (cells > MAX_ALIGNMENT_CELLS) throw new Error(`Exact normalization alignment budget exceeded (${cells} cells)`);
  const lengths = new Uint32Array(cells);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * width + j] = a[i] === b[j] ? 1 + lengths[(i + 1) * width + j + 1]
        : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }
  const hunks: EditHunk[] = [];
  let i = 0, j = 0, current: EditHunk | undefined;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      if (current) hunks.push(current);
      current = undefined; i++; j++;
    } else {
      current ??= {start: offset + old.offsets[start + i], end: offset + old.offsets[start + i], replacement: ''};
      if (i < a.length && (j === b.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
        current.end = offset + old.offsets[start + ++i];
      } else current.replacement += b[j++];
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

/**
 * Apply the disjoint hunks turning `original` into `finalText` to a paragraph,
 * highest-offset-first so earlier offsets stay valid as text length changes.
 * Stage all edits on a clone. Never commit a partly-mutated paragraph or flatten
 * formatting when a field/container boundary is unsupported.
 */
function applyEditHunks(para: Element, original: string, finalText: string): Element {
  const hunks = computeEditHunks(original, finalText);
  let replay = original;
  for (const hunk of hunks.slice().reverse()) replay = replay.slice(0, hunk.start) + hunk.replacement + replay.slice(hunk.end);
  if (replay !== finalText) throw new Error('Exact normalization replay mismatch');
  let staged = para.cloneNode(true) as Element;
  for (let i = hunks.length - 1; i >= 0; i--) {
    const hunk = hunks[i];
    if (replaceRangeInSingleSafeTextNode(staged, hunk)) continue;
    const attempt = staged.cloneNode(true) as Element;
    try {
      replaceParagraphTextRange(
        attempt as unknown as globalThis.Element,
        hunk.start,
        hunk.end,
        hunk.replacement,
      );
      staged = attempt;
    } catch {
      throw new Error('Unsupported normalization field or container boundary');
    }
  }
  if (extractParagraphText(staged) !== finalText) throw new Error('Normalized paragraph text does not match planned output');
  return staged;
}

/**
 * Preserve the existing run for a range wholly contained in one ordinary w:t node.
 * Safe-docx intentionally rejects a boundary that it maps to the preceding
 * field-result run; direct mutation is nevertheless safe when the requested
 * characters are demonstrably in the following non-field text node. This
 * preserves the run, its rPr, and all REF field machinery.
 */
function replaceRangeInSingleSafeTextNode(para: Element, hunk: EditHunk): boolean {
  if (hunk.end <= hunk.start) return false;
  const textNodes: Array<{ node: Element; start: number; end: number; unsafe: boolean; fieldResult: boolean }> = [];
  let visibleOffset = 0;
  const fieldPhases: Array<'instruction' | 'result'> = [];

  const visit = (node: Node, unsafeAncestor = false): void => {
    if (node.nodeType !== 1) return;
    const element = node as unknown as Element;
    const unsafe = unsafeAncestor || (element.namespaceURI === W_NS &&
      ['fldSimple', 'ins', 'del', 'moveFrom', 'moveTo'].includes(element.localName ?? ''));
    if (element.namespaceURI === W_NS && element.localName === 'fldChar') {
      const type = element.getAttributeNS(W_NS, 'fldCharType') || element.getAttribute('w:fldCharType');
      if (type === 'begin') fieldPhases.push('instruction');
      else if (type === 'separate' && fieldPhases.length > 0) fieldPhases[fieldPhases.length - 1] = 'result';
      else if (type === 'end') fieldPhases.pop();
      return;
    }
    if (element.namespaceURI === W_NS && element.localName === 't') {
      if (fieldPhases.at(-1) === 'instruction') return;
      const text = element.textContent ?? '';
      textNodes.push({
        node: element,
        start: visibleOffset,
        end: visibleOffset + text.length,
        unsafe,
        fieldResult: fieldPhases.length > 0,
      });
      visibleOffset += text.length;
      return;
    }
    for (let child = element.firstChild; child; child = child.nextSibling) visit(child, unsafe);
  };
  visit(para as unknown as Node);

  const target = textNodes.find(({ start, end }) => hunk.start >= start && hunk.end <= end);
  if (target?.unsafe) throw new Error('Unsupported normalization simple field or revision ancestry');
  if (!target || target.fieldResult) return false;
  const text = target.node.textContent ?? '';
  const localStart = hunk.start - target.start;
  const localEnd = hunk.end - target.start;
  target.node.textContent = text.slice(0, localStart) + hunk.replacement + text.slice(localEnd);
  if ((target.node.textContent ?? '').startsWith(' ') || (target.node.textContent ?? '').endsWith(' ')) {
    preserveXmlSpace(target.node);
  }
  return true;
}

function isHeadingLike(text: string): boolean {
  return !text.startsWith('.') && !text.includes('[') && text.replaceAll('.', '').trim().length > 0;
}

function applyDeclarativeRulesToParagraph(params: {
  text: string;
  heading: string;
  rules: DeclarativeParagraphNormalizeRule[];
  fieldValues: Record<string, unknown>;
  blankPlaceholder: string;
}): { text: string; applied: boolean; rule_id?: string } {
  const { text, heading, rules, fieldValues, blankPlaceholder } = params;
  let mutated = text;
  let matchedRule = false;
  let matchedRuleId: string | undefined;

  for (const rule of rules) {
    if (!matchesHeading(rule, heading)) continue;
    if (!mutated.includes(rule.paragraph_contains)) continue;
    if (rule.paragraph_end_contains && !mutated.includes(rule.paragraph_end_contains)) continue;
    matchedRule = true;
    matchedRuleId = rule.id;

    for (const [token, template] of Object.entries(rule.replacements ?? {})) {
      const resolved = resolveTemplateValue(template, fieldValues, blankPlaceholder);
      mutated = mutated.split(token).join(resolved);
    }

    if (rule.trim_unmatched_trailing_bracket) {
      const openCount = (mutated.match(/\[/g) ?? []).length;
      const closeCount = (mutated.match(/\]/g) ?? []).length;
      if (closeCount > openCount) {
        mutated = mutated.replace(/\]+$/g, '');
      }
    }

    mutated = mutated
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+\./g, '.')
      .replace(/^\.\s*\.\s*/, '. ')
      .trim();

    break;
  }

  // Lightweight fallback cleanup for declarative mode:
  // 1) Preserve bracket-prefixed heading labels by removing only leading '['.
  // 2) Trim unmatched trailing ']' artifacts that remain after option pruning.
  mutated = normalizeBracketPrefixedHeading(mutated);
  mutated = trimUnmatchedTrailingBrackets(mutated);

  return { text: mutated, applied: matchedRule || mutated !== text, rule_id: matchedRuleId };
}

function matchesHeading(rule: DeclarativeParagraphNormalizeRule, heading: string): boolean {
  if (rule.ignore_heading) return true;
  if (heading.includes(rule.section_heading)) return true;
  for (const alias of rule.section_heading_any ?? []) {
    if (heading.includes(alias)) return true;
  }
  return false;
}

function resolveTemplateValue(
  template: string,
  fieldValues: Record<string, unknown>,
  blankPlaceholder: string
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_full, key: string) => {
    const value = fieldValues[key];
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string' && value.trim().length > 0) return value;
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string') && value.length > 0) {
      return value.join(', ');
    }
    return blankPlaceholder;
  });
}

function normalizeBracketPrefixedHeading(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[')) return text;
  if (trimmed.includes(']')) return text;
  if (trimmed.length > 90) return text;
  if (trimmed.includes('_')) return text;
  if (/[.:;!?].+[.:;!?]/.test(trimmed)) return text;
  if (!/^\[[A-Z][A-Za-z0-9 ,&()''/.-]+$/.test(trimmed)) return text;
  return trimmed.slice(1).trim();
}

function trimUnmatchedTrailingBrackets(text: string): string {
  let out = text;
  const openCount = (out.match(/\[/g) ?? []).length;
  let closeCount = (out.match(/\]/g) ?? []).length;
  while (closeCount > openCount && /\]\s*$/.test(out)) {
    out = out.replace(/\]\s*$/, '').trimEnd();
    closeCount -= 1;
  }
  return out;
}

function extractParagraphText(para: Element): string {
  const tElements = para.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tElements.length; i++) {
    parts.push(tElements[i].textContent ?? '');
  }
  return parts.join('');
}

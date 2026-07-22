import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';
import { replaceParagraphTextRange } from '@usejunior/docx-core';
import { copyEntriesSkippingDirs, enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';
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
        const range = computeReplacementRange(original, finalText);
        if (range) {
          try {
            replaceParagraphTextRange(
              para as unknown as globalThis.Element,
              range.start,
              range.end,
              range.replacement,
            );
          } catch {
            // The minimal CONTIGUOUS range can span nearly the whole paragraph
            // when independent edits touch both ends (e.g. a leading ". " strip
            // plus a trailing "]" trim), and such a wide range may intersect a
            // Word field result that replaceParagraphTextRange refuses to edit.
            // Before destroying formatting, split the diff into disjoint hunks
            // (anchored on common substrings) and apply them individually —
            // each small hunk typically avoids the field result entirely.
            if (!applyEditHunks(para, original, finalText)) {
              // Last resort for paragraphs whose individual hunks still cross
              // complex structures. Set text directly on <w:t> elements —
              // less formatting-safe but better than skipping the replacement.
              setParagraphTextFallback(para, finalText);
              stats.formattingFallbackCount += 1;
            }
          }
        }
        stats.normalizedParagraphs += 1;
      }
    }

    zip.updateFile(partName, Buffer.from(serializer.serializeToString(doc), 'utf-8'));
  }

  for (const rule of rules) {
    if (rule.expected_min_matches === undefined) continue;
    const actualMatches = stats.declarativeRuleMatchCounts[rule.id] ?? 0;
    if (actualMatches < rule.expected_min_matches) {
      stats.declarativeRuleExpectationFailures.push(
        `${rule.id}: expected at least ${rule.expected_min_matches} match(es), found ${actualMatches}`
      );
    }
  }

  if (stats.formattingFallbackCount > 0) {
    console.warn(
      `Warning: ${stats.formattingFallbackCount} paragraph(s) used formatting-destructive fallback during normalization`
    );
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

/** Minimum anchor length for hunk splitting — short anchors over-fragment. */
const MIN_HUNK_ANCHOR_LENGTH = 12;
/** Recursion cap for hunk splitting (2^6 = 64 hunks is far beyond real use). */
const MAX_HUNK_DEPTH = 6;

/**
 * Deterministic longest common substring of `a` and `b` (first occurrence wins
 * on ties). Classic O(|a|·|b|) dynamic program over a single reused row — only
 * invoked on the rare fallback path, for one paragraph at a time.
 */
function longestCommonSubstring(
  a: string,
  b: string,
): { aIndex: number; bIndex: number; length: number } | null {
  if (a.length === 0 || b.length === 0) return null;
  let best = { aIndex: 0, bIndex: 0, length: 0 };
  const prev = new Int32Array(b.length + 1);
  const curr = new Int32Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > best.length) {
          best = { aIndex: i - curr[j], bIndex: j - curr[j], length: curr[j] };
        }
      } else {
        curr[j] = 0;
      }
    }
    prev.set(curr);
  }
  return best.length > 0 ? best : null;
}

/**
 * Compute DISJOINT edit hunks turning `oldText` into `newText`, in ascending
 * `start` order. Trims the common prefix/suffix, then recursively splits the
 * differing middle on its longest common substring (when long enough to be an
 * unambiguous anchor). Deterministic by construction; degrades to the single
 * minimal contiguous range when no adequate anchor exists.
 */
export function computeEditHunks(
  oldText: string,
  newText: string,
  offset = 0,
  depth = 0,
): EditHunk[] {
  let start = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (start < minLen && oldText[start] === newText[start]) start++;
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  if (oldEnd === start && newEnd === start) return [];

  const oldMid = oldText.slice(start, oldEnd);
  const newMid = newText.slice(start, newEnd);

  if (depth < MAX_HUNK_DEPTH) {
    const anchor = longestCommonSubstring(oldMid, newMid);
    if (anchor && anchor.length >= MIN_HUNK_ANCHOR_LENGTH) {
      const left = computeEditHunks(
        oldMid.slice(0, anchor.aIndex),
        newMid.slice(0, anchor.bIndex),
        offset + start,
        depth + 1,
      );
      const right = computeEditHunks(
        oldMid.slice(anchor.aIndex + anchor.length),
        newMid.slice(anchor.bIndex + anchor.length),
        offset + start + anchor.aIndex + anchor.length,
        depth + 1,
      );
      return [...left, ...right];
    }
  }

  return [{ start: offset + start, end: offset + oldEnd, replacement: newMid }];
}

/**
 * Apply the disjoint hunks turning `original` into `finalText` to a paragraph,
 * highest-offset-first so earlier offsets stay valid as text length changes.
 * Returns true when EVERY hunk applied formatting-preservingly; false when any
 * hunk failed (the caller then falls back destructively — setParagraphTextFallback
 * overwrites the full text, so a partial application is safely superseded).
 */
function applyEditHunks(para: Element, original: string, finalText: string): boolean {
  const hunks = computeEditHunks(original, finalText);
  // A single hunk is exactly the contiguous range that already failed.
  if (hunks.length <= 1) return false;
  for (let i = hunks.length - 1; i >= 0; i--) {
    const hunk = hunks[i];
    try {
      replaceParagraphTextRange(
        para as unknown as globalThis.Element,
        hunk.start,
        hunk.end,
        hunk.replacement,
      );
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Compute the minimal contiguous replacement range between two strings.
 * Returns null if the strings are identical.
 */
function computeReplacementRange(
  oldText: string,
  newText: string
): { start: number; end: number; replacement: string } | null {
  if (oldText === newText) return null;
  let start = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (start < minLen && oldText[start] === newText[start]) start++;
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { start, end: oldEnd, replacement: newText.slice(start, newEnd) };
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
      .replace(/^\.\s*/, '')
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

/**
 * Fallback for paragraphs where replaceParagraphTextRange cannot operate
 * (e.g., field results spanning across runs). Sets text on the first <w:t>
 * element and clears the rest. Less formatting-safe than replaceParagraphTextRange
 * but avoids throwing.
 */
function setParagraphTextFallback(para: Element, text: string): void {
  const tElements = para.getElementsByTagNameNS(W_NS, 't');
  if (tElements.length === 0) return;
  tElements[0].textContent = text;
  if (text.startsWith(' ') || text.endsWith(' ')) {
    tElements[0].setAttribute('xml:space', 'preserve');
  }
  for (let i = 1; i < tElements.length; i++) {
    tElements[i].textContent = '';
  }
}

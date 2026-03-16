import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';
import { replaceParagraphTextRange } from '@usejunior/docx-core';
import { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';
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
  fieldValues?: Record<string, string | boolean>;
  blankPlaceholder?: string;
}

/**
 * Normalize residual bracket artifacts in generated recipe documents.
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
    for (const entry of zip.getEntries()) {
      outZip.addFile(entry.entryName, entry.getData());
    }
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
            // Fallback for paragraphs with field results or other complex
            // structures that replaceParagraphTextRange cannot handle.
            // Set text directly on <w:t> elements — less formatting-safe
            // but better than skipping the replacement entirely.
            setParagraphTextFallback(para, finalText);
            stats.formattingFallbackCount += 1;
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
  for (const entry of zip.getEntries()) {
    outZip.addFile(entry.entryName, entry.getData());
  }
  writeFileSync(outputPath, outZip.toBuffer());

  return stats;
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
  fieldValues: Record<string, string | boolean>;
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
  fieldValues: Record<string, string | boolean>,
  blankPlaceholder: string
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_full, key: string) => {
    const value = fieldValues[key];
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string' && value.trim().length > 0) return value;
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

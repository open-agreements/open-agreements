import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';
import { BLANK_PLACEHOLDER } from '../fill-utils.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

interface Segment {
  start: number;
  end: number;
  raw: string;
  inner: string;
}

export interface BracketNormalizationStats {
  unbracketedSegments: number;
  removedSegments: number;
  removedParagraphs: number;
  normalizedParagraphs: number;
  declarativeRuleApplications: number;
}

export interface DeclarativeParagraphNormalizeRule {
  id: string;
  section_heading: string;
  section_heading_any?: string[];
  ignore_heading?: boolean;
  paragraph_contains: string;
  replacements?: Record<string, string>;
  trim_unmatched_trailing_bracket?: boolean;
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
 * Strategy:
 * - Unbracket simple single-level clauses (`[text]` -> `text`)
 * - Remove complex/nested segments with unresolved placeholders
 * - Remove orphan bracket characters and punctuation artifacts
 * - Drop paragraphs that collapse to punctuation-only content
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
    declarativeRuleApplications: 0,
  };
  const rules = options?.rules ?? [];
  const fieldValues = options?.fieldValues ?? {};
  const blankPlaceholder = options?.blankPlaceholder ?? BLANK_PLACEHOLDER;

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc = parser.parseFromString(xml, 'text/xml');
    const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');
    const toRemove: any[] = [];
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

      const normalized = normalizeParagraphText(declarativeResult.text, stats);
      if (normalized === null) {
        toRemove.push(para);
        stats.removedParagraphs += 1;
        continue;
      }

      if (normalized !== original) {
        setParagraphText(para, normalized);
        stats.normalizedParagraphs += 1;
      }
    }

    for (const para of toRemove) {
      para.parentNode?.removeChild(para);
    }

    zip.updateFile(partName, Buffer.from(serializer.serializeToString(doc), 'utf-8'));
  }

  const outZip = new AdmZip();
  for (const entry of zip.getEntries()) {
    outZip.addFile(entry.entryName, entry.getData());
  }
  writeFileSync(outputPath, outZip.toBuffer());

  return stats;
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
}): { text: string; applied: boolean } {
  const { text, heading, rules, fieldValues, blankPlaceholder } = params;
  for (const rule of rules) {
    if (!matchesHeading(rule, heading)) continue;
    if (!text.includes(rule.paragraph_contains)) continue;

    let mutated = text;
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

    return { text: mutated, applied: mutated !== text };
  }

  return { text, applied: false };
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

function normalizeParagraphText(text: string, stats: BracketNormalizationStats): string | null {
  let out = text;

  // First pass: handle complete same-paragraph bracket segments.
  const segments = extractTopLevelSegments(out);
  if (segments.length > 0) {
    const ordered = [...segments].sort((a, b) => b.start - a.start);
    for (const seg of ordered) {
      const replacement = shouldRemoveSegment(seg.inner) ? '' : seg.inner.trim();
      out = `${out.slice(0, seg.start)}${replacement}${out.slice(seg.end + 1)}`;
      if (replacement === '') {
        stats.removedSegments += 1;
      } else {
        stats.unbracketedSegments += 1;
      }
    }
  }

  // Second pass: remove orphan bracket chars from cross-paragraph constructs.
  out = out.replaceAll('[', '').replaceAll(']', '');

  // Punctuation/spacing normalization for artifacts created by bracket deletion.
  out = out
    .replace(/^\s*[.;:,]\s*/, '')
    .replace(/\s+,/g, ',')
    .replace(/\s+;/g, ';')
    .replace(/\s+\./g, '.')
    .replace(/\bfrom,\s+counsel\b/gi, 'from counsel')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Prefer a single deterministic costs clause when both alternatives are present.
  if (
    out.includes('If any action at law or in equity') &&
    out.includes('Each party will bear its own costs in respect of any disputes arising under this Agreement.')
  ) {
    out = 'Each party will bear its own costs in respect of any disputes arising under this Agreement.';
  }

  // Drop known degenerate artifacts produced when optional bracket blocks are stripped.
  if (/^A minimum of\s+Shares must be sold at the Initial Closing\.?$/i.test(out)) {
    return null;
  }
  if (
    /^As of the Initial Closing, the authorized size of the Board of Directors shall be, and the Board of Directors shall be comprised of\.?$/i.test(
      out
    )
  ) {
    return null;
  }

  // Drop degenerate paragraphs that are now effectively empty.
  if (!out || /^[.,;:]+$/.test(out)) {
    return null;
  }

  return out;
}

function shouldRemoveSegment(inner: string): boolean {
  const normalized = inner.trim();
  if (!normalized) return true;

  // Nested bracket segments are usually unresolved alternatives; drop them.
  if (normalized.includes('[') || normalized.includes(']')) return true;

  // Placeholder blanks and underscore markers should be removed.
  if (normalized.includes('_')) return true;

  // Known placeholder-only tokens.
  if (/^(date|specify|state|initial|applicable|audited|unaudited)$/i.test(normalized)) return true;
  if (/^\(?[ivx]+\)?$/i.test(normalized)) return true;
  if (/^\d+$/.test(normalized)) return true;

  return false;
}

function extractTopLevelSegments(text: string): Segment[] {
  const out: Segment[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === ']') {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start !== -1) {
        const raw = text.slice(start, i + 1);
        out.push({ start, end: i, raw, inner: raw.slice(1, -1) });
        start = -1;
      }
    }
  }

  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any --
   @xmldom/xmldom node typing is incompatible with DOM lib types. */
function extractParagraphText(para: any): string {
  const tElements = para.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tElements.length; i++) {
    parts.push(tElements[i].textContent ?? '');
  }
  return parts.join('');
}

function setParagraphText(para: any, text: string): void {
  const doc = para.ownerDocument;
  const tElements = para.getElementsByTagNameNS(W_NS, 't');

  if (tElements.length === 0) {
    const run = doc.createElementNS(W_NS, 'w:r');
    const t = doc.createElementNS(W_NS, 'w:t');
    t.textContent = text;
    run.appendChild(t);
    para.appendChild(run);
    return;
  }

  // Preserve existing run-level formatting by distributing normalized text
  // across current text nodes using original node-length quotas.
  const originalLengths: number[] = [];
  for (let i = 0; i < tElements.length; i++) {
    originalLengths.push((tElements[i].textContent ?? '').length);
  }

  let cursor = 0;
  const total = text.length;

  for (let i = 0; i < tElements.length; i++) {
    const quota = i === tElements.length - 1
      ? total - cursor
      : Math.min(originalLengths[i], Math.max(0, total - cursor));
    if (quota > 0) {
      tElements[i].textContent = text.slice(cursor, cursor + quota);
      cursor += quota;
    } else {
      tElements[i].textContent = '';
    }
  }

  // If the paragraph grew beyond original capacity, append the tail to
  // the last node to avoid creating new runs and style surprises.
  if (cursor < total) {
    const last = tElements[tElements.length - 1];
    last.textContent = (last.textContent ?? '') + text.slice(cursor);
  }
}

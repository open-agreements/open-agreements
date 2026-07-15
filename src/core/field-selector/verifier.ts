import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Element } from '@xmldom/xmldom';
import { getParagraphText } from '@usejunior/docx-core';
import type { VerifyResult, VerifyCheck } from './types.js';
import type { CleanConfig } from '../metadata.js';
import { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';
import { parseReplacementKey } from './replacement-keys.js';
import { getTableRowContext, normalizeQuotes } from './patcher.js';
import type { ReplacementValue } from './replacement-keys.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Normalize text for value comparison:
 * - Convert non-breaking spaces to regular spaces
 * - Normalize smart quotes to straight quotes
 * - Collapse runs of spaces/tabs to single space (preserve newlines)
 * - Trim
 */
export function normalizeText(text: string): string {
  return text
    // Non-breaking spaces
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    // Smart single quotes → straight
    .replace(/[\u2018\u2019\u2039\u203A]/g, "'")
    // Smart double quotes → straight
    .replace(/[\u201C\u201D\u201A\u201E\u00AB\u00BB]/g, '"')
    // Collapse horizontal whitespace (spaces/tabs) to single space, preserve newlines
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

/**
 * Verify a filled fieldSelector output DOCX:
 * - All context values appear in the document text
 * - No unrendered {template_tags} remain
 * - No leftover [bracketed placeholders] from the replacement map remain
 * - Footnotes removed (if clean config specified)
 * - Drafting note paragraphs removed (if clean config specified)
 */
export async function verifyOutput(
  outputPath: string,
  values: Record<string, unknown>,
  replacements: Record<string, ReplacementValue>,
  cleanConfig?: CleanConfig,
  cleanedSourcePath?: string,
): Promise<VerifyResult> {
  const checks: VerifyCheck[] = [];
  const rawFullText = extractAllText(outputPath);
  const normalizedFullText = normalizeText(rawFullText);
  const xml = extractDocumentXml(outputPath);

  // Check 1: All context values present (with normalization)
  const missingValues: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string' || !value.trim()) continue; // only verify non-empty text values
    const normalizedValue = normalizeText(value);
    if (!normalizedFullText.includes(normalizedValue)) {
      missingValues.push(`${key}="${value}"`);
    }
  }
  checks.push({
    name: 'Context values present',
    passed: missingValues.length === 0,
    details: missingValues.length > 0 ? `Missing: ${missingValues.join(', ')}` : undefined,
  });

  // Check 2: No unrendered {template_tags}
  const unrenderedTags = rawFullText.match(/\{[a-z_][a-z0-9_]*\}/gi) ?? [];
  checks.push({
    name: 'No unrendered template tags',
    passed: unrenderedTags.length === 0,
    details: unrenderedTags.length > 0 ? `Found: ${unrenderedTags.join(', ')}` : undefined,
  });

  // Check 3: No leftover [bracketed placeholders] from replacement map.
  // Context-qualified keys ("context > placeholder") are verified at their
  // qualified location — mirroring the patcher's deterministic anchoring — so an
  // intentional occurrence of the same bare token in an unrelated context is not
  // reported as a failed mapped replacement. Simple keys keep whole-document
  // search (a bare placeholder should not survive anywhere).
  const leftoverBrackets = findLeftoverPlaceholders(outputPath, replacements, cleanedSourcePath);
  checks.push({
    name: 'Leftover source placeholders',
    passed: leftoverBrackets.length === 0,
    details: leftoverBrackets.length > 0 ? `Found: ${leftoverBrackets.join(', ')}` : undefined,
  });

  // Check 4: No footnote references (if removeFootnotes was set)
  if (cleanConfig?.removeFootnotes) {
    const footnoteRefs = (xml.match(/footnoteReference/g) ?? []).length;
    checks.push({
      name: 'Footnotes removed',
      passed: footnoteRefs === 0,
      details: footnoteRefs > 0 ? `${footnoteRefs} footnote reference(s) remain` : undefined,
    });
  }

  // Check 5: No double dollar signs ($$ or $ $)
  // This catches cases where the template already has a $ before a placeholder
  // and the user also included a $ in their value (e.g. "$1,000,000")
  const doubleDollarPattern = /\$[\s\u00A0\t]*\$/;
  const doubleDollarLines = rawFullText.split('\n').filter((line) => doubleDollarPattern.test(line));
  checks.push({
    name: 'No double dollar signs',
    passed: doubleDollarLines.length === 0,
    details: doubleDollarLines.length > 0
      ? `Found ${doubleDollarLines.length} occurrence(s): "${doubleDollarLines[0].trim().slice(0, 80)}"`
      : undefined,
  });

  // Check 6: No drafting note paragraphs (if patterns were set)
  if (cleanConfig?.removeParagraphPatterns && cleanConfig.removeParagraphPatterns.length > 0) {
    const regexes = cleanConfig.removeParagraphPatterns.map((p) => new RegExp(p, 'i'));
    const lines = rawFullText.split('\n');
    const matchingLines = lines.filter((line) => regexes.some((r) => r.test(line.trim())));
    checks.push({
      name: 'Drafting notes removed',
      passed: matchingLines.length === 0,
      details: matchingLines.length > 0 ? `Found: ${matchingLines[0].trim().slice(0, 80)}...` : undefined,
    });
  }

  // Check 7: No range-deleted sections (if ranges were set)
  if (cleanConfig?.removeRanges && cleanConfig.removeRanges.length > 0) {
    const rangeStartPatterns = cleanConfig.removeRanges.map((r) => new RegExp(r.start, 'i'));
    const lines = rawFullText.split('\n');
    const matchingLines = lines.filter((line) =>
      rangeStartPatterns.some((r) => r.test(line.trim()))
    );
    checks.push({
      name: 'Range-deleted sections removed',
      passed: matchingLines.length === 0,
      details: matchingLines.length > 0
        ? `Found: ${matchingLines[0].trim().slice(0, 80)}...`
        : undefined,
    });
  }

  // Check 8: No single-character underlined runs adjacent to non-underlined runs
  // This is a hallmark of quota-based text redistribution corrupting formatting.
  // When cleanedSourcePath is provided, only flag NEW anomalies introduced by fill/patch.
  const outputAnomalyCount = countFormattingAnomalies(outputPath);
  const baselineAnomalyCount = cleanedSourcePath ? countFormattingAnomalies(cleanedSourcePath) : 0;
  const newAnomalyCount = Math.max(0, outputAnomalyCount - baselineAnomalyCount);
  checks.push({
    name: 'No formatting anomalies',
    passed: newAnomalyCount === 0,
    details: newAnomalyCount > 0
      ? `Found ${newAnomalyCount} new single-char underlined run(s) adjacent to non-underlined runs (${outputAnomalyCount} total, ${baselineAnomalyCount} in source)`
      : baselineAnomalyCount > 0
        ? `${baselineAnomalyCount} pre-existing anomaly(ies) in source (baselined)`
        : undefined,
  });

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

/** A paragraph's normalized text plus its table-row label context (if any). */
interface ParagraphInfo {
  text: string;
  rowContext: string | null;
}

/**
 * Extract each paragraph's normalized text and table-row label context from a
 * DOCX, using the same normalization (quotes only) the patcher matches on.
 */
function extractParagraphInfos(docxPath: string): ParagraphInfo[] {
  const zip = new AdmZip(docxPath);
  const parser = new DOMParser();
  const partNames = getGeneralTextPartNames(enumerateTextParts(zip));
  const infos: ParagraphInfo[] = [];
  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;
    const doc = parser.parseFromString(entry.getData().toString('utf-8'), 'text/xml');
    const paras = doc.getElementsByTagNameNS(W_NS, 'p');
    for (let i = 0; i < paras.length; i++) {
      const para = paras[i] as unknown as Element;
      const paraText = getParagraphText(para as unknown as globalThis.Element);
      if (!paraText) continue;
      const rowContext = getTableRowContext(para);
      infos.push({
        text: normalizeQuotes(paraText),
        rowContext: rowContext !== null ? normalizeQuotes(rowContext) : null,
      });
    }
  }
  return infos;
}

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let from = 0;
  let pos: number;
  while ((pos = haystack.indexOf(needle, from)) !== -1) {
    count++;
    from = pos + needle.length;
  }
  return count;
}

/**
 * Whether a context key has an unfilled placeholder at its qualified location,
 * mirroring how the patcher targets them:
 *  - Table-row context: a `searchText` survives in a paragraph whose row label
 *    cell contains the context.
 *  - Paragraph context: a `searchText` appears AFTER the first occurrence of the
 *    context in the paragraph (the patcher fills the first placeholder after the
 *    context).
 *
 * Used only when no source baseline is available (see findLeftoverPlaceholders).
 */
function hasQualifiedLeftover(
  paragraphs: ParagraphInfo[],
  context: string,
  searchText: string,
): boolean {
  if (searchText.length === 0) return false;
  for (const { text, rowContext } of paragraphs) {
    if (rowContext !== null) {
      if (rowContext.includes(context) && text.includes(searchText)) return true;
    } else {
      const ctxPos = text.indexOf(context);
      if (ctxPos === -1) continue;
      if (text.indexOf(searchText, ctxPos + context.length) !== -1) return true;
    }
  }
  return false;
}

/**
 * Find leftover source placeholders from the replacement map that survive in the
 * filled output.
 *
 * Known limitation (deliberate tradeoff): the count baseline treats ANY
 * reduction of a context key's token as success, so it cannot distinguish an
 * occurrence a selector deliberately retains (e.g. the two documented `[___]` in
 * series_designation) from an unexpected extra occurrence of the same token that
 * failed to fill — the two are textually identical. Fully distinguishing them
 * would require machine-readable retained-occurrence metadata in the field
 * contract (fields/<id>.json), which is out of scope here. Two existing
 * mechanisms cover the realistic paths this check cannot: (a) an unexpected
 * extra token means the source changed, which the source_sha256 pin / source
 * drift canary flags before fill; (b) a DECLARED selector occurrence that fails
 * to resolve surfaces an `unresolved` selector warning.
 *
 * Two key shapes are handled differently, matching how the patcher targets them:
 *
 *  - Simple keys ("[Company Name]") replace every occurrence, so any surviving
 *    occurrence anywhere in the document is reported.
 *
 *  - Context-qualified keys ("context > placeholder") target one placeholder per
 *    context, so a bare token may legitimately remain elsewhere (an unrelated
 *    context) or be deliberately retained (a selector field that fills only its
 *    declared occurrences). These are handled by comparing the placeholder's
 *    count against the cleaned source:
 *      - With a source baseline, a context key is reported only when the fill
 *        reduced NOTHING (output count >= source count) — i.e. the mapping was
 *        entirely unhandled (a genuine defect, e.g. a caption the patcher/
 *        selector never touched), as opposed to a partial reduction that leaves
 *        deliberately-retained or selector-verified occurrences behind. This is
 *        the same deterministic baseline-against-source technique used for
 *        formatting anomalies. Counting is done on the flattened text (the same
 *        text the patcher's replacements ultimately land in) so a context that
 *        is unmatchable due to intra-paragraph line breaks — the #607 caption —
 *        is still caught.
 *      - Without a baseline, the key is reported only if an unfilled placeholder
 *        survives at its qualified location — so an intentional occurrence of the
 *        same token in an unrelated context (e.g. "[s]" in "Management Rights
 *        Letter[s]" while the mapped "Closing > [s]" was filled) is not reported.
 *
 * Returns the offending key labels (simple keys as their search text; context
 * keys as their full "context > placeholder" label).
 */
export function findLeftoverPlaceholders(
  docxPath: string,
  replacements: Record<string, ReplacementValue>,
  cleanedSourcePath?: string,
): string[] {
  const simpleSearchTexts = new Set<string>();
  const contextKeys: { context: string; searchText: string; label: string }[] = [];
  for (const key of Object.keys(replacements)) {
    const parsed = parseReplacementKey(key, '');
    if (parsed.type === 'context') {
      contextKeys.push({
        // Match the patcher's quote normalization so the checks anchor on
        // exactly what the patcher would have targeted.
        context: normalizeQuotes(parsed.context),
        searchText: normalizeQuotes(parsed.searchText),
        label: key,
      });
    } else {
      simpleSearchTexts.add(parsed.searchText);
    }
  }

  const leftovers = new Set<string>();
  const outputFullText = normalizeQuotes(extractAllText(docxPath));

  // Simple keys: whole-document search (any surviving occurrence is a leftover).
  for (const text of simpleSearchTexts) {
    if (outputFullText.includes(normalizeQuotes(text))) leftovers.add(text);
  }

  // Context keys: count baseline against the cleaned source, else qualified location.
  if (contextKeys.length > 0) {
    if (cleanedSourcePath) {
      const sourceFullText = normalizeQuotes(extractAllText(cleanedSourcePath));
      for (const ck of contextKeys) {
        const srcCount = countOccurrences(sourceFullText, ck.searchText);
        if (srcCount === 0) continue; // key does not apply to this document
        const outCount = countOccurrences(outputFullText, ck.searchText);
        // Nothing filled for this placeholder → the mapping was entirely
        // unhandled. A partial reduction leaves only intentionally-retained /
        // selector-verified occurrences behind, which are not reported.
        if (outCount >= srcCount) leftovers.add(ck.label);
      }
    } else {
      const outputParagraphs = extractParagraphInfos(docxPath);
      for (const ck of contextKeys) {
        if (hasQualifiedLeftover(outputParagraphs, ck.context, ck.searchText)) {
          leftovers.add(ck.label);
        }
      }
    }
  }

  return [...leftovers];
}

/**
 * Count formatting anomalies: single-character underlined runs adjacent to
 * non-underlined runs. This pattern is the hallmark of quota-based text
 * redistribution corrupting run-level formatting.
 */
export function countFormattingAnomalies(docxPath: string): number {
  const zip = new AdmZip(docxPath);
  const parser = new DOMParser();
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);
  let count = 0;

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;
    const xmlContent = entry.getData().toString('utf-8');
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    const paras = doc.getElementsByTagNameNS(W_NS, 'p');

    for (let i = 0; i < paras.length; i++) {
      const runs = paras[i].getElementsByTagNameNS(W_NS, 'r');
      for (let j = 0; j < runs.length; j++) {
        const run = runs[j];
        const tEls = run.getElementsByTagNameNS(W_NS, 't');
        let runText = '';
        for (let k = 0; k < tEls.length; k++) {
          runText += tEls[k].textContent ?? '';
        }
        if (runText.length !== 1) continue;

        // Check if this run is underlined
        const rPr = run.getElementsByTagNameNS(W_NS, 'rPr');
        if (rPr.length === 0) continue;
        const uEls = rPr[0].getElementsByTagNameNS(W_NS, 'u');
        if (uEls.length === 0) continue;

        // Check adjacent run (next) for non-underlined
        if (j + 1 < runs.length) {
          const nextRun = runs[j + 1];
          const nextRPr = nextRun.getElementsByTagNameNS(W_NS, 'rPr');
          const nextHasUnderline = nextRPr.length > 0 &&
            nextRPr[0].getElementsByTagNameNS(W_NS, 'u').length > 0;
          if (!nextHasUnderline) {
            count++;
          }
        }
      }
    }
  }

  return count;
}

/**
 * Extract all text from general OOXML text parts (document, headers, footers, endnotes).
 */
export function extractAllText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const parser = new DOMParser();

  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  const allParagraphs: string[] = [];

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc = parser.parseFromString(xml, 'text/xml');

    const paras = doc.getElementsByTagNameNS(W_NS, 'p');
    for (let i = 0; i < paras.length; i++) {
      const tElements = paras[i].getElementsByTagNameNS(W_NS, 't');
      const textParts: string[] = [];
      for (let j = 0; j < tElements.length; j++) {
        textParts.push(tElements[j].textContent ?? '');
      }
      if (textParts.length > 0) {
        allParagraphs.push(textParts.join(''));
      }
    }
  }

  return allParagraphs.join('\n');
}

/**
 * Extract raw XML from word/document.xml only (for footnote ref counting).
 */
function extractDocumentXml(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';
  return entry.getData().toString('utf-8');
}

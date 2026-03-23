import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { VerifyResult, VerifyCheck } from './types.js';
import type { CleanConfig } from '../metadata.js';
import { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';
import { extractSearchText, resolveReplacementValue } from './replacement-keys.js';
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
 * Verify a filled recipe output DOCX:
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

  // Check 3: No leftover [bracketed placeholders] from replacement map
  // Use extractSearchText() to handle qualified keys (context) properly
  const searchTexts = [...new Set(Object.keys(replacements).map(extractSearchText))];
  const leftoverBrackets = searchTexts.filter((text) => rawFullText.includes(text));
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

import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { VerifyResult, VerifyCheck } from './types.js';
import type { CleanConfig } from '../metadata.js';
import { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';

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
  values: Record<string, string>,
  replacements: Record<string, string>,
  cleanConfig?: CleanConfig
): Promise<VerifyResult> {
  const checks: VerifyCheck[] = [];
  const rawFullText = extractAllText(outputPath);
  const normalizedFullText = normalizeText(rawFullText);
  const xml = extractDocumentXml(outputPath);

  // Check 1: All context values present (with normalization)
  const missingValues: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!value || !value.trim()) continue; // skip empty/whitespace-only values
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
  const replacementKeys = Object.keys(replacements);
  const leftoverBrackets = replacementKeys.filter((key) => rawFullText.includes(key));
  checks.push({
    name: 'No leftover source placeholders',
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

  // Check 5: No drafting note paragraphs (if patterns were set)
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

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

/**
 * Extract all text from general OOXML text parts (document, headers, footers, endnotes).
 */
function extractAllText(docxPath: string): string {
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

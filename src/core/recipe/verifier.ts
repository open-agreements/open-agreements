import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { VerifyResult, VerifyCheck } from './types.js';
import type { CleanConfig } from '../metadata.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

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
  const fullText = extractAllText(outputPath);
  const xml = extractDocumentXml(outputPath);

  // Check 1: All context values present
  const missingValues: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!fullText.includes(value)) {
      missingValues.push(`${key}="${value}"`);
    }
  }
  checks.push({
    name: 'Context values present',
    passed: missingValues.length === 0,
    details: missingValues.length > 0 ? `Missing: ${missingValues.join(', ')}` : undefined,
  });

  // Check 2: No unrendered {template_tags}
  const unrenderedTags = fullText.match(/\{[a-z_][a-z0-9_]*\}/gi) ?? [];
  checks.push({
    name: 'No unrendered template tags',
    passed: unrenderedTags.length === 0,
    details: unrenderedTags.length > 0 ? `Found: ${unrenderedTags.join(', ')}` : undefined,
  });

  // Check 3: No leftover [bracketed placeholders] from replacement map
  const replacementKeys = Object.keys(replacements);
  const leftoverBrackets = replacementKeys.filter((key) => fullText.includes(key));
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
    const lines = fullText.split('\n');
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

function extractAllText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const parser = new DOMParser();
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';

  const xml = entry.getData().toString('utf-8');
  const doc = parser.parseFromString(xml, 'text/xml');

  const paragraphs: string[] = [];
  const paras = doc.getElementsByTagNameNS(W_NS, 'p');
  for (let i = 0; i < paras.length; i++) {
    const tElements = paras[i].getElementsByTagNameNS(W_NS, 't');
    const parts: string[] = [];
    for (let j = 0; j < tElements.length; j++) {
      parts.push(tElements[j].textContent ?? '');
    }
    if (parts.length > 0) {
      paragraphs.push(parts.join(''));
    }
  }
  return paragraphs.join('\n');
}

function extractDocumentXml(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';
  return entry.getData().toString('utf-8');
}

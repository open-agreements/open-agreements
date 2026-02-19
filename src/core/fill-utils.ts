/**
 * Shared utilities for the fill stage of all pipelines (template, recipe, external).
 */

import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { enumerateTextParts, getGeneralTextPartNames } from './recipe/ooxml-parts.js';
import type { VerifyResult } from './recipe/types.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Visible placeholder rendered for fields the user hasn't filled yet.
 * Makes it obvious what still needs attention in the output document.
 */
export const BLANK_PLACEHOLDER = '_______';

/**
 * Scan a DOCX template buffer for fields that have a literal `$` immediately
 * before the `{field_name}` tag. Returns the set of field names.
 *
 * Works by parsing OOXML text parts and concatenating `<w:t>` elements per
 * paragraph, then matching `$` + `{field_name}` patterns. Handles cross-run
 * splits because text is concatenated at the paragraph level.
 */
export function detectCurrencyFields(docxBuffer: Buffer): Set<string> {
  const zip = new AdmZip(docxBuffer);
  const parser = new DOMParser();
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  const currencyFields = new Set<string>();

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc = parser.parseFromString(xml, 'text/xml');

    const paras = doc.getElementsByTagNameNS(W_NS, 'p');
    for (let i = 0; i < paras.length; i++) {
      const tElements = paras[i].getElementsByTagNameNS(W_NS, 't');
      let fullText = '';
      for (let j = 0; j < tElements.length; j++) {
        fullText += tElements[j].textContent ?? '';
      }
      const matches = fullText.matchAll(/\$\{(\w+)\}/g);
      for (const m of matches) {
        currencyFields.add(m[1]);
      }
    }
  }

  return currencyFields;
}

/**
 * Strip leading `$` from user values where the DOCX template already has
 * a literal `$` before the `{field_name}` tag. Prevents double-dollar
 * output like `$$1,000,000`.
 *
 * This is the DOCX-aware version that works for all pipelines — it scans
 * the template buffer directly instead of requiring a replacements map.
 */
export function sanitizeCurrencyValuesFromDocx(
  values: Record<string, unknown>,
  docxBuffer: Buffer
): Record<string, unknown> {
  const currencyFields = detectCurrencyFields(docxBuffer);
  if (currencyFields.size === 0) return values;

  const sanitized = { ...values };
  for (const field of currencyFields) {
    const v = sanitized[field];
    if (typeof v === 'string' && v.startsWith('$')) {
      sanitized[field] = v.slice(1);
    }
  }
  return sanitized;
}

/**
 * Verify a filled template DOCX output.
 * Runs a subset of checks that are safe for templates:
 * - No double dollar signs (catches currency sanitization failures)
 * - No unrendered {template_tags} (catches fill failures)
 *
 * Does NOT check: leftover brackets (templates don't use them),
 * context values present (templates use {IF} conditionals that hide values),
 * drafting notes (stripped by fillDocx), footnotes (may be legitimate).
 */
export function verifyTemplateFill(outputPath: string): VerifyResult {
  const zip = new AdmZip(outputPath);
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
  const rawFullText = allParagraphs.join('\n');

  const checks: VerifyResult['checks'] = [];

  // Check 1: No double dollar signs ($$ or $ $)
  const doubleDollarPattern = /\$[\s\u00A0\t]*\$/;
  const doubleDollarLines = rawFullText.split('\n').filter((line) => doubleDollarPattern.test(line));
  checks.push({
    name: 'No double dollar signs',
    passed: doubleDollarLines.length === 0,
    details: doubleDollarLines.length > 0
      ? `Found ${doubleDollarLines.length} occurrence(s): "${doubleDollarLines[0].trim().slice(0, 80)}"`
      : undefined,
  });

  // Check 2: No unrendered {template_tags}
  const unrenderedTags = rawFullText.match(/\{[a-z_][a-z0-9_]*\}/gi) ?? [];
  checks.push({
    name: 'No unrendered template tags',
    passed: unrenderedTags.length === 0,
    details: unrenderedTags.length > 0 ? `Found: ${unrenderedTags.join(', ')}` : undefined,
  });

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

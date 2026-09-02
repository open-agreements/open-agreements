/**
 * Shared utilities for the fill stage of all pipelines (template, fieldSelector, external).
 */

import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { enumerateTextParts, getGeneralTextPartNames } from './field-selector/ooxml-parts.js';
import type { VerifyResult } from './field-selector/types.js';

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
 * Horizontal whitespace that can sit between a tag and a trailing `%`, or
 * between a number and its `%` inside a user value. Deliberately excludes
 * `\n` — a percent sign on the next line belongs to different prose.
 */
const H_SPACE = ' \\t\\u00A0\\u2007\\u202F';

/** `{field}` immediately followed (modulo horizontal whitespace) by `%`. */
const TAG_THEN_PERCENT = new RegExp(`\\{(\\w+)\\}[${H_SPACE}]*%`, 'g');

/** Any `{field}` tag. */
const ANY_TAG = /\{(\w+)\}/g;

/** A trailing `%` on a user value, with any horizontal whitespace before it. */
const TRAILING_PERCENT = new RegExp(`[${H_SPACE}]*%$`);

/**
 * A doubled percent sign (`%%` or `% %`) in rendered output — the artifact left
 * when a sign-carrying value lands in a placeholder whose source already
 * supplies the `%`. The trailing-sigil twin of the `doubleDollarPattern`.
 *
 * Shared with the fieldSelector verifier so both entry points flag the same
 * shape. Not global: every caller only asks whether a line matches.
 */
export const DOUBLE_PERCENT_PATTERN = /%[\s\u00A0\t]*%/;

/**
 * Scan a DOCX template buffer for fields whose `{field_name}` tag is
 * immediately followed by a literal `%` — the trailing-sigil mirror of
 * {@link detectCurrencyFields}.
 *
 * A field is reported only when **every** occurrence of its tag carries the
 * adjacent `%`. That asymmetry with the currency detector is deliberate and
 * is the whole reason this is not a literal mirror: recipes disagree about
 * which side of the seam owns the sign (`nvca-rofr-co-sale-agreement` maps the
 * key `"[specify percentage]%"`, absorbing the source `%`, while the
 * certificate of incorporation and stock purchase agreement map
 * `"[specify percentage]"` and leave it in place), so one field can plausibly
 * land in a document with the sign on some occurrences and not others. When
 * the occurrences disagree there is no value that renders correctly
 * everywhere, so we strip nothing and let the `%%` artifact surface loudly in
 * the verifier rather than silently dropping the sign from the occurrence that
 * needed it.
 *
 * Works by parsing OOXML text parts and concatenating `<w:t>` elements per
 * paragraph, so a tag split across runs is still seen whole.
 */
export function detectPercentFields(docxBuffer: Buffer): Set<string> {
  const zip = new AdmZip(docxBuffer);
  const parser = new DOMParser();
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  const totalByField = new Map<string, number>();
  const adjacentByField = new Map<string, number>();

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
      for (const m of fullText.matchAll(ANY_TAG)) {
        totalByField.set(m[1], (totalByField.get(m[1]) ?? 0) + 1);
      }
      for (const m of fullText.matchAll(TAG_THEN_PERCENT)) {
        adjacentByField.set(m[1], (adjacentByField.get(m[1]) ?? 0) + 1);
      }
    }
  }

  const percentFields = new Set<string>();
  for (const [field, adjacent] of adjacentByField) {
    if (adjacent > 0 && adjacent === totalByField.get(field)) {
      percentFields.add(field);
    }
  }
  return percentFields;
}

/**
 * Strip a trailing `%` from user values where the DOCX template already has a
 * literal `%` after the `{field_name}` tag. Prevents double-percent output
 * like `60%%`.
 *
 * The mirror of {@link sanitizeCurrencyValuesFromDocx} is not literal: `$` is a
 * leading sigil and `%` a trailing one, so this strips from the end, and it
 * also absorbs any horizontal whitespace the user typed before the sign, a
 * non-breaking or figure space included: "60%", "60 %", and a value with a
 * U+00A0 before the sign all become "60". A value that is nothing but a
 * percent sign is left alone rather than blanked.
 */
export function sanitizePercentValuesFromDocx(
  values: Record<string, unknown>,
  docxBuffer: Buffer
): Record<string, unknown> {
  const percentFields = detectPercentFields(docxBuffer);
  if (percentFields.size === 0) return values;

  const sanitized = { ...values };
  for (const field of percentFields) {
    const v = sanitized[field];
    if (typeof v !== 'string') continue;
    const stripped = v.replace(TRAILING_PERCENT, '');
    if (stripped !== v && stripped.trim() !== '') {
      sanitized[field] = stripped;
    }
  }
  return sanitized;
}

/**
 * Verify a filled template DOCX output.
 * Runs a subset of checks that are safe for templates:
 * - No double dollar signs (catches currency sanitization failures)
 * - No double percent signs (catches percentage sanitization failures)
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

  // Check 2: No double percent signs (%% or % %) — the trailing-sigil twin of
  // Check 1. The template already carries the `%` after some placeholders, so a
  // sign-carrying value doubles it.
  const doublePercentLines = rawFullText
    .split('\n')
    .filter((line) => DOUBLE_PERCENT_PATTERN.test(line));
  checks.push({
    name: 'No double percent signs',
    passed: doublePercentLines.length === 0,
    details: doublePercentLines.length > 0
      ? `Found ${doublePercentLines.length} occurrence(s): "${doublePercentLines[0].trim().slice(0, 80)}"`
      : undefined,
  });

  // Check 3: No unrendered {template_tags}
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

/**
 * Shared utilities for the fill stage of all pipelines (template, recipe, external).
 */

import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { enumerateTextParts, getGeneralTextPartNames } from './recipe/ooxml-parts.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Visible placeholder rendered for fields the user hasn't filled yet.
 * Makes it obvious what still needs attention in the output document.
 */
export const BLANK_PLACEHOLDER = '_______';

/**
 * Detect fields whose replacement values place a literal `$` immediately
 * before the `{field_name}` template tag (e.g. `${purchase_amount}`).
 * For those fields, strip a leading `$` from the user-provided value
 * to prevent double-dollar output like `$$1,000,000`.
 *
 * @deprecated Use {@link sanitizeCurrencyValuesFromDocx} instead — it scans
 * the DOCX buffer directly and works for all pipelines (template, recipe, external).
 */
export function sanitizeCurrencyValues(
  values: Record<string, string>,
  replacements: Record<string, string>
): Record<string, string> {
  // Find fields where the replacement value has $ immediately before {field_name}
  const dollarPrefixedFields = new Set<string>();
  for (const replValue of Object.values(replacements)) {
    const matches = replValue.matchAll(/\$\{(\w+)\}/g);
    for (const m of matches) {
      dollarPrefixedFields.add(m[1]);
    }
  }

  if (dollarPrefixedFields.size === 0) return values;

  const sanitized = { ...values };
  for (const field of dollarPrefixedFields) {
    if (sanitized[field] && sanitized[field].startsWith('$')) {
      sanitized[field] = sanitized[field].slice(1);
    }
  }
  return sanitized;
}

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
  values: Record<string, string | boolean>,
  docxBuffer: Buffer
): Record<string, string | boolean> {
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

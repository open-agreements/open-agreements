import { existsSync, writeFileSync } from 'node:fs';
import AdmZip from 'adm-zip';
import { enumerateTextParts, getGeneralTextPartNames } from '../core/recipe/ooxml-parts.js';

/**
 * Scan a DOCX file and report all bracketed placeholders.
 * Classifies them as short (fill-in fields) vs long (alternative clauses).
 * Optionally outputs a draft replacements.json.
 *
 * Scans all general OOXML text parts (document, headers, footers, endnotes).
 */
export function runScan(args: { input: string; outputReplacements?: string }): void {
  if (!existsSync(args.input)) {
    console.error(`File not found: ${args.input}`);
    process.exit(1);
  }

  const zip = new AdmZip(args.input);
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  // Collect bracketed content from all parts, tracking which part they appear in
  const bracketsByPart = new Map<string, Set<string>>();
  const allBrackets: string[] = [];

  for (const partName of partNames) {
    const text = extractPartText(zip, partName);
    const brackets = [...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
    if (brackets.length > 0) {
      bracketsByPart.set(partName, new Set(brackets));
      allBrackets.push(...brackets);
    }
  }

  const unique = [...new Set(allBrackets)].sort();

  const shortPlaceholders: string[] = [];
  const longClauses: string[] = [];

  for (const b of unique) {
    if (b.length <= 80) {
      shortPlaceholders.push(`[${b}]`);
    } else {
      longClauses.push(`[${b.slice(0, 60)}...]`);
    }
  }

  console.log(`\n=== Scan of ${args.input} ===`);

  // Report parts scanned
  const nonDocParts = partNames.filter((p) => p !== 'word/document.xml');
  if (nonDocParts.length > 0) {
    console.log(`Parts scanned: document.xml + ${nonDocParts.length} additional (${nonDocParts.join(', ')})`);
  }

  console.log(`\nShort placeholders (${shortPlaceholders.length}):`);
  for (const p of shortPlaceholders) {
    // Note which parts contain this placeholder (if outside document.xml)
    const inner = p.slice(1, -1);
    const locations: string[] = [];
    for (const [partName, brackets] of bracketsByPart) {
      if (partName !== 'word/document.xml' && brackets.has(inner)) {
        locations.push(partName.replace('word/', ''));
      }
    }
    const suffix = locations.length > 0 ? `  (also in: ${locations.join(', ')})` : '';
    console.log(`  ${p}${suffix}`);
  }

  console.log(`\nLong clauses/alternatives (${longClauses.length}) — skipped by recipe:`);
  for (const c of longClauses) {
    console.log(`  ${c}`);
  }

  // Footnote count
  const footnoteCount = countFootnotes(zip);
  console.log(`\nFootnotes: ${footnoteCount} explanatory footnote(s)`);

  // Underscore blanks (from all parts)
  let totalBlanks = 0;
  for (const partName of partNames) {
    const text = extractPartText(zip, partName);
    const blanks = text.match(/_{3,}/g) ?? [];
    totalBlanks += blanks.length;
  }
  console.log(`Underscore blanks: ${totalBlanks} occurrence(s)`);

  // Output draft replacements.json
  if (args.outputReplacements) {
    const replacements: Record<string, string> = {};
    for (const p of shortPlaceholders) {
      const inner = p.slice(1, -1);
      const tagName = inner
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      replacements[p] = `{${tagName}}`;
    }
    writeFileSync(args.outputReplacements, JSON.stringify(replacements, null, 2) + '\n');
    console.log(`\nDraft replacements written to: ${args.outputReplacements}`);
  }

  console.log('');
}

function extractPartText(zip: AdmZip, partName: string): string {
  const entry = zip.getEntry(partName);
  if (!entry) return '';
  const xml = entry.getData().toString('utf-8');

  const paragraphs: string[] = [];
  const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const paraXml = paraMatch[0];
    const textParts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(paraXml)) !== null) {
      textParts.push(tMatch[1]);
    }
    if (textParts.length > 0) {
      paragraphs.push(textParts.join(''));
    }
  }
  return paragraphs.join('\n');
}

function countFootnotes(zip: AdmZip): number {
  const entry = zip.getEntry('word/footnotes.xml');
  if (!entry) return 0;
  const xml = entry.getData().toString('utf-8');
  const all = xml.match(/<w:footnote\s/g) ?? [];
  const separators = xml.match(/w:type="(separator|continuationSeparator)"/g) ?? [];
  return all.length - separators.length;
}

import { existsSync, writeFileSync } from 'node:fs';
import AdmZip from 'adm-zip';

/**
 * Scan a DOCX file and report all bracketed placeholders.
 * Classifies them as short (fill-in fields) vs long (alternative clauses).
 * Optionally outputs a draft replacements.json.
 */
export function runScan(args: { input: string; outputReplacements?: string }): void {
  if (!existsSync(args.input)) {
    console.error(`File not found: ${args.input}`);
    process.exit(1);
  }

  const text = extractAllText(args.input);
  const xml = extractDocumentXml(args.input);

  // Find all bracketed content
  const brackets = [...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  const unique = [...new Set(brackets)].sort();

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
  console.log(`\nShort placeholders (${shortPlaceholders.length}):`);
  for (const p of shortPlaceholders) {
    console.log(`  ${p}`);
  }

  console.log(`\nLong clauses/alternatives (${longClauses.length}) — skipped by recipe:`);
  for (const c of longClauses) {
    console.log(`  ${c}`);
  }

  // Footnote count
  const footnoteCount = countFootnotes(args.input);
  console.log(`\nFootnotes: ${footnoteCount} explanatory footnote(s)`);

  // Underscore blanks
  const blanks = text.match(/_{3,}/g) ?? [];
  console.log(`Underscore blanks: ${blanks.length} occurrence(s)`);

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

function extractAllText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
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

function extractDocumentXml(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';
  return entry.getData().toString('utf-8');
}

function countFootnotes(docxPath: string): number {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/footnotes.xml');
  if (!entry) return 0;
  const xml = entry.getData().toString('utf-8');
  const all = xml.match(/<w:footnote\s/g) ?? [];
  const separators = xml.match(/w:type="(separator|continuationSeparator)"/g) ?? [];
  return all.length - separators.length;
}

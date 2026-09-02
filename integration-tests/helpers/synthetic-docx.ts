/**
 * Generalized synthetic DOCX fixture builder (#721).
 *
 * The pre-existing synthetic builder in `nvca-spa-template.test.ts` emits each
 * placeholder ALONE in its own paragraph (`Marker N: [placeholder]`). A whole
 * class of rendering defects is invisible to that shape, because the defect is
 * a property of the literal text AROUND the placeholder rather than of the
 * placeholder itself:
 *
 *  - a binding key that absorbs a shared literal prefix (`District Court for
 *    the District of [judicial district]`) so a full value does not double it
 *    into `District of Northern District of California`;
 *  - two adjacent bracketed alternatives in one sentence sharing that prefix,
 *    where each must bind to its own key;
 *  - a proper noun that must survive substitution with its capitalization
 *    intact (`state courts of California`, not `state courts of california`).
 *
 * This builder therefore takes REAL paragraph prose with embedded placeholders,
 * so a fixture can reproduce clause SHAPE, not just clause vocabulary.
 *
 * NOTE ON SOURCE TEXT: the NVCA forms these defects were found in are
 * non-redistributable. Every fixture built on top of this helper must use
 * PARAPHRASED prose that exercises the same binding mechanics — never copied
 * source sentences.
 *
 * ## Run splitting
 *
 * Word routinely splits one sentence across many `<w:r>`/`<w:t>` runs
 * (spell-check state, revision marks, formatting changes), and several of these
 * defects only manifest when a placeholder spans runs. A fixture that puts each
 * sentence in a single run is therefore too easy on the code, so the builder
 * offers explicit strategies and callers should exercise more than one.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';

export const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const WORD_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

/**
 * How a paragraph's text is distributed across `<w:r>`/`<w:t>` runs.
 *
 * - `single`    — one run for the whole paragraph. The easiest case; a defect
 *                 that only appears cross-run will NOT reproduce here.
 * - `words`     — one run per whitespace-delimited token. Realistic for a
 *                 paragraph Word has edited in place.
 * - `straddle`  — every `[…]` placeholder is deliberately cut in half, so each
 *                 placeholder spans at least two runs. This is the shape that
 *                 exercises the patcher's char-map cross-run replacement.
 * - `{ chunkChars: n }` — fixed-size chunks of n characters, which slices
 *                 through brackets and literal prefixes at arbitrary offsets.
 */
export type RunSplit = 'single' | 'words' | 'straddle' | { chunkChars: number };

/** Every run-splitting strategy worth sweeping a rendering assertion across. */
export const ALL_RUN_SPLITS: RunSplit[] = ['single', 'words', 'straddle', { chunkChars: 7 }];

/** Short label for a run split, for use in test names and Allure parameters. */
export function runSplitLabel(split: RunSplit): string {
  return typeof split === 'string' ? split : `chunk-${split.chunkChars}`;
}

export interface SyntheticParagraph {
  /** Literal paragraph text, placeholders included, exactly as Word would show it. */
  text: string;
  /** Overrides the document-level run split for this paragraph only. */
  runSplit?: RunSplit;
  /** Word auto-numbering level, when the fixture needs a numbered paragraph. */
  numberingLevel?: number;
}

export type ParagraphSpec = string | SyntheticParagraph;

export interface SyntheticDocxOptions {
  /** Default run split for paragraphs that do not override it. Default: `single`. */
  runSplit?: RunSplit;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** Split `text` into the run-sized chunks the given strategy asks for. */
export function splitIntoRuns(text: string, split: RunSplit): string[] {
  if (text.length === 0) return [''];

  if (typeof split === 'object') {
    const size = Math.max(1, split.chunkChars);
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
    return chunks;
  }

  if (split === 'single') return [text];

  if (split === 'words') {
    // Keep the delimiter with the preceding token so re-joining is lossless.
    const chunks = text.match(/\S+\s*|\s+/g);
    return chunks && chunks.length > 0 ? chunks : [text];
  }

  // 'straddle' — cut every bracketed placeholder in half, and cut once in the
  // middle of each literal span between placeholders, so no placeholder and no
  // surrounding literal prefix sits wholly inside a single run.
  const boundaries = new Set<number>([0, text.length]);
  for (const match of text.matchAll(/\[[^\]]*\]/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    boundaries.add(start);
    boundaries.add(end);
    if (end - start > 2) boundaries.add(start + Math.floor((end - start) / 2));
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  // Add a midpoint cut inside each literal span between the placeholder cuts.
  const withLiteralCuts = new Set(sorted);
  for (let i = 0; i + 1 < sorted.length; i++) {
    const span = sorted[i + 1] - sorted[i];
    if (span > 8) withLiteralCuts.add(sorted[i] + Math.floor(span / 2));
  }
  const cuts = [...withLiteralCuts].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const chunk = text.slice(cuts[i], cuts[i + 1]);
    if (chunk.length > 0) runs.push(chunk);
  }
  return runs.length > 0 ? runs : [text];
}

function paragraphXml(spec: ParagraphSpec, defaultSplit: RunSplit): string {
  const paragraph: SyntheticParagraph = typeof spec === 'string' ? { text: spec } : spec;
  const split = paragraph.runSplit ?? defaultSplit;
  const runs = splitIntoRuns(paragraph.text, split)
    .map((chunk) => `<w:r><w:t xml:space="preserve">${xmlEscape(chunk)}</w:t></w:r>`)
    .join('');
  const pPr =
    paragraph.numberingLevel === undefined
      ? ''
      : `<w:pPr><w:numPr><w:ilvl w:val="${paragraph.numberingLevel}"/><w:numId w:val="1"/></w:numPr></w:pPr>`;
  return `<w:p>${pPr}${runs}</w:p>`;
}

/** Build the raw bytes of a minimal, valid DOCX carrying the given paragraphs. */
export function buildSyntheticDocxBuffer(
  paragraphs: ParagraphSpec[],
  options: SyntheticDocxOptions = {},
): Buffer {
  const defaultSplit = options.runSplit ?? 'single';
  const bodyXml = paragraphs.map((p) => paragraphXml(p, defaultSplit)).join('');
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${bodyXml}</w:body></w:document>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(ROOT_RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  return zip.toBuffer();
}

export interface SyntheticDocxFixture {
  tempDir: string;
  /** The built source document. */
  inputPath: string;
  /** A path in the same temp dir for the pipeline to write to. */
  outputPath: string;
  /** Remove the temp dir. Safe to call more than once. */
  cleanup: () => void;
}

/** Write a synthetic DOCX into a fresh temp dir and return its paths. */
export function createSyntheticDocxFixture(
  paragraphs: ParagraphSpec[],
  options: SyntheticDocxOptions & { prefix?: string } = {},
): SyntheticDocxFixture {
  const tempDir = mkdtempSync(join(tmpdir(), options.prefix ?? 'synthetic-docx-'));
  const inputPath = join(tempDir, 'source.docx');
  const outputPath = join(tempDir, 'filled.docx');
  writeFileSync(inputPath, buildSyntheticDocxBuffer(paragraphs, options));
  return {
    tempDir,
    inputPath,
    outputPath,
    cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
  };
}

/** Concatenate every `<w:t>` in a DOCX's main document part. */
export function extractDocxText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';
  const xml = entry.getData().toString('utf-8');
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

/** Per-paragraph text of a DOCX's main document part, in document order. */
export function extractDocxParagraphTexts(docxPath: string): string[] {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return [];
  const xml = entry.getData().toString('utf-8');
  return [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) =>
    [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join(''),
  );
}

/** Count non-overlapping occurrences of `needle` in `haystack`. */
export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

import AdmZip from 'adm-zip';

export interface OoxmlTextParts {
  document: string | null;
  headers: string[];       // word/header1.xml, word/header2.xml, etc.
  footers: string[];       // word/footer1.xml, word/footer2.xml, etc.
  endnotes: string | null; // word/endnotes.xml
  footnotes: string | null; // word/footnotes.xml — special handling in cleaner
}

/**
 * Enumerate all OOXML text parts present in a DOCX zip.
 */
export function enumerateTextParts(zip: AdmZip): OoxmlTextParts {
  const entries = zip.getEntries().map((e) => e.entryName);

  const headerPattern = /^word\/header\d+\.xml$/;
  const footerPattern = /^word\/footer\d+\.xml$/;

  return {
    document: entries.includes('word/document.xml') ? 'word/document.xml' : null,
    headers: entries.filter((e) => headerPattern.test(e)).sort(),
    footers: entries.filter((e) => footerPattern.test(e)).sort(),
    endnotes: entries.includes('word/endnotes.xml') ? 'word/endnotes.xml' : null,
    footnotes: entries.includes('word/footnotes.xml') ? 'word/footnotes.xml' : null,
  };
}

/**
 * Return a flat list of part names that should be processed by the patcher,
 * cleaner (for footnote refs and paragraph patterns), verifier, and scanner.
 *
 * Excludes footnotes.xml because it has separator/continuationSeparator logic
 * that requires special handling in the cleaner.
 */
export function getGeneralTextPartNames(parts: OoxmlTextParts): string[] {
  const names: string[] = [];
  if (parts.document) names.push(parts.document);
  names.push(...parts.headers);
  names.push(...parts.footers);
  if (parts.endnotes) names.push(parts.endnotes);
  return names;
}

/**
 * Return every text part, footnotes included.
 *
 * `getGeneralTextPartNames()` excludes `word/footnotes.xml` because the
 * *cleaner* has to special-case its separator / continuationSeparator
 * paragraphs. That exclusion is about mutation. Read-only passes — detecting
 * which fields the source owns a sigil for, and scanning rendered output for
 * doubling artifacts — have no such constraint, and a document whose footnote
 * renders `8%%` while the verifier reports success is worse than one that
 * fails loudly. Use this list for inspection; use the general list for
 * anything that rewrites parts.
 */
export function getAllTextPartNames(parts: OoxmlTextParts): string[] {
  const names = getGeneralTextPartNames(parts);
  if (parts.footnotes) names.push(parts.footnotes);
  return names;
}

/**
 * Copy OPC parts from one zip to another, excluding directory entries.
 *
 * OOXML packages are a flat set of parts; directory entries such as `word/`
 * are JSZip/zip container artifacts and can make Word repair the document.
 *
 * `getData` may return a replacement Buffer for an entry, or `null` to drop
 * the entry from the destination entirely (used for orphaned media parts).
 */
export function copyEntriesSkippingDirs(
  sourceZip: AdmZip,
  destinationZip: AdmZip,
  getData: (entryName: string, entryData: Buffer) => Buffer | null = (_entryName, entryData) => entryData,
): void {
  for (const entry of sourceZip.getEntries()) {
    if (entry.isDirectory || entry.entryName.endsWith('/')) continue;
    const data = getData(entry.entryName, entry.getData());
    if (data === null) continue;
    destinationZip.addFile(entry.entryName, data);
  }
}

/**
 * Rebuild a zip from scratch while dropping directory entries.
 */
export function rezipWithoutDirEntries(zip: AdmZip): AdmZip {
  const outZip = new AdmZip();
  copyEntriesSkippingDirs(zip, outZip);
  return outZip;
}

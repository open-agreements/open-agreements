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

import AdmZip from 'adm-zip';

export interface OutputValidationResult {
  valid: boolean;
  errors: string[];
  sourceHeadingCount: number;
  outputHeadingCount: number;
}

/**
 * Validate that a rendered DOCX preserves the heading structure of the source template.
 * Extracts word/document.xml via AdmZip before scanning for heading styles.
 */
export function validateOutput(
  sourceDocxPath: string,
  outputDocxPath: string
): OutputValidationResult {
  const errors: string[] = [];

  let sourceXml: string;
  let outputXml: string;
  try {
    sourceXml = extractDocumentXml(sourceDocxPath);
    outputXml = extractDocumentXml(outputDocxPath);
  } catch (err) {
    return {
      valid: false,
      errors: [`Failed to read files: ${(err as Error).message}`],
      sourceHeadingCount: 0,
      outputHeadingCount: 0,
    };
  }

  const sourceHeadings = countHeadings(sourceXml);
  const outputHeadings = countHeadings(outputXml);

  if (sourceHeadings !== outputHeadings) {
    errors.push(
      `Heading count mismatch: source has ${sourceHeadings} headings, output has ${outputHeadings}. ` +
      'Template rendering may have dropped or duplicated content.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    sourceHeadingCount: sourceHeadings,
    outputHeadingCount: outputHeadings,
  };
}

function extractDocumentXml(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';
  return entry.getData().toString('utf-8');
}

function countHeadings(xml: string): number {
  const headingPattern = /w:val="Heading\d"/g;
  const matches = xml.match(headingPattern);
  return matches ? matches.length : 0;
}

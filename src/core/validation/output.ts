import { readFileSync } from 'node:fs';

export interface OutputValidationResult {
  valid: boolean;
  errors: string[];
  sourceHeadingCount: number;
  outputHeadingCount: number;
}

/**
 * Validate that a rendered DOCX preserves the heading structure of the source template.
 * Compares heading counts between source and output by scanning DOCX XML for heading styles.
 */
export function validateOutput(
  sourceDocxPath: string,
  outputDocxPath: string
): OutputValidationResult {
  const errors: string[] = [];

  let sourceBuf: Buffer;
  let outputBuf: Buffer;
  try {
    sourceBuf = readFileSync(sourceDocxPath);
    outputBuf = readFileSync(outputDocxPath);
  } catch (err) {
    return {
      valid: false,
      errors: [`Failed to read files: ${(err as Error).message}`],
      sourceHeadingCount: 0,
      outputHeadingCount: 0,
    };
  }

  // Count heading styles in DOCX XML (w:pStyle w:val="Heading...")
  const sourceHeadings = countHeadings(sourceBuf);
  const outputHeadings = countHeadings(outputBuf);

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

function countHeadings(docxBuf: Buffer): number {
  const content = docxBuf.toString('utf-8');
  // Match DOCX XML heading paragraph style references
  const headingPattern = /w:val="Heading\d"/g;
  const matches = content.match(headingPattern);
  return matches ? matches.length : 0;
}

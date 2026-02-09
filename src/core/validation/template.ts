import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { loadMetadata } from '../metadata.js';

export interface TemplateValidationResult {
  templateId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Extract text content from a DOCX file by unzipping and reading word/document.xml.
 * Concatenates <w:t> text within each <w:p> paragraph, then joins paragraphs with
 * newlines to prevent false {tag} matches across element boundaries.
 */
function extractDocxText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const documentXml = zip.getEntry('word/document.xml');
  if (!documentXml) return '';
  const xml = documentXml.getData().toString('utf-8');

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

/**
 * Validate that a template's metadata fields match the placeholders in its DOCX file.
 */
export function validateTemplate(templateDir: string, templateId: string): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let metadata;
  try {
    metadata = loadMetadata(templateDir);
  } catch (err) {
    return {
      templateId,
      valid: false,
      errors: [`Failed to load metadata: ${(err as Error).message}`],
      warnings: [],
    };
  }

  const templatePath = join(templateDir, 'template.docx');
  if (!existsSync(templatePath)) {
    return {
      templateId,
      valid: false,
      errors: ['template.docx not found in template directory'],
      warnings: [],
    };
  }

  // Extract text from DOCX and find {tag} placeholders
  const text = extractDocxText(templatePath);
  const placeholderRegex = /\{(\w+)\}/g;
  const foundTags = new Set<string>();
  let match;
  while ((match = placeholderRegex.exec(text)) !== null) {
    foundTags.add(match[1]);
  }

  const metadataFieldNames = new Set(metadata.fields.map((f) => f.name));

  // Check for fields in metadata but not in DOCX
  for (const fieldName of metadataFieldNames) {
    if (!foundTags.has(fieldName)) {
      const field = metadata.fields.find((f) => f.name === fieldName);
      if (field?.required) {
        errors.push(
          `Required field "${fieldName}" defined in metadata but not found as {${fieldName}} in template.docx`
        );
      } else {
        warnings.push(
          `Optional field "${fieldName}" defined in metadata but not found as {${fieldName}} in template.docx`
        );
      }
    }
  }

  // Check for placeholders in DOCX but not in metadata
  for (const tag of foundTags) {
    if (!metadataFieldNames.has(tag)) {
      warnings.push(
        `Placeholder {${tag}} found in template.docx but not defined in metadata fields`
      );
    }
  }

  return { templateId, valid: errors.length === 0, errors, warnings };
}

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
 * Strips XML tags to get plain text content including {tag} placeholders.
 */
function extractDocxText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const documentXml = zip.getEntry('word/document.xml');
  if (!documentXml) return '';
  const xml = documentXml.getData().toString('utf-8');
  // Extract text from <w:t> elements
  const textParts: string[] = [];
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    textParts.push(match[1]);
  }
  return textParts.join('');
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
      warnings.push(
        `Field "${fieldName}" defined in metadata but not found as {${fieldName}} in template.docx`
      );
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

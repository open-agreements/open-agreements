import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { loadMetadata } from '../metadata.js';
import { extractSearchText } from '../recipe/replacement-keys.js';

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

  const metadataFieldNames = new Set(metadata.fields.map((f) => f.name));

  // Check if this template uses declarative replacements
  const replacementsPath = join(templateDir, 'replacements.json');
  const hasReplacements = existsSync(replacementsPath);

  if (hasReplacements) {
    // Declarative pipeline: tags are in replacement values, not DOCX text.
    // Validate replacement keys exist in DOCX, and replacement value tags match metadata.
    let replacements: Record<string, string>;
    try {
      replacements = JSON.parse(readFileSync(replacementsPath, 'utf-8'));
    } catch (err) {
      return {
        templateId,
        valid: false,
        errors: [`Failed to parse replacements.json: ${(err as Error).message}`],
        warnings,
      };
    }

    const docxText = extractDocxText(templatePath);

    // Validate replacement keys exist in the original DOCX text
    for (const key of Object.keys(replacements)) {
      const searchText = extractSearchText(key);
      if (!docxText.includes(searchText)) {
        errors.push(
          `Replacement key "${searchText}" not found in template.docx`
        );
      }
    }

    // Collect {tags} from replacement values and the DOCX text
    const foundTags = new Set<string>();
    const foundConditionalFields = new Set<string>();

    // Tags from replacement values (these will exist after patching)
    for (const value of Object.values(replacements)) {
      const placeholderRegex = /\{(\w+)\}/g;
      let match;
      while ((match = placeholderRegex.exec(value)) !== null) {
        foundTags.add(match[1]);
      }
      const conditionalRegex = /\{IF !?(\w+)\}/g;
      let condMatch;
      while ((condMatch = conditionalRegex.exec(value)) !== null) {
        foundConditionalFields.add(condMatch[1]);
      }
    }

    // Tags already in the DOCX (may exist alongside replacements)
    const docxPlaceholderRegex = /\{(\w+)\}/g;
    let docxMatch;
    while ((docxMatch = docxPlaceholderRegex.exec(docxText)) !== null) {
      foundTags.add(docxMatch[1]);
    }
    const docxConditionalRegex = /\{IF !?(\w+)\}/g;
    let docxCondMatch;
    while ((docxCondMatch = docxConditionalRegex.exec(docxText)) !== null) {
      foundConditionalFields.add(docxCondMatch[1]);
    }

    // Check metadata fields are covered by tags
    for (const fieldName of metadataFieldNames) {
      const inTags = foundTags.has(fieldName) || foundConditionalFields.has(fieldName);
      if (!inTags) {
        const field = metadata.fields.find((f) => f.name === fieldName);
        if (field?.required) {
          errors.push(
            `Required field "${fieldName}" defined in metadata but not found in replacement values or template.docx`
          );
        } else {
          warnings.push(
            `Optional field "${fieldName}" defined in metadata but not found in replacement values or template.docx`
          );
        }
      }
    }

    // Check for tags not in metadata
    const controlTokens = new Set(['IF', 'END']);
    for (const tag of foundTags) {
      if (controlTokens.has(tag)) continue;
      if (!metadataFieldNames.has(tag)) {
        warnings.push(
          `Placeholder {${tag}} found in replacements/template but not defined in metadata fields`
        );
      }
    }
  } else {
    // Original behavior: scan DOCX text directly for {tags}
    const text = extractDocxText(templatePath);
    const placeholderRegex = /\{(\w+)\}/g;
    const foundTags = new Set<string>();
    let match;
    while ((match = placeholderRegex.exec(text)) !== null) {
      foundTags.add(match[1]);
    }

    const conditionalRegex = /\{IF !?(\w+)\}/g;
    const foundConditionalFields = new Set<string>();
    let condMatch;
    while ((condMatch = conditionalRegex.exec(text)) !== null) {
      foundConditionalFields.add(condMatch[1]);
    }

    // Security: scan for docx-templates control/code tags that should not exist
    // in open-source templates. Only simple {identifier} tags are allowed.
    const rawXml = extractRawDocumentXml(templatePath);
    if (rawXml) {
      scanForUnsafeTemplateTags(rawXml, errors);
    }

    // Check for fields in metadata but not in DOCX
    for (const fieldName of metadataFieldNames) {
      const inDocx = foundTags.has(fieldName) || foundConditionalFields.has(fieldName);
      if (!inDocx) {
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
    const controlTokens = new Set(['IF', 'END']);
    for (const tag of foundTags) {
      if (controlTokens.has(tag)) continue;
      if (!metadataFieldNames.has(tag)) {
        warnings.push(
          `Placeholder {${tag}} found in template.docx but not defined in metadata fields`
        );
      }
    }
  }

  return { templateId, valid: errors.length === 0, errors, warnings };
}

/**
 * Extract raw word/document.xml string from a DOCX file.
 */
function extractRawDocumentXml(docxPath: string): string | null {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return null;
  return entry.getData().toString('utf-8');
}

/** Allowed tag pattern: simple {identifier}, {IF [!]identifier}, or {END-IF}. */
const SAFE_TAG_RE = /^\{(?:[a-zA-Z_][a-zA-Z0-9_]*|IF !?[a-zA-Z_][a-zA-Z0-9_]*|END-IF)\}$/;

/**
 * Scan the raw OOXML text content for any {…} tokens and reject ones that
 * are not simple identifiers. This blocks docx-templates control tags
 * ({#if}, {/if}, {>partial}, {= expression}, etc.) that could execute
 * arbitrary code in the Node VM sandbox.
 *
 * We extract text from <w:t> elements and scan for curly-brace tokens,
 * then also check across run boundaries within paragraphs.
 */
function scanForUnsafeTemplateTags(xml: string, errors: string[]): void {
  // Extract all text content from <w:t> elements and reassemble per-paragraph
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

  const fullText = paragraphs.join('\n');

  // Find all {…} tokens in the reassembled text
  const tokenRegex = /\{[^}]+\}/g;
  let tokenMatch;
  while ((tokenMatch = tokenRegex.exec(fullText)) !== null) {
    const token = tokenMatch[0];
    if (!SAFE_TAG_RE.test(token)) {
      errors.push(
        `Unsafe template tag "${token}" found in template.docx. ` +
        `Only simple {identifier}, {IF [!]identifier}, and {END-IF} tags are allowed. ` +
        `Control tags ({#...}, {/...}, {>...}, {=...}) are not permitted in open-source templates.`
      );
    }
  }
}

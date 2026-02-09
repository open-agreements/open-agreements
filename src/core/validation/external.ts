import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateExternalMetadata, loadExternalMetadata, CleanConfigSchema } from '../metadata.js';
import { parseReplacementKey } from '../recipe/replacement-keys.js';

export interface ExternalValidationResult {
  externalId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Pattern for valid template tags within replacement values */
const TAG_RE = /\{[a-z_][a-z0-9_]*\}/g;
/** Pattern for any curly-brace token */
const ANY_BRACE_RE = /\{[^}]+\}/g;
/** Only simple identifiers inside braces are allowed */
const SAFE_TAG_RE = /^\{[a-z_][a-z0-9_]*\}$/;

/**
 * Validate an external template directory:
 * - metadata.yaml validates against ExternalMetadataSchema
 * - template.docx exists and SHA-256 matches source_sha256
 * - replacements.json is present and valid
 * - clean.json is valid if present
 * - Replacement targets reference metadata fields
 */
export function validateExternal(
  externalDir: string,
  externalId: string,
): ExternalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate metadata
  const metaResult = validateExternalMetadata(externalDir);
  if (!metaResult.valid) {
    errors.push(...metaResult.errors.map((e) => `metadata: ${e}`));
    return { externalId, valid: false, errors, warnings };
  }

  const metadata = loadExternalMetadata(externalDir);

  // Validate template.docx exists
  const docxPath = join(externalDir, 'template.docx');
  if (!existsSync(docxPath)) {
    errors.push('template.docx not found');
    return { externalId, valid: false, errors, warnings };
  }

  // SHA-256 integrity check
  const docxBuf = readFileSync(docxPath);
  const actualHash = createHash('sha256').update(docxBuf).digest('hex');
  if (actualHash !== metadata.source_sha256) {
    errors.push(
      `DOCX integrity check failed:\n` +
      `    Expected SHA-256: ${metadata.source_sha256}\n` +
      `    Actual SHA-256:   ${actualHash}`
    );
  }

  // Validate replacements.json
  const replacementsPath = join(externalDir, 'replacements.json');
  if (!existsSync(replacementsPath)) {
    errors.push('replacements.json not found (required for external templates)');
  } else {
    try {
      const raw = readFileSync(replacementsPath, 'utf-8');
      const replacements = JSON.parse(raw);
      if (typeof replacements !== 'object' || replacements === null) {
        errors.push('replacements.json must be a JSON object');
      } else {
        const metadataFieldNames = new Set(metadata.fields.map((f) => f.name));

        for (const [key, value] of Object.entries(replacements)) {
          if (typeof value !== 'string') {
            errors.push(`replacements.json: value for "${key}" must be a string`);
            continue;
          }

          const tags = value.match(TAG_RE);
          if (!tags || tags.length === 0) {
            errors.push(
              `replacements.json: value for "${key}" must contain at least one {identifier} tag, got "${value}"`
            );
          }

          const allBraces = value.match(ANY_BRACE_RE);
          if (allBraces) {
            for (const token of allBraces) {
              if (!SAFE_TAG_RE.test(token)) {
                errors.push(
                  `replacements.json: unsafe tag "${token}" in value for "${key}". Only {identifier} tags allowed.`
                );
              }
            }
          }

          // For qualified keys, check against the searchText, not the full key.
          // Nth keys use single-shot replacement so they can't loop — skip the check.
          const parsed = parseReplacementKey(key, value);
          if (parsed.type === 'simple' && value.includes(parsed.searchText)) {
            errors.push(
              `replacements.json: value for "${key}" contains the key itself (would cause infinite loop)`
            );
          } else if (parsed.type === 'context' && value.includes(parsed.searchText)) {
            errors.push(
              `replacements.json: value for "${key}" contains the search text "${parsed.searchText}" (would cause infinite loop)`
            );
          }
          // nth keys: no infinite-loop check needed (single-shot replacement)

          // Check field coverage
          if (tags) {
            for (const tag of tags) {
              const fieldName = tag.slice(1, -1);
              if (!metadataFieldNames.has(fieldName)) {
                warnings.push(`Replacement target {${fieldName}} not found in metadata fields`);
              }
            }
          }
        }
      }
    } catch (err) {
      errors.push(`replacements.json: ${(err as Error).message}`);
    }
  }

  // Validate clean.json if present
  const cleanPath = join(externalDir, 'clean.json');
  if (existsSync(cleanPath)) {
    try {
      const raw = readFileSync(cleanPath, 'utf-8');
      CleanConfigSchema.parse(JSON.parse(raw));
    } catch {
      errors.push('clean.json: invalid format');
    }
  }

  return { externalId, valid: errors.length === 0, errors, warnings };
}

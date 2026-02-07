import { loadMetadata } from '../metadata.js';

export interface LicenseValidationResult {
  templateId: string;
  valid: boolean;
  errors: string[];
}

/**
 * Validate that a template's license allows derivative works.
 * Templates with allow_derivatives=false cannot be filled (rendered).
 */
export function validateLicense(templateDir: string, templateId: string): LicenseValidationResult {
  const errors: string[] = [];

  let metadata;
  try {
    metadata = loadMetadata(templateDir);
  } catch (err) {
    return {
      templateId,
      valid: false,
      errors: [`Failed to load metadata: ${(err as Error).message}`],
    };
  }

  if (!metadata.allow_derivatives) {
    errors.push(
      `Template "${metadata.name}" (${metadata.license}) does not allow derivatives. ` +
      'This template cannot be used for rendering filled documents.'
    );
  }

  // CC-BY-4.0 requires attribution text
  if (metadata.license === 'CC-BY-4.0' && !metadata.attribution_text.trim()) {
    errors.push(
      'CC-BY-4.0 license requires attribution_text to be non-empty.'
    );
  }

  return { templateId, valid: errors.length === 0, errors };
}

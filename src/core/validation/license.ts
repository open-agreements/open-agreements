import { loadMetadata } from '../metadata.js';

export interface LicenseValidationResult {
  templateId: string;
  valid: boolean;
  errors: string[];
}

/**
 * Validate a template's license metadata.
 *
 * The allow_derivatives field means "the committed source DOCX must not be
 * modified" when false.  It does NOT prevent the tool from rendering filled
 * output — that decision is made by the fill command based on directory
 * context (templates/ vs external/).
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

  // CC-BY-4.0 and CC-BY-ND-4.0 require attribution text
  if (
    (metadata.license === 'CC-BY-4.0' || metadata.license === 'CC-BY-ND-4.0') &&
    !metadata.attribution_text.trim()
  ) {
    errors.push(
      `${metadata.license} license requires attribution_text to be non-empty.`
    );
  }

  return { templateId, valid: errors.length === 0, errors };
}

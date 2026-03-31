/**
 * Per-template signing configuration.
 *
 * Each template that supports signing has a `signing.yaml` that defines:
 * - Signer roles and their mapping to metadata.yaml fields
 * - Signature/date tag fields in the DOCX template
 * - Provider-specific anchor strings for each tag
 */

import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

// ─── Schema ─────────────────────────────────────────────────────────────────

export const SignerRoleSchema = z.object({
  role: z.string(),
  nameField: z.string(),
  signatureField: z.string(),
  dateField: z.string().optional(),
  routingOrder: z.number().int().positive().default(1),
});

export const ProviderAnchorsSchema = z.record(
  z.string(),                    // provider name: 'docusign', 'dropboxsign', etc.
  z.record(z.string(), z.string()),  // field → anchor string mapping
);

export const SigningConfigSchema = z.object({
  signers: z.array(SignerRoleSchema).min(1),
  providerAnchors: ProviderAnchorsSchema,
  emailSubjectTemplate: z.string().optional(),
});

export type SignerRole = z.infer<typeof SignerRoleSchema>;
export type SigningConfig = z.infer<typeof SigningConfigSchema>;

// ─── Loader ─────────────────────────────────────────────────────────────────

/**
 * Load and validate signing.yaml from a template directory.
 * Returns null if no signing.yaml exists (template doesn't support signing).
 */
export function loadSigningConfig(templateDir: string): SigningConfig | null {
  const signingPath = join(templateDir, 'signing.yaml');
  if (!existsSync(signingPath)) return null;

  const raw = readFileSync(signingPath, 'utf-8');
  const parsed = yaml.load(raw);
  return SigningConfigSchema.parse(parsed);
}

/**
 * Look up anchor strings for a specific provider.
 * Returns a map of { signatureField → anchorString }.
 */
export function getProviderAnchors(
  config: SigningConfig,
  providerName: string,
): Record<string, string> {
  const anchors = config.providerAnchors[providerName];
  if (!anchors) {
    throw new Error(
      `No anchor configuration for provider "${providerName}". ` +
      `Available providers: ${Object.keys(config.providerAnchors).join(', ')}`,
    );
  }
  return anchors;
}

/**
 * Get all signature/date tag field names from the signing config.
 * These are the {tag} names that should exist in the DOCX template.
 */
export function getSignatureTagFields(config: SigningConfig): string[] {
  const fields: string[] = [];
  for (const signer of config.signers) {
    fields.push(signer.signatureField);
    if (signer.dateField) {
      fields.push(signer.dateField);
    }
  }
  return fields;
}

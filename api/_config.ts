/**
 * Shared configuration constants for all API endpoints.
 * Single source of truth for OA origin, DocuSign settings, and common helpers.
 */

import type { HttpRequest } from './_http-types.js';

// ── OA Identity ─────────────────────────────────────────────────────────────

export const OA_ORIGIN = process.env.OA_ORIGIN?.trim() || 'https://openagreements.org';
export const MCP_RESOURCE = `${OA_ORIGIN}/api/mcp`;

// ── DocuSign ────────────────────────────────────────────────────────────────

export const DOCUSIGN_AUTH_BASE = (process.env.OA_DOCUSIGN_SANDBOX?.trim() === 'false')
  ? 'https://account.docusign.com'
  : 'https://account-d.docusign.com';

export const DS_REDIRECT_URI =
  process.env.OA_DOCUSIGN_REDIRECT_URI?.trim() || `${OA_ORIGIN}/api/auth/docusign/callback`;

export const INTEGRATION_KEY = process.env.OA_DOCUSIGN_INTEGRATION_KEY?.trim() || '';
export const SECRET_KEY = process.env.OA_DOCUSIGN_SECRET_KEY?.trim() || '';

/**
 * Returns true iff the minimum environment required to advertise MCP signing
 * tools is present. Capability-surface check, not a full readiness check — GCP
 * ADC, Firestore/GCS permissions, bucket existence, and malformed
 * OA_GCLOUD_ENCRYPTION_KEY hex can still cause runtime failures. Gates MCP tool
 * advertisement and the call-time signing-context init in api/mcp.ts; the OAuth
 * connect/callback flow has its own, different minimum requirements.
 *
 * Reads process.env live (not the module-level INTEGRATION_KEY/SECRET_KEY
 * constants) so tests can stub env vars without import-time snapshotting.
 */
export function isMcpSigningConfigured(): boolean {
  return Boolean(
    process.env.OA_DOCUSIGN_INTEGRATION_KEY?.trim() &&
    process.env.OA_DOCUSIGN_SECRET_KEY?.trim() &&
    process.env.OA_GCLOUD_ENCRYPTION_KEY?.trim(),
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Extract a single query parameter from a Vercel request. */
export function getQuery(req: HttpRequest, key: string): string | undefined {
  const val = req.query?.[key];
  return Array.isArray(val) ? val[0] : val;
}

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

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Extract a single query parameter from a Vercel request. */
export function getQuery(req: HttpRequest, key: string): string | undefined {
  const val = req.query?.[key];
  return Array.isArray(val) ? val[0] : val;
}

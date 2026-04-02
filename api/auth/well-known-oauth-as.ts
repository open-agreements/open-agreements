/**
 * RFC 8414 — Authorization Server Metadata
 * GET /.well-known/oauth-authorization-server
 *
 * Tells MCP clients where to register, authorize, and exchange tokens.
 * Routed via vercel.json rewrite from /.well-known/oauth-authorization-server
 */

import type { HttpRequest, HttpResponse } from '../_http-types.js';

const OA_ORIGIN = process.env.OA_ORIGIN?.trim() || 'https://openagreements.org';

const metadata = {
  issuer: OA_ORIGIN,
  authorization_endpoint: `${OA_ORIGIN}/api/auth/authorize`,
  token_endpoint: `${OA_ORIGIN}/api/auth/token`,
  registration_endpoint: `${OA_ORIGIN}/api/auth/register`,
  revocation_endpoint: `${OA_ORIGIN}/api/auth/revoke`,
  jwks_uri: `${OA_ORIGIN}/api/auth/jwks`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
  revocation_endpoint_auth_methods_supported: ['none'],
  scopes_supported: ['signing'],
};

export default function handler(_req: HttpRequest, res: HttpResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(metadata);
}

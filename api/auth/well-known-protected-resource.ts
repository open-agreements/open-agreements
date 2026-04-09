/**
 * RFC 9728 — Protected Resource Metadata
 * GET /.well-known/oauth-protected-resource
 *
 * Tells MCP clients that this resource server uses OA as its authorization server.
 * Routed via vercel.json rewrite from /.well-known/oauth-protected-resource
 */

import type { HttpRequest, HttpResponse } from '../_http-types.js';
import { OA_ORIGIN, MCP_RESOURCE } from '../_config.js';

const metadata = {
  resource: MCP_RESOURCE,
  authorization_servers: [OA_ORIGIN],
  scopes_supported: ['signing'],
  bearer_methods_supported: ['header'],
};

export default function handler(_req: HttpRequest, res: HttpResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(metadata);
}

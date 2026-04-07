/**
 * JWKS endpoint — serves the public key for JWT verification.
 * GET /api/auth/jwks
 */

import type { HttpRequest, HttpResponse } from '../_http-types.js';
import { getJwks } from './_keys.js';

export default async function handler(_req: HttpRequest, res: HttpResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/json');

  try {
    const jwks = await getJwks();
    res.status(200).json(jwks);
  } catch (e) {
    res.status(500).json({ error: 'JWKS not configured', message: (e as Error).message });
  }
}

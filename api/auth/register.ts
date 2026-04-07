/**
 * RFC 7591 — Dynamic Client Registration
 * POST /api/auth/register
 *
 * MCP clients register themselves before initiating OAuth.
 * Stores client metadata in Firestore with 90-day inactivity TTL.
 */

import type { HttpRequest, HttpResponse } from '../_http-types.js';
import { randomUUID, randomBytes } from 'node:crypto';
import { getDb } from './_db.js';

const ALLOWED_HTTPS_HOSTS = new Set([
  'claude.ai',
  'claude.com',
]);

function isValidRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    // Allow any localhost/loopback (port-agnostic per RFC 8252 §7.3)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return parsed.protocol === 'http:';
    }
    // Allow pre-approved HTTPS hosts
    if (ALLOWED_HTTPS_HOSTS.has(parsed.hostname)) {
      return parsed.protocol === 'https:';
    }
    return false;
  } catch {
    return false;
  }
}

export default async function handler(req: HttpRequest, res: HttpResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'invalid_request', error_description: 'POST only' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const redirectUris: string[] = body.redirect_uris;
    if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'redirect_uris is required and must be a non-empty array',
      });
      return;
    }

    // Validate each redirect URI
    for (const uri of redirectUris) {
      if (!isValidRedirectUri(uri)) {
        res.status(400).json({
          error: 'invalid_redirect_uri',
          error_description: `Invalid redirect URI: ${uri}. Must be http://localhost:*, http://127.0.0.1:*, or an approved HTTPS host.`,
        });
        return;
      }
    }

    const clientId = `oa-${randomUUID()}`;
    const clientName = body.client_name || 'Unknown MCP Client';
    const grantTypes = body.grant_types || ['authorization_code', 'refresh_token'];
    const now = new Date().toISOString();

    const db = await getDb();
    await db.collection('oauth_clients').doc(clientId).set({
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      response_types: body.response_types || ['code'],
      token_endpoint_auth_method: 'none', // public client
      created_at: now,
      last_used_at: now,
    });

    res.status(201).json({
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
  } catch (e) {
    console.error('DCR error:', e);
    res.status(500).json({
      error: 'server_error',
      error_description: (e as Error).message,
    });
  }
}

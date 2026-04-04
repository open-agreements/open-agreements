/**
 * OAuth Token Revocation + DocuSign Disconnect
 * POST /api/auth/revoke
 *
 * Revokes OA tokens AND detaches the stored DocuSign connection.
 * This is the replacement for disconnect_signing_provider on the HTTP transport.
 */

import type { HttpRequest, HttpResponse } from '../_http-types.js';
import { createHash } from 'node:crypto';
import { getDb } from './_db.js';

export default async function handler(req: HttpRequest, res: HttpResponse): Promise<void> {
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
    const token = body.token;

    if (!token) {
      // RFC 7009: server MUST respond with 200 even if token is missing
      res.status(200).json({ revoked: true });
      return;
    }

    const db = await getDb();

    // Try to find the refresh token
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const tokenDoc = await db.collection('oauth_refresh_tokens').doc(tokenHash).get();

    if (tokenDoc.exists) {
      const tokenData = tokenDoc.data()!;

      // Revoke entire token family
      const familyTokens = await db.collection('oauth_refresh_tokens')
        .where('family_id', '==', tokenData.family_id)
        .get();
      const batch = db.batch();
      familyTokens.forEach(doc => batch.delete(doc.ref));

      // Also detach the DocuSign connection for this user
      const connQuery = await db.collection('signing_connections')
        .where('apiKey', '==', tokenData.sub)
        .limit(1)
        .get();
      if (!connQuery.empty) {
        batch.delete(connQuery.docs[0].ref);
      }

      await batch.commit();
    }

    // RFC 7009: always return 200, even if token wasn't found
    res.status(200).json({ revoked: true });
  } catch (e) {
    console.error('Revoke error:', e);
    // RFC 7009: still return 200 on server errors for token revocation
    res.status(200).json({ revoked: true });
  }
}

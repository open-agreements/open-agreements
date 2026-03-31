/**
 * DocuSign Connect webhook endpoint.
 *
 * POST /api/signing/webhook
 *
 * Receives envelope status events from DocuSign Connect.
 * Verifies HMAC-SHA256 signature, updates local status,
 * and fetches signed PDF on completion.
 */

import type { HttpRequest, HttpResponse } from '../_http-types.js';
import { createHmac } from 'node:crypto';

const HMAC_SECRET = process.env.OA_DOCUSIGN_HMAC_SECRET || '';

function getRawBody(req: HttpRequest): string {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
}

function getHeader(req: HttpRequest, name: string): string | undefined {
  const val = req.headers[name.toLowerCase()];
  return typeof val === 'string' ? val : undefined;
}

export default async function handler(req: HttpRequest, res: HttpResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = getRawBody(req);

  // Verify HMAC if configured
  if (HMAC_SECRET) {
    const signature = getHeader(req, 'x-docusign-signature-1');
    if (!signature) {
      res.status(401).json({ error: 'Missing HMAC signature header' });
      return;
    }

    const computed = createHmac('sha256', HMAC_SECRET)
      .update(body)
      .digest('base64');

    if (computed !== signature) {
      res.status(401).json({ error: 'Invalid HMAC signature' });
      return;
    }
  }

  try {
    const event = typeof req.body === 'object' ? req.body : JSON.parse(body);

    // Extract envelope info
    const envelopeId = (event as Record<string, unknown>).envelopeId as string;
    const status = (event as Record<string, unknown>).status as string;

    // TODO: Store status update in Firestore
    // TODO: On 'completed', fetch signed PDF and store in GCS

    console.log(`[webhook] Envelope ${envelopeId}: ${status}`);

    res.status(200).json({ received: true, envelopeId, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: 'Invalid webhook payload', details: message });
  }
}

/**
 * Stateless DOCX download endpoint.
 * Verifies a signed token, re-generates the filled template, and serves
 * the DOCX as a browser download. No storage required — the token carries
 * all parameters and expires after 1 hour.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseDownloadToken, handleFill, DOCX_MIME } from './_shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET requests are accepted' });
  }

  const token = req.query['token'];
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing "token" query parameter' });
  }

  const payload = parseDownloadToken(token);
  if (!payload) {
    return res.status(403).json({ error: 'Invalid or expired download link. Please generate a new one.' });
  }

  const outcome = await handleFill(payload.t, payload.v);
  if (!outcome.ok) {
    return res.status(500).json({ error: outcome.error });
  }

  const filename = `${payload.t}.docx`;
  const docxBuffer = Buffer.from(outcome.base64, 'base64');

  res.setHeader('Content-Type', DOCX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', docxBuffer.length);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(docxBuffer);
}

/**
 * DOCX download endpoint.
 * Resolves a signed opaque download ID from TTL-backed storage, re-generates
 * the filled template, and serves the DOCX as a browser download.
 */

import type { HttpRequest, HttpResponse } from './_http-types.js';
import { resolveDownloadArtifact, handleFill, DOCX_MIME } from './_shared.js';

type DownloadHttpErrorCode =
  | 'DOWNLOAD_ID_MISSING'
  | 'DOWNLOAD_ID_MALFORMED'
  | 'DOWNLOAD_SIGNATURE_INVALID'
  | 'DOWNLOAD_EXPIRED'
  | 'DOWNLOAD_NOT_FOUND'
  | 'DOWNLOAD_RENDER_FAILED';

function sendDownloadError(
  req: HttpRequest,
  res: HttpResponse,
  status: number,
  code: DownloadHttpErrorCode,
  message: string,
) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Download-Error-Code', code);
  if (req.method === 'HEAD') {
    return res.status(status).end();
  }
  return res.status(status).json({
    error: {
      code,
      message,
    },
  });
}

function mapResolveErrorToHttp(
  code: 'DOWNLOAD_ID_MALFORMED' | 'DOWNLOAD_SIGNATURE_INVALID' | 'DOWNLOAD_EXPIRED' | 'DOWNLOAD_NOT_FOUND',
): { status: number; code: DownloadHttpErrorCode; message: string } {
  switch (code) {
    case 'DOWNLOAD_ID_MALFORMED':
      return {
        status: 400,
        code: 'DOWNLOAD_ID_MALFORMED',
        message: 'Download ID is malformed.',
      };
    case 'DOWNLOAD_SIGNATURE_INVALID':
      return {
        status: 403,
        code: 'DOWNLOAD_SIGNATURE_INVALID',
        message: 'Download ID signature is invalid.',
      };
    case 'DOWNLOAD_EXPIRED':
      return {
        status: 410,
        code: 'DOWNLOAD_EXPIRED',
        message: 'Download link has expired. Please generate a new one.',
      };
    case 'DOWNLOAD_NOT_FOUND':
      return {
        status: 404,
        code: 'DOWNLOAD_NOT_FOUND',
        message: 'Download link not found. Please generate a new one.',
      };
    default:
      return {
        status: 400,
        code: 'DOWNLOAD_ID_MALFORMED',
        message: 'Download ID is malformed.',
      };
  }
}

export default async function handler(req: HttpRequest, res: HttpResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET and HEAD requests are accepted',
      },
    });
  }

  const id = req.query['id'];
  if (!id || typeof id !== 'string') {
    return sendDownloadError(req, res, 400, 'DOWNLOAD_ID_MISSING', 'Missing "id" query parameter.');
  }

  const resolved = await resolveDownloadArtifact(id);
  if (!resolved.ok) {
    const mapped = mapResolveErrorToHttp(resolved.code);
    return sendDownloadError(req, res, mapped.status, mapped.code, mapped.message);
  }

  const outcome = await handleFill(resolved.artifact.template, resolved.artifact.values);
  if (!outcome.ok) {
    return sendDownloadError(req, res, 500, 'DOWNLOAD_RENDER_FAILED', outcome.error);
  }

  const filename = `${resolved.artifact.template}.docx`;
  const docxBuffer = Buffer.from(outcome.base64, 'base64');

  res.setHeader('Content-Type', DOCX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', docxBuffer.length);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }
  return res.status(200).send(docxBuffer);
}

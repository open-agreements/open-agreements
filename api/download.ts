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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function acceptsHtml(req: HttpRequest): boolean {
  const raw = req.headers.accept;
  if (!raw) return false;
  const accept = Array.isArray(raw) ? raw.join(',') : raw;
  return /\btext\/html\b/i.test(accept);
}

function renderDownloadErrorHtml(code: DownloadHttpErrorCode, message: string, status: number): string {
  const title = code === 'DOWNLOAD_EXPIRED' || code === 'DOWNLOAD_NOT_FOUND'
    ? 'Download Link Unavailable'
    : 'Download Error';
  const actionCopy = code === 'DOWNLOAD_EXPIRED' || code === 'DOWNLOAD_NOT_FOUND'
    ? 'Please generate a fresh document link and try again.'
    : 'Please try generating the document again.';
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeCode = escapeHtml(code);
  const safeAction = escapeHtml(actionCopy);
  const safeStatus = escapeHtml(String(status));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      background: #f4f6f8;
      color: #1d2021;
      font-family: "Avenir Next", Avenir, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(560px, 100%);
      background: #ffffff;
      border: 1px solid #d9dee3;
      border-radius: 14px;
      box-shadow: 0 10px 28px rgba(16, 24, 40, 0.08);
      padding: 24px;
    }
    h1 { margin: 0 0 10px; font-size: 24px; line-height: 1.2; }
    p { margin: 0 0 10px; line-height: 1.45; color: #3a3f43; }
    .meta { margin-top: 14px; font-size: 13px; color: #6a7075; }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      background: #f0f2f5;
      border-radius: 6px;
      padding: 2px 6px;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <p>${safeAction}</p>
    <p class="meta">Error code: <code>${safeCode}</code> · HTTP ${safeStatus}</p>
  </main>
</body>
</html>`;
}

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
  if (acceptsHtml(req)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(status).send(renderDownloadErrorHtml(code, message, status));
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

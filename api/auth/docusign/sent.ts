/**
 * Post-send redirect handler for DocuSign.
 *
 * GET /api/auth/docusign/sent?envelopeId=<id>&event=Send
 *
 * DocuSign redirects here after the user clicks "Send" in the sender view.
 * Shows a confirmation page — no server-side processing needed.
 */

import type { HttpRequest, HttpResponse } from '../../_http-types.js';

function getQuery(req: HttpRequest, key: string): string | undefined {
  const val = req.query[key];
  return Array.isArray(val) ? val[0] : val;
}

export default function handler(req: HttpRequest, res: HttpResponse): void {
  const envelopeId = getQuery(req, 'envelopeId') || 'unknown';
  const event = getQuery(req, 'event') || 'unknown';

  const isSuccess = event === 'Send';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${isSuccess ? 'Agreement Sent' : 'DocuSign'} — OpenAgreements</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f0e8;
      color: #142023;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .card {
      background: #fff;
      border: 1px solid #d2c2ae;
      border-radius: 8px;
      padding: 40px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${isSuccess ? '#1a7a4c' : '#be4b2f'};
      color: #fff;
      font-size: 28px;
      line-height: 56px;
      margin: 0 auto 20px;
    }
    h1 { font-size: 1.3rem; margin: 0 0 12px; }
    p { color: #334348; line-height: 1.5; margin: 0 0 8px; }
    .subtle { font-size: 0.85rem; color: #667; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? '&#10003;' : '&#10005;'}</div>
    <h1>${isSuccess ? 'Agreement Sent for Signature' : 'DocuSign Event'}</h1>
    ${isSuccess
      ? '<p>Your agreement has been sent to all recipients. They will receive an email with a link to sign.</p><p>You can close this window and return to your conversation. Use <strong>check_signature_status</strong> to track progress.</p>'
      : `<p>DocuSign event: ${event}</p>`
    }
    <p class="subtle">Envelope ID: ${envelopeId}</p>
  </div>
</body>
</html>`);
}

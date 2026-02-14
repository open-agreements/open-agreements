/**
 * A2A (Agent-to-Agent) protocol endpoint.
 * JSON-RPC 2.0 with message/send routing to fill-template and list-templates skills.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { handleFill, handleListTemplates, DOCX_MIME } from './_shared.js';

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json(jsonRpcError(null, -32600, 'Only POST requests are accepted'));
  }

  const body = req.body as { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };

  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return res.status(200).json(jsonRpcError(body?.id, -32600, 'Invalid JSON-RPC 2.0 request'));
  }

  if (body.method !== 'message/send') {
    return res.status(200).json(
      jsonRpcError(body.id, -32601, `Method not supported: "${body.method}". Only "message/send" is supported.`),
    );
  }

  // Extract skill from message parts
  const params = body.params as { message?: { parts?: { type: string; data?: Record<string, unknown> }[] } } | undefined;
  const parts = params?.message?.parts;
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return res.status(200).json(jsonRpcError(body.id, -32602, 'Missing message parts'));
  }
  const dataPart = parts.find((p) => p.type === 'data' && p.data);
  if (!dataPart?.data) {
    return res.status(200).json(jsonRpcError(body.id, -32602, 'No data part found in message'));
  }

  const skill = dataPart.data.skill as string | undefined;

  try {
    if (skill === 'list-templates') {
      const { cliVersion, items } = handleListTemplates();
      return res.status(200).json(jsonRpcResult(body.id, {
        id: `task-${randomUUID()}`,
        status: { state: 'completed' },
        artifacts: [{ parts: [{ type: 'data', data: { schema_version: 1, cli_version: cliVersion, items } }] }],
        metadata: {},
      }));
    }

    if (skill === 'fill-template') {
      const template = dataPart.data.template as string | undefined;
      if (!template || typeof template !== 'string') {
        return res.status(200).json(jsonRpcError(body.id, -32602, 'Missing "template" field in data part'));
      }
      const outcome = await handleFill(template, (dataPart.data.values as Record<string, string>) ?? {});
      if (!outcome.ok) {
        return res.status(200).json(jsonRpcResult(body.id, {
          id: `task-${randomUUID()}`, status: { state: 'failed', message: outcome.error }, artifacts: [], metadata: {},
        }));
      }
      return res.status(200).json(jsonRpcResult(body.id, {
        id: `task-${randomUUID()}`,
        status: { state: 'completed' },
        artifacts: [{ parts: [{ type: 'data', data: { mimeType: DOCX_MIME, inlineData: outcome.base64 } }] }],
        metadata: outcome.metadata,
      }));
    }

    return res.status(200).json(
      jsonRpcError(body.id, -32602, `Unknown skill: "${skill}". Supported: "fill-template", "list-templates".`),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(200).json(jsonRpcResult(body.id, {
      id: `task-${randomUUID()}`, status: { state: 'failed', message: `Internal error: ${message}` }, artifacts: [], metadata: {},
    }));
  }
}

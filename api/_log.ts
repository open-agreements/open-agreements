/**
 * Structured logging helper for HTTP API endpoints (Vercel).
 *
 * Emits single-line JSON records to stdout (info) or stderr (error). Vercel
 * preserves log level by stream, and `vercel logs` plus downstream drains
 * (Axiom, Datadog) filter on it — collapsing every record onto stderr would
 * make normal request traces look like failures.
 *
 * HTTP-only: this module is never imported by `src/` or `bin/`; the CLI is
 * unaffected.
 */

import { createHash } from 'node:crypto';
import type { HttpRequest } from './_http-types.js';

export type RequestContext = {
  vercelId?: string;
  mcpSessionId?: string;
  userAgent?: string;
  baseUrl: string;
};

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Read correlation headers and derive baseUrl. Returns the request-scoped
 * context that callers thread through their handlers.
 *
 * `vercelId` is omitted (not synthesized) when `x-vercel-id` is absent —
 * fabricating a fallback id muddies log search and creates a false sense of
 * correlation. Locally and in tests, the field simply isn't there.
 */
export function getRequestContext(req: HttpRequest): RequestContext {
  const proto = firstString(req.headers['x-forwarded-proto']) ?? 'https';
  const host =
    firstString(req.headers['x-forwarded-host']) ??
    firstString(req.headers['host']) ??
    'openagreements.org';
  const baseUrl = `${proto}://${host}`;

  const ctx: RequestContext = { baseUrl };

  const vercelId = firstString(req.headers['x-vercel-id']);
  if (vercelId) ctx.vercelId = vercelId;

  const mcpSessionId = firstString(req.headers['mcp-session-id']);
  if (mcpSessionId) ctx.mcpSessionId = mcpSessionId;

  const userAgent = firstString(req.headers['user-agent']);
  if (userAgent) ctx.userAgent = userAgent;

  return ctx;
}

/**
 * Fingerprint a Bearer token for log correlation without leaking the secret.
 * Used only on auth-denied paths — never on successful auth, since
 * fingerprinting on success expands the redaction surface without
 * proportional debugging value.
 *
 * Returns `null` when the header is missing or not a Bearer token, so the
 * caller can spread `...redactBearer(...)` safely (a null spread is a no-op,
 * keeping the log record free of empty fields).
 */
export function redactBearer(
  authHeader: string | string[] | undefined,
): { tokenFp: string } | null {
  const header = firstString(authHeader);
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;
  return { tokenFp: createHash('sha256').update(token).digest('hex').slice(0, 12) };
}

/**
 * Normalize an unknown thrown value into a JSON-serializable shape.
 * Raw `Error` instances serialize to `{}` via `JSON.stringify`, which is why
 * the previous `console.error({ err })` callsites lost their detail on Vercel.
 */
export function normalizeError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: 'NonError', message: String(err) };
}

function emit(stream: 'log' | 'error', level: 'info' | 'error', record: Record<string, unknown>): void {
  const payload = { level, ts: new Date().toISOString(), ...record };
  // Single-line JSON. Vercel captures stdout/stderr line-by-line.
  // eslint-disable-next-line no-console
  console[stream](JSON.stringify(payload));
}

export function info(record: Record<string, unknown>): void {
  emit('log', 'info', record);
}

export function error(record: Record<string, unknown>): void {
  emit('error', 'error', record);
}

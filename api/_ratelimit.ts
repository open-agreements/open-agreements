/**
 * Per-IP fixed-window rate limiter for the public MCP endpoint.
 *
 * Backend: Upstash Redis via REST `/multi-exec` (atomic INCR + PEXPIRE in one
 * round trip). No new npm dependency — mirrors the fetch pattern used by
 * `_download-artifacts.ts`.
 *
 * Failure policy:
 * - Dev/test (no env vars): disabled, returns `{ configured: false }`. Quiet.
 * - Prod env vars set but Redis throws: fail open with `console.warn` once per
 *   request. A Redis blip should not take down a public endpoint.
 * - Prod (`VERCEL_ENV=production|preview`) with env vars *missing entirely*:
 *   loud `console.error` on every request. Still fails open — refusing all
 *   traffic because the limiter can't run is worse than the abuse it mitigates.
 *   Hardening into a deploy-time check is a follow-up.
 *
 * IP source on Vercel: `x-vercel-forwarded-for` is the only header set entirely
 * by Vercel's edge and not appendable by the client. `x-forwarded-for` may be
 * client-spoofed at the first hop on Vercel, so it is the *last* fallback.
 */

import type { HttpRequest } from './_http-types.js';

export const DEFAULT_GLOBAL_LIMIT = 600;
export const DEFAULT_FILL_LIMIT = 120;
const DEFAULT_WINDOW_MS = 60_000;
const KEY_PREFIX = 'oa:rl:';

export type RateLimitBucket = string;

export type RateLimitState =
  | { configured: false }
  | {
      configured: true;
      allowed: boolean;
      bucket: RateLimitBucket;
      limit: number;
      remaining: number;
      reset_at: string;
    };

export interface RateLimiter {
  check(bucket: RateLimitBucket, ip: string, limit: number): Promise<RateLimitState>;
  readonly mode: 'upstash' | 'disabled';
}

export interface InitRateLimiterDeps {
  /** Override the logger; defaults to `console`. Tests can pass a quiet stub. */
  log?: Pick<Console, 'log' | 'warn' | 'error'>;
  /** Inject an alternate fetch implementation (tests). */
  fetchImpl?: typeof fetch;
  /** Override the window length (tests). */
  windowMs?: number;
}

function isProductionLikeServerless(env: NodeJS.ProcessEnv): boolean {
  return env['VERCEL_ENV'] === 'production' || env['VERCEL_ENV'] === 'preview';
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Extract client IP using the trusted-header order documented above.
 * Returns `'unknown'` (not null) so the limiter still meaningfully caps
 * degenerate cases — one shared bucket is still a bucket.
 */
export function getClientIp(req: HttpRequest): string {
  const vercel = firstHeader(req.headers['x-vercel-forwarded-for']);
  if (vercel) {
    const trimmed = vercel.trim();
    if (trimmed) return trimmed;
  }

  const realIp = firstHeader(req.headers['x-real-ip']);
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }

  const xff = firstHeader(req.headers['x-forwarded-for']);
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  return 'unknown';
}

class DisabledRateLimiter implements RateLimiter {
  readonly mode = 'disabled';
  async check(): Promise<RateLimitState> {
    return { configured: false };
  }
}

class UpstashRateLimiter implements RateLimiter {
  readonly mode = 'upstash';
  constructor(
    private readonly restUrl: string,
    private readonly restToken: string,
    private readonly windowMs: number,
    private readonly fetchImpl: typeof fetch,
    private readonly log: Pick<Console, 'log' | 'warn' | 'error'>,
  ) {}

  async check(bucket: RateLimitBucket, ip: string, limit: number): Promise<RateLimitState> {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const resetAtMs = windowStart + this.windowMs;
    const key = `${KEY_PREFIX}${bucket}:${windowStart}:${ip}`;

    let count: number;
    try {
      count = await this.multiExec(key);
    } catch (cause) {
      // Fail open. One warn per failed call so the operator sees the rate but
      // doesn't drown if Upstash is down for an extended outage.
      this.log.warn(JSON.stringify({
        event: 'rate_limit_runtime_error',
        bucket,
        reason: cause instanceof Error ? cause.message : String(cause),
      }));
      return { configured: false };
    }

    const remaining = Math.max(0, limit - count);
    const allowed = count <= limit;
    return {
      configured: true,
      allowed,
      bucket,
      limit,
      remaining: allowed ? remaining : 0,
      reset_at: new Date(resetAtMs).toISOString(),
    };
  }

  private async multiExec(key: string): Promise<number> {
    const url = `${stripTrailingSlash(this.restUrl)}/multi-exec`;
    const body: string[][] = [
      ['INCR', key],
      ['PEXPIRE', key, String(this.windowMs)],
    ];

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.restToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Upstash multi-exec failed: HTTP ${response.status}`);
    }

    // Upstash transaction response shape: [{ result: <INCR-count> }, { result: 1 }]
    // or { result: [{...}, {...}] } depending on the endpoint variant. Handle both.
    const payload = await response.json() as
      | Array<{ result?: unknown; error?: string }>
      | { result?: Array<{ result?: unknown; error?: string }>; error?: string };

    let entries: Array<{ result?: unknown; error?: string }>;
    if (Array.isArray(payload)) {
      entries = payload;
    } else if (payload && Array.isArray(payload.result)) {
      entries = payload.result;
    } else {
      throw new Error('Upstash multi-exec returned unexpected shape');
    }

    if (!entries[0] || entries[0].error) {
      throw new Error(`Upstash INCR failed: ${entries[0]?.error ?? 'no result'}`);
    }
    const incrResult = entries[0].result;
    if (typeof incrResult !== 'number') {
      throw new Error(`Upstash INCR returned non-number: ${typeof incrResult}`);
    }
    return incrResult;
  }
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Pure initializer: chooses a rate-limiter backend based on env without
 * touching module-scoped state. Returns the limiter (no throw — the limiter is
 * a perimeter control where fail-closed is worse than the threat it mitigates).
 *
 * Policy:
 * - Upstash REST vars present → `upstash` mode.
 * - Vars missing in production-like serverless (VERCEL_ENV=production|preview)
 *   → `disabled` mode + loud `console.error` (one record per init).
 * - Vars missing in dev/test → `disabled` mode, quiet.
 */
export function initRateLimiter(
  env: NodeJS.ProcessEnv = process.env,
  deps: InitRateLimiterDeps = {},
): RateLimiter {
  const log = deps.log ?? console;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const windowMs = deps.windowMs ?? DEFAULT_WINDOW_MS;

  const restUrl = env['KV_REST_API_URL'] ?? env['UPSTASH_REDIS_REST_URL'];
  const restToken = env['KV_REST_API_TOKEN'] ?? env['UPSTASH_REDIS_REST_TOKEN'];

  if (restUrl && restToken) {
    log.log(JSON.stringify({
      event: 'rate_limiter_init',
      mode: 'upstash',
      node_env: env['NODE_ENV'] ?? null,
      vercel_env: env['VERCEL_ENV'] ?? null,
    }));
    return new UpstashRateLimiter(restUrl, restToken, windowMs, fetchImpl, log);
  }

  if (isProductionLikeServerless(env)) {
    log.error(JSON.stringify({
      event: 'rate_limiter_init',
      mode: 'disabled',
      reason: 'durable_store_required_but_unconfigured',
      node_env: env['NODE_ENV'] ?? null,
      vercel_env: env['VERCEL_ENV'] ?? null,
      warning: 'KV_REST_API_URL/KV_REST_API_TOKEN missing in production-like environment. '
        + 'Public endpoint runs without rate limiting until configured.',
    }));
  } else {
    log.log(JSON.stringify({
      event: 'rate_limiter_init',
      mode: 'disabled',
      node_env: env['NODE_ENV'] ?? null,
      vercel_env: env['VERCEL_ENV'] ?? null,
    }));
  }

  return new DisabledRateLimiter();
}

let cachedLimiter: RateLimiter | null = null;

function getRateLimiter(): RateLimiter {
  if (cachedLimiter) return cachedLimiter;
  cachedLimiter = initRateLimiter();
  return cachedLimiter;
}

/**
 * Test-only: clears the cached singleton so a subsequent call rebuilds against
 * a different env. Mirror of `_resetDownloadArtifactStoreCacheForTests`.
 */
export function _resetRateLimiterCacheForTests(next?: RateLimiter): void {
  cachedLimiter = next ?? null;
}

/**
 * Public entry point used by request handlers.
 * Throws nothing — fail-open is enforced inside the limiter.
 */
export async function checkRateLimit(
  bucket: RateLimitBucket,
  ip: string,
  limit: number,
): Promise<RateLimitState> {
  return getRateLimiter().check(bucket, ip, limit);
}

/**
 * Combine multiple rate-limit states into the one a client should see in the
 * envelope. Picks the binding bucket: any blocked bucket wins; otherwise the
 * one with the lowest `remaining`. Returns `{ configured: false }` only when
 * *all* states are unconfigured — a partial outcome (one configured, one not)
 * still surfaces the configured one so clients see truthful data.
 */
export function combineState(...states: RateLimitState[]): RateLimitState {
  const configured = states.filter((s): s is Extract<RateLimitState, { configured: true }> =>
    s.configured === true);
  if (configured.length === 0) return { configured: false };

  const blocked = configured.find((s) => !s.allowed);
  if (blocked) return blocked;

  return configured.reduce((tightest, s) => (s.remaining < tightest.remaining ? s : tightest));
}

/**
 * Read environment-overridable thresholds. Falls back to documented defaults
 * if the override is missing or invalid.
 */
export function readGlobalLimit(env: NodeJS.ProcessEnv = process.env): number {
  return parsePositiveInt(env['OA_MCP_RATE_LIMIT_GLOBAL']) ?? DEFAULT_GLOBAL_LIMIT;
}

export function readFillLimit(env: NodeJS.ProcessEnv = process.env): number {
  return parsePositiveInt(env['OA_MCP_RATE_LIMIT_FILL']) ?? DEFAULT_FILL_LIMIT;
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

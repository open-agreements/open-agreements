/**
 * Unit tests for the per-IP rate limiter at the Upstash REST boundary.
 *
 * These mock the `fetch` layer (not the `checkRateLimit` helper) so they
 * exercise env precedence, IP-header parsing, multi-exec request shape, and
 * the configured/disabled/fail-open branches.
 */

import { describe, expect, vi } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import {
  combineState,
  getClientIp,
  initRateLimiter,
  type RateLimitState,
} from '../api/_ratelimit.js';

const it = itAllure.epic('Platform & Distribution');

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function createFetchSpy(makeResponse: () => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return makeResponse();
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function quietLog() {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('getClientIp header precedence', () => {
  it.openspec('OA-DST-049')('prefers x-vercel-forwarded-for over all other sources', () => {
    const ip = getClientIp({
      headers: {
        'x-vercel-forwarded-for': '8.8.8.8',
        'x-real-ip': '9.9.9.9',
        'x-forwarded-for': '1.1.1.1, 2.2.2.2',
      },
      query: {},
    });
    expect(ip).toBe('8.8.8.8');
  });

  it.openspec('OA-DST-049')('falls back to x-real-ip when x-vercel-forwarded-for is absent', () => {
    const ip = getClientIp({
      headers: {
        'x-real-ip': '9.9.9.9',
        'x-forwarded-for': '1.1.1.1',
      },
      query: {},
    });
    expect(ip).toBe('9.9.9.9');
  });

  it.openspec('OA-DST-049')('uses first comma-separated entry of x-forwarded-for as last resort', () => {
    const ip = getClientIp({
      headers: { 'x-forwarded-for': '  1.1.1.1 ,  2.2.2.2 ' },
      query: {},
    });
    expect(ip).toBe('1.1.1.1');
  });

  it.openspec('OA-DST-049')('returns "unknown" when no IP-like header is present', () => {
    const ip = getClientIp({ headers: {}, query: {} });
    expect(ip).toBe('unknown');
  });

  it.openspec('OA-DST-049')('ignores spoofed x-forwarded-for when x-vercel-forwarded-for is set', () => {
    const ip = getClientIp({
      headers: {
        'x-vercel-forwarded-for': '203.0.113.10',
        'x-forwarded-for': 'attacker-spoof, 203.0.113.10',
      },
      query: {},
    });
    expect(ip).toBe('203.0.113.10');
  });
});

describe('initRateLimiter env policy', () => {
  it.openspec('OA-DST-050')('returns disabled limiter when env vars are unset (dev)', async () => {
    const log = quietLog();
    const fetchSpy = createFetchSpy(() => jsonResponse([]));
    const limiter = initRateLimiter(
      { NODE_ENV: 'test' },
      { log, fetchImpl: fetchSpy.impl },
    );
    expect(limiter.mode).toBe('disabled');
    const state = await limiter.check('mcp:global', '1.2.3.4', 100);
    expect(state).toEqual({ configured: false });
    expect(fetchSpy.calls).toHaveLength(0);
    expect(log.error).not.toHaveBeenCalled();
  });

  it.openspec('OA-DST-050')('logs loud error when env vars are missing in production', async () => {
    const log = quietLog();
    const fetchSpy = createFetchSpy(() => jsonResponse([]));
    const limiter = initRateLimiter(
      { VERCEL_ENV: 'production' },
      { log, fetchImpl: fetchSpy.impl },
    );
    expect(limiter.mode).toBe('disabled');
    expect(log.error).toHaveBeenCalledTimes(1);
    const errorPayload = JSON.parse(String((log.error as ReturnType<typeof vi.fn>).mock.calls[0][0]));
    expect(errorPayload.event).toBe('rate_limiter_init');
    expect(errorPayload.reason).toBe('durable_store_required_but_unconfigured');
    expect(errorPayload.vercel_env).toBe('production');
  });

  it.openspec('OA-DST-050')('prefers KV_REST_API_* over UPSTASH_REDIS_REST_*', async () => {
    const log = quietLog();
    const fetchSpy = createFetchSpy(() =>
      jsonResponse([{ result: 1 }, { result: 1 }]),
    );
    const limiter = initRateLimiter(
      {
        KV_REST_API_URL: 'https://kv.example.com',
        KV_REST_API_TOKEN: 'kv-token',
        UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
        UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
      },
      { log, fetchImpl: fetchSpy.impl },
    );
    expect(limiter.mode).toBe('upstash');
    await limiter.check('mcp:global', '1.2.3.4', 10);
    expect(fetchSpy.calls).toHaveLength(1);
    expect(fetchSpy.calls[0].url).toBe('https://kv.example.com/multi-exec');
    expect((fetchSpy.calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer kv-token');
  });
});

describe('Upstash limiter behavior', () => {
  it.openspec('OA-DST-051')('issues atomic INCR + PEXPIRE multi-exec request', async () => {
    const log = quietLog();
    const fetchSpy = createFetchSpy(() =>
      jsonResponse([{ result: 1 }, { result: 1 }]),
    );
    const limiter = initRateLimiter(
      { KV_REST_API_URL: 'https://kv.example.com', KV_REST_API_TOKEN: 'tok' },
      { log, fetchImpl: fetchSpy.impl, windowMs: 60_000 },
    );
    await limiter.check('mcp:global', '1.2.3.4', 100);

    expect(fetchSpy.calls).toHaveLength(1);
    const init = fetchSpy.calls[0].init;
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body)) as string[][];
    expect(body).toHaveLength(2);
    expect(body[0][0]).toBe('INCR');
    expect(body[1][0]).toBe('PEXPIRE');
    // Second arg of INCR is the rate-limit key — must include bucket and IP.
    expect(body[0][1]).toContain('mcp:global');
    expect(body[0][1]).toContain('1.2.3.4');
    // PEXPIRE uses the same key and the window in ms.
    expect(body[1][1]).toBe(body[0][1]);
    expect(body[1][2]).toBe('60000');
  });

  it.openspec('OA-DST-051')('reports allowed=true when count is below the limit', async () => {
    const log = quietLog();
    const fetchSpy = createFetchSpy(() =>
      jsonResponse([{ result: 5 }, { result: 1 }]),
    );
    const limiter = initRateLimiter(
      { KV_REST_API_URL: 'https://kv.example.com', KV_REST_API_TOKEN: 'tok' },
      { log, fetchImpl: fetchSpy.impl },
    );
    const state = await limiter.check('mcp:global', '1.1.1.1', 10);
    expect(state.configured).toBe(true);
    if (state.configured) {
      expect(state.allowed).toBe(true);
      expect(state.limit).toBe(10);
      expect(state.remaining).toBe(5);
      expect(state.bucket).toBe('mcp:global');
      expect(typeof state.reset_at).toBe('string');
    }
  });

  it.openspec('OA-DST-051')('reports allowed=false when count exceeds the limit', async () => {
    const log = quietLog();
    const fetchSpy = createFetchSpy(() =>
      jsonResponse([{ result: 11 }, { result: 1 }]),
    );
    const limiter = initRateLimiter(
      { KV_REST_API_URL: 'https://kv.example.com', KV_REST_API_TOKEN: 'tok' },
      { log, fetchImpl: fetchSpy.impl },
    );
    const state = await limiter.check('mcp:fill', '1.1.1.1', 10);
    expect(state.configured).toBe(true);
    if (state.configured) {
      expect(state.allowed).toBe(false);
      expect(state.remaining).toBe(0);
      expect(state.bucket).toBe('mcp:fill');
    }
  });

  it.openspec('OA-DST-052')('fails open with disabled state when fetch throws', async () => {
    const log = quietLog();
    const fetchSpy = createFetchSpy(() => {
      throw new Error('econnreset');
    });
    const limiter = initRateLimiter(
      { KV_REST_API_URL: 'https://kv.example.com', KV_REST_API_TOKEN: 'tok' },
      { log, fetchImpl: fetchSpy.impl },
    );
    const state = await limiter.check('mcp:global', '1.1.1.1', 10);
    expect(state).toEqual({ configured: false });
    expect(log.warn).toHaveBeenCalledTimes(1);
    const warn = JSON.parse(String((log.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]));
    expect(warn.event).toBe('rate_limit_runtime_error');
  });

  it.openspec('OA-DST-052')('fails open when Upstash returns a non-2xx HTTP status', async () => {
    const log = quietLog();
    const fetchSpy = createFetchSpy(() => new Response('upstream busy', { status: 503 }));
    const limiter = initRateLimiter(
      { KV_REST_API_URL: 'https://kv.example.com', KV_REST_API_TOKEN: 'tok' },
      { log, fetchImpl: fetchSpy.impl },
    );
    const state = await limiter.check('mcp:global', '1.1.1.1', 10);
    expect(state).toEqual({ configured: false });
    expect(log.warn).toHaveBeenCalledTimes(1);
  });
});

describe('combineState', () => {
  const allowed = (bucket: string, remaining: number): RateLimitState => ({
    configured: true,
    allowed: true,
    bucket,
    limit: 100,
    remaining,
    reset_at: '2026-04-24T00:01:00.000Z',
  });
  const blocked = (bucket: string): RateLimitState => ({
    configured: true,
    allowed: false,
    bucket,
    limit: 100,
    remaining: 0,
    reset_at: '2026-04-24T00:01:00.000Z',
  });

  it.openspec('OA-DST-053')('returns the blocked state when any input is blocked', () => {
    const result = combineState(allowed('mcp:global', 50), blocked('mcp:fill'));
    expect(result.configured).toBe(true);
    if (result.configured) {
      expect(result.allowed).toBe(false);
      expect(result.bucket).toBe('mcp:fill');
    }
  });

  it.openspec('OA-DST-053')('returns the binding (lowest-remaining) state when all allowed', () => {
    const result = combineState(allowed('mcp:global', 500), allowed('mcp:fill', 30));
    expect(result.configured).toBe(true);
    if (result.configured) {
      expect(result.bucket).toBe('mcp:fill');
      expect(result.remaining).toBe(30);
    }
  });

  it.openspec('OA-DST-053')('returns disabled when all inputs are unconfigured', () => {
    const result = combineState({ configured: false }, { configured: false });
    expect(result).toEqual({ configured: false });
  });

  it.openspec('OA-DST-053')('surfaces the configured state when one input is unconfigured', () => {
    const result = combineState({ configured: false }, allowed('mcp:global', 100));
    expect(result.configured).toBe(true);
    if (result.configured) {
      expect(result.bucket).toBe('mcp:global');
    }
  });
});

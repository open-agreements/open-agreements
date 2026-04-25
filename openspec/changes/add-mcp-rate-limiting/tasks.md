# Tasks

## 1. New rate-limit helper

- [x] Add `api/_ratelimit.ts` exporting `getClientIp`, `checkRateLimit`, `combineState`, `initRateLimiter`, `readGlobalLimit`, `readFillLimit`.
- [x] Use Upstash REST `/multi-exec` so `INCR` + `PEXPIRE` is atomic in one round trip (no race window).
- [x] Trusted header order: `x-vercel-forwarded-for`, then `x-real-ip`, then `x-forwarded-for` first hop, then `unknown`.
- [x] Env-var precedence: `KV_REST_API_URL`/`KV_REST_API_TOKEN` first, `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` fallback (mirrors `api/_download-artifacts.ts`).
- [x] Fail open with `console.warn` on Redis errors; `console.error` once at init when prod env vars missing.
- [x] Test reset helper `_resetRateLimiterCacheForTests`.

## 2. Wire into api/mcp.ts

- [x] Replace `operationalMetadata()` with state-aware version that returns `{ limit, remaining, reset_at, bucket }` when configured.
- [x] Add optional `state: RateLimitState | null` parameter to `toolSuccessResult`; thread it through every callsite.
- [x] Add `rateState: RateLimitState | null` parameter to `handleToolsCall`.
- [x] In the main handler, run `checkRateLimit('mcp:global', ...)` before the notification short-circuit so notifications count against the global bucket.
- [x] Inside the `tools/call` branch, run `checkRateLimit('mcp:fill', ...)` when the tool name is `fill_template`; combine the two states for the success envelope.
- [x] On block, set `Retry-After` header and return HTTP 200 + `RATE_LIMITED` envelope with `error.details.rate_limit` populated.
- [x] Emit `rate_limited` info log on every block (with `bucket`, `jsonrpcMethod`, `jsonrpcId`).

## 3. Tests

- [x] Add 5 contract tests in `integration-tests/mcp-contract.test.ts` bound to OA-DST-044 through OA-DST-048.
- [x] Add unit tests in new `integration-tests/api-ratelimit.test.ts` bound to OA-DST-049 through OA-DST-053.
- [x] Update existing OA-DST-032 assertion at line 197 to include bucket null in the placeholder shape.
- [x] Verify vitest for both files passes.

## 4. Docs

- [x] Update `docs/mcp-migration-v2.md` Auth and Rate-Limit Metadata section with the new envelope shape, bucket field, env-var names, block contract (HTTP 200 + Retry-After), and failure policy.
- [x] Link rationale for HTTP 200 to modelcontextprotocol/typescript-sdk#1922.

## 5. Spec deltas

- [x] Author `openspec/changes/add-mcp-rate-limiting/specs/open-agreements/spec.md` with OA-DST-044 through OA-DST-053.
- [x] Verify ID availability: existing ceiling is OA-DST-043.
- [x] MODIFIED the existing MCP envelope requirement to specify the truthful rate_limit shape with bucket field.
- [x] ADDED an MCP rate-limiting requirement covering enforcement, buckets, block contract, failure policy, and IP extraction.

## 6. Validation

- [ ] `npx openspec validate add-mcp-rate-limiting --strict`
- [ ] `npm run preflight:ci`
- [ ] Local smoke against `vercel dev` with a personal Upstash to confirm the multi-exec round trip and bucket field (deferred to PR review).

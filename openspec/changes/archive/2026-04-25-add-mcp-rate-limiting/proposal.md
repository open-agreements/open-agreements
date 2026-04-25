# Change: Add real per-IP rate limiting to /api/mcp

## Why

The `/api/mcp` HTTP handler at `api/mcp.ts:431` advertises a placeholder
`rate_limit: { limit: null, remaining: null, reset_at: null }` on every
response envelope while doing no actual throttling. `/api/mcp` is a public
DOCX-rendering endpoint on Vercel — without real limits, one noisy client
can drive compute cost, degrade service for legitimate users, or abuse DOCX
generation at the edge (issue #199).

The fix is a per-IP fixed-window limiter on top of the **existing Upstash
REST infrastructure** already used by `api/_download-artifacts.ts` (no new
npm dependency, no second Redis client, no Vercel WAF coupling). Two buckets
apply: a generous global cap on every authoritative POST and a stricter
sub-bucket on the expensive `fill_template` tool. Truthful rate-limit
metadata replaces the placeholder, blocked requests return a `RATE_LIMITED`
envelope plus `Retry-After`, and the limiter fails open so a Redis blip
cannot take down the public endpoint.

## What Changes

- **New `api/_ratelimit.ts`** — `getClientIp` (Vercel-trusted header order:
  `x-vercel-forwarded-for` → `x-real-ip` → `x-forwarded-for` first hop),
  `checkRateLimit` (single-round-trip atomic Upstash REST `/multi-exec` with
  `INCR` + `PEXPIRE`), `combineState` (binding-bucket selection across both
  caps), `initRateLimiter` (env-aware: disabled in dev/test, loud
  `console.error` when prod env vars missing, fail open on Redis errors),
  and `readGlobalLimit` / `readFillLimit` (env-var overrides).
- **`api/mcp.ts`** — replace the placeholder `operationalMetadata()` with a
  state-aware version returning real `{ limit, remaining, reset_at, bucket }`
  values when the limiter is configured (and `null`s otherwise). Thread
  `RateLimitState` through `toolSuccessResult` and `handleToolsCall`. Insert
  the global-bucket check **before** the JSON-RPC notification short-circuit
  so spammed notifications still count. Insert the `mcp:fill` sub-bucket
  check inside the `tools/call` branch when the tool is `fill_template`. On
  block, return HTTP 200 + `RATE_LIMITED` envelope (`retriable: true`,
  `details.rate_limit` populated) plus a `Retry-After` header.
- **`integration-tests/mcp-contract.test.ts`** — five new tests bound to
  `OA-DST-044`…`OA-DST-048` covering truthful success metadata, global block
  with `Retry-After`, fill sub-bucket block, notification counted against the
  global bucket, and disabled-limiter null metadata.
- **New `integration-tests/api-ratelimit.test.ts`** — twelve unit tests
  bound to `OA-DST-049`…`OA-DST-053` covering IP-header precedence,
  spoofed-XFF rejection, env-var precedence (`KV_REST_API_*` over
  `UPSTASH_REDIS_REST_*`), prod-missing-env loud log, multi-exec request
  shape, allowed/blocked counts, fail-open on `fetch` throw and on non-2xx,
  and `combineState` merging.
- **`docs/mcp-migration-v2.md`** — replace the placeholder description with
  the truthful envelope shape, the bucket field, env-var names, the
  HTTP 200 + `Retry-After` block contract (with the rationale linking to
  modelcontextprotocol/typescript-sdk#1922), and the env-aware failure
  policy.

## Out of scope

- `/api/download` and `/api/a2a` rate limiting — same pattern, separate PRs
  (download has its own envelope shape).
- MCP `Origin` validation for DNS-rebinding hardening — same-class security
  debt flagged during peer review, separate issue.
- Tuning defaults below 600/120 — generous launch values, follow-up issue
  to monitor real traffic and lower based on observation.
- A deploy-time check that fails the deploy when prod env vars are missing
  — current PR loud-logs at runtime instead.
- A Vercel WAF dashboard rule as defense-in-depth — additive, not blocking
  for this PR.

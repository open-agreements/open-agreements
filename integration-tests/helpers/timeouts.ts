// Shared duration DSL for Vitest integration tests.
//
// Config-level `testTimeout` / `hookTimeout` in vitest.config.ts cannot
// override explicit per-test or per-hook timeouts passed as the third arg to
// `it()` / `beforeAll()`. Under V8 coverage instrumentation those explicit
// values can time out on shared CI runners even when the tests are healthy.
//
// `seconds(n)` returns a scaled millisecond count so every explicit timeout
// picks up the run-scoped multiplier surfaced via vitest.config.ts
// `test.env.VITEST_TIMEOUT_MULTIPLIER`. The unit lives in the function name,
// so call sites read as `seconds(60)` rather than `60_000` — no cognitive
// translation, and scaling is uniform across the suite.
//
// Input is sanitized: malformed, zero, negative, or non-finite multipliers
// collapse to 1x. Local dev runs (env var unset) behave exactly as the
// un-scaled code did before.

function resolveMultiplier(): number {
  const raw = process.env.VITEST_TIMEOUT_MULTIPLIER;
  if (raw == null) return 1;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

export const TIMEOUT_MULTIPLIER = resolveMultiplier();

export function seconds(n: number): number {
  return Math.ceil(n * 1000 * TIMEOUT_MULTIPLIER);
}

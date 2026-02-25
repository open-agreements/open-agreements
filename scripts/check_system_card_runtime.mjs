#!/usr/bin/env node

/**
 * Validate site/_data/systemCardRuntime.json shape and freshness.
 *
 * Usage:
 *   node scripts/check_system_card_runtime.mjs
 *   node scripts/check_system_card_runtime.mjs --input site/_data/systemCardRuntime.json --max-age-hours 24
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let inputPath = resolve(REPO_ROOT, "site", "_data", "systemCardRuntime.json");
  let maxAgeHours = 24;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") {
      const value = args[i + 1];
      if (!value) throw new Error("--input requires a path value");
      inputPath = resolve(process.cwd(), value);
      i++;
      continue;
    }
    if (args[i] === "--max-age-hours") {
      const value = Number(args[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--max-age-hours requires a positive number");
      }
      maxAgeHours = value;
      i++;
      continue;
    }
    throw new Error(`Unknown argument: ${args[i]}`);
  }

  return { inputPath, maxAgeHours };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function main() {
  const { inputPath, maxAgeHours } = parseArgs();
  if (!existsSync(inputPath)) {
    console.error(`Missing system card runtime data file: ${inputPath}`);
    process.exit(1);
  }

  const runtime = JSON.parse(readFileSync(inputPath, "utf-8"));
  assert(runtime && typeof runtime === "object", "Runtime data must be a JSON object.");

  assert(typeof runtime.generated_at_utc === "string", "generated_at_utc must be a string.");
  assert(runtime.stats && typeof runtime.stats === "object", "stats must be an object.");
  assert(isFiniteNumber(runtime.stats.total), "stats.total must be a finite number.");
  assert(isFiniteNumber(runtime.stats.passed), "stats.passed must be a finite number.");
  assert(isFiniteNumber(runtime.stats.failed), "stats.failed must be a finite number.");
  assert(isFiniteNumber(runtime.stats.pass_rate_percent), "stats.pass_rate_percent must be a finite number.");

  assert(runtime.run && typeof runtime.run === "object", "run must be an object.");
  assert(typeof runtime.run.created_at_utc === "string", "run.created_at_utc must be a string.");

  const createdAtMs = Date.parse(runtime.run.created_at_utc);
  assert(Number.isFinite(createdAtMs), "run.created_at_utc must be parseable ISO timestamp.");

  const ageMinutes = Math.max(0, Math.round((Date.now() - createdAtMs) / 60000));
  const maxAgeMinutes = maxAgeHours * 60;
  if (ageMinutes > maxAgeMinutes) {
    const ageHours = (ageMinutes / 60).toFixed(1);
    console.error(
      `System card runtime data is stale (${ageHours}h old; max ${maxAgeHours}h).`,
    );
    process.exit(1);
  }

  const relPath = relative(REPO_ROOT, inputPath);
  console.log(
    `PASS runtime data freshness: ${relPath} (${ageMinutes} minutes old, max ${maxAgeHours}h)`,
  );
}

main();

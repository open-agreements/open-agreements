#!/usr/bin/env node

/**
 * Export Allure report summary for the site trust page.
 *
 * Reads allure-report/widgets/summary.json and writes site/_data/allureSummary.json.
 * The output file is committed to the repo and freshness-gated in CI.
 *
 * Usage:
 *   node scripts/export_allure_summary.mjs
 *   node scripts/export_allure_summary.mjs --report-dir ./allure-report --output site/_data/allureSummary.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let reportDir = resolve(REPO_ROOT, "allure-report");
  let outputPath = resolve(REPO_ROOT, "site", "_data", "allureSummary.json");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--report-dir") {
      const value = args[i + 1];
      if (!value) throw new Error("--report-dir requires a path value");
      reportDir = resolve(process.cwd(), value);
      i++;
      continue;
    }
    if (args[i] === "--output") {
      const value = args[i + 1];
      if (!value) throw new Error("--output requires a path value");
      outputPath = resolve(process.cwd(), value);
      i++;
      continue;
    }
    throw new Error(`Unknown argument: ${args[i]}`);
  }

  return { reportDir, outputPath };
}

function main() {
  const { reportDir, outputPath } = parseArgs();

  const summaryPath = resolve(reportDir, "widgets", "summary.json");
  if (!existsSync(summaryPath)) {
    console.error(`Allure summary not found at: ${summaryPath}`);
    console.error(
      "Run 'npm run report:allure' first to generate the report.",
    );
    process.exit(1);
  }

  const raw = readFileSync(summaryPath, "utf-8");
  const summary = JSON.parse(raw);

  const exported = {
    exported_at_utc: new Date().toISOString(),
    report_url: "https://tests.openagreements.ai",
    statistic: summary.statistic ?? {},
    time: summary.time ?? {},
  };

  const outDir = dirname(outputPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(exported, null, 2) + "\n", "utf-8");

  const relative = outputPath.replace(REPO_ROOT + "/", "");
  console.log(`Exported allure summary: ${relative}`);
}

main();

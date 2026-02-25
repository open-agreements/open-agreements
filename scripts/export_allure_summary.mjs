#!/usr/bin/env node

/**
 * Export runtime trust data for the System Card.
 *
 * Reads allure-report/summary.json and writes site/_data/systemCardRuntime.json.
 *
 * Usage:
 *   node scripts/export_allure_summary.mjs
 *   node scripts/export_allure_summary.mjs --report-dir ./allure-report --output site/_data/systemCardRuntime.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DEFAULT_REPORT_URL = "https://tests.openagreements.ai";

function parseArgs() {
  const args = process.argv.slice(2);
  let reportDir = resolve(REPO_ROOT, "allure-report");
  let outputPath = resolve(REPO_ROOT, "site", "_data", "systemCardRuntime.json");
  let staleAfterHours = 24;

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
    if (args[i] === "--stale-after-hours") {
      const value = Number(args[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--stale-after-hours requires a positive number");
      }
      staleAfterHours = value;
      i++;
      continue;
    }
    throw new Error(`Unknown argument: ${args[i]}`);
  }

  return { reportDir, outputPath, staleAfterHours };
}

function maybeNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function resolveSummaryPath(reportDir) {
  const rootSummary = resolve(reportDir, "summary.json");
  if (existsSync(rootSummary)) return rootSummary;

  const widgetsSummary = resolve(reportDir, "widgets", "summary.json");
  if (existsSync(widgetsSummary)) return widgetsSummary;

  return null;
}

function readGitCommitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function shortSha(sha) {
  if (!sha || typeof sha !== "string") return null;
  return sha.slice(0, 7);
}

function buildGithubUrls(commitSha) {
  const server = process.env.GITHUB_SERVER_URL;
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;

  const commitUrlFromEnv = server && repo && commitSha
    ? `${server}/${repo}/commit/${commitSha}`
    : null;
  const runUrlFromEnv = server && repo && runId
    ? `${server}/${repo}/actions/runs/${runId}`
    : null;

  const fallbackCommitUrl = commitSha
    ? `https://github.com/open-agreements/open-agreements/commit/${commitSha}`
    : null;
  const fallbackRunUrl = "https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml";

  return {
    commitUrl: commitUrlFromEnv ?? fallbackCommitUrl,
    runUrl: runUrlFromEnv ?? fallbackRunUrl,
  };
}

function ensureIsoUtc(valueMs, fallbackIso) {
  if (!Number.isFinite(valueMs)) return fallbackIso;
  return new Date(valueMs).toISOString();
}

function main() {
  const { reportDir, outputPath, staleAfterHours } = parseArgs();
  const summaryPath = resolveSummaryPath(reportDir);
  if (!summaryPath) {
    console.error(`Allure summary not found under: ${reportDir}`);
    console.error(
      "Run 'npm run report:allure' first to generate the report.",
    );
    process.exit(1);
  }

  const raw = readFileSync(summaryPath, "utf-8");
  const summary = JSON.parse(raw);

  const now = new Date();
  const nowMs = now.getTime();

  const stats = summary.stats ?? summary.statistic ?? {};
  const total = Number(stats.total ?? 0);
  const passed = Number(stats.passed ?? 0);
  const failedFromSummary = maybeNumber(stats.failed);
  const failed = failedFromSummary ?? Math.max(0, total - passed);
  const broken = Number(stats.broken ?? 0);
  const skipped = Number(stats.skipped ?? 0);
  const flaky = Number(stats.flaky ?? 0);
  const passRatePercent = total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0;

  const createdAtMs = maybeNumber(summary.createdAt) ?? maybeNumber(summary.time?.stop) ?? nowMs;
  const createdAtUtc = ensureIsoUtc(createdAtMs, now.toISOString());
  const ageMinutes = Math.max(0, Math.round((nowMs - createdAtMs) / 60000));
  const maxAgeMinutes = staleAfterHours * 60;
  const isStale = ageMinutes > maxAgeMinutes;

  const commitSha = process.env.GITHUB_SHA ?? readGitCommitSha();
  const { commitUrl, runUrl } = buildGithubUrls(commitSha);

  const exported = {
    schema_version: 1,
    generated_at_utc: now.toISOString(),
    report_url: DEFAULT_REPORT_URL,
    status: summary.status ?? (failed > 0 ? "failed" : "passed"),
    stats: {
      total,
      passed,
      failed,
      broken,
      skipped,
      flaky,
      pass_rate_percent: passRatePercent,
    },
    run: {
      created_at_utc: createdAtUtc,
      duration_ms: maybeNumber(summary.duration) ?? maybeNumber(summary.time?.duration),
      commit_sha: shortSha(commitSha),
      commit_url: commitUrl,
      ci_run_url: summary.jobHref || runUrl,
      pull_request_url: summary.pullRequestHref || null,
    },
    freshness: {
      age_minutes: ageMinutes,
      stale_after_hours: staleAfterHours,
      is_stale: isStale,
    },
  };

  const outDir = dirname(outputPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(exported, null, 2) + "\n", "utf-8");
  console.log(`Exported system card runtime data: ${relative(REPO_ROOT, outputPath)}`);
}

main();

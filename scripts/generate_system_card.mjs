#!/usr/bin/env node

/**
 * Generate the OpenAgreements System Card.
 *
 * Inputs:
 *   - OpenSpec traceability matrix (from validate_openspec_coverage.mjs --write-matrix)
 *
 * Output:
 *   - site/trust/system-card.md (Eleventy page with frontmatter)
 *
 * The system card contains only deterministic data (OpenSpec traceability).
 * Allure test run data is served by the live report at tests.openagreements.ai.
 *
 * Usage:
 *   node scripts/generate_system_card.mjs
 *   node scripts/generate_system_card.mjs --output site/trust/system-card.md
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const TRACEABILITY_PATH = path.join(
  REPO_ROOT,
  "integration-tests",
  "OPENSPEC_TRACEABILITY.md",
);

function parseArgs() {
  const args = process.argv.slice(2);
  let outputPath = path.join(REPO_ROOT, "site", "trust", "system-card.md");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output") {
      const value = args[i + 1];
      if (!value) throw new Error("--output requires a path value");
      outputPath = path.resolve(process.cwd(), value);
      i++;
      continue;
    }
    throw new Error(`Unknown argument: ${args[i]}`);
  }
  return { outputPath };
}

/**
 * Parse the OA traceability matrix markdown into a coverage summary.
 *
 * The OA matrix uses `## Capability:` headings (vs Safe DOCX `## Change:` headings).
 */
function parseMatrixMarkdown(markdown) {
  const rows = [];
  let currentCapability = null;

  for (const line of markdown.split("\n")) {
    const capMatch = line.match(/^##\s+Capability:\s+`([^`]+)`/);
    if (capMatch) {
      currentCapability = capMatch[1];
      continue;
    }

    if (!line.startsWith("|")) continue;

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((v) => v.trim());

    if (cells.length < 2) continue;
    if (cells[0] === "Scenario" || cells[0] === "---" || cells[0].startsWith("_")) continue;

    const status = cells[1];
    if (!["covered", "missing", "pending_impl"].includes(status)) continue;

    rows.push({
      scenario: cells[0],
      status,
      mappedTests: cells[2] ?? "n/a",
      notes: cells[3] ?? "",
      capability: currentCapability,
    });
  }

  return {
    total: rows.length,
    covered: rows.filter((r) => r.status === "covered").length,
    missing: rows.filter((r) => r.status === "missing").length,
    pending: rows.filter((r) => r.status === "pending_impl").length,
    capabilities: [...new Set(rows.map((r) => r.capability).filter(Boolean))],
    missingScenarios: rows
      .filter((r) => r.status === "missing" || r.status === "pending_impl")
      .map((r) => ({
        scenario: r.scenario,
        status: r.status,
        capability: r.capability,
      })),
  };
}

function pct(covered, total) {
  if (!total) return "0.0%";
  return `${((covered / total) * 100).toFixed(1)}%`;
}

function percentValue(num, denom) {
  if (!denom) return null;
  return (num / denom) * 100;
}

function fixedPercent(value) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function chartClassForPercent(value) {
  if (value == null) return "is-na";
  if (value >= 99) return "is-good";
  if (value >= 95) return "is-mid";
  return "is-low";
}

function chartRowHtml({ label, detail, percent }) {
  const width =
    percent == null ? 100 : Math.max(0, Math.min(100, percent));
  const valueText = fixedPercent(percent);
  const cssClass = chartClassForPercent(percent);
  return [
    '<div class="chart-row">',
    `<div class="chart-label">${escapeHtml(label)}<span class="chart-detail">${escapeHtml(detail)}</span></div>`,
    `<div class="chart-track"><span class="chart-fill ${cssClass}" style="width:${width.toFixed(1)}%"></span></div>`,
    `<div class="chart-value">${escapeHtml(valueText)}</div>`,
    "</div>",
  ].join("");
}

function makeSystemCardMarkdown({ traceability }) {
  const mappingCoverage = percentValue(traceability.covered, traceability.total);
  const unmapped = traceability.missing + traceability.pending;

  const chartRow = chartRowHtml({
    label: "OpenSpec scenario mapping",
    detail: `${traceability.covered}/${traceability.total} scenarios`,
    percent: mappingCoverage,
  });

  const lines = [];
  lines.push("---");
  lines.push("layout: base.njk");
  lines.push("title: System Card | OpenAgreements");
  lines.push(
    "description: Reliability summary and evidence for OpenAgreements.",
  );
  lines.push("---");
  lines.push("");
  lines.push("# OpenAgreements System Card");
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push('<div class="trust-summary-banner">');
  if (unmapped === 0) {
    lines.push(
      `<h2>All ${traceability.total} spec scenarios mapped to tests</h2>`,
    );
  } else {
    lines.push(
      `<h2>${traceability.covered} of ${traceability.total} spec scenarios mapped</h2>`,
    );
  }
  lines.push(
    `<p>${traceability.covered} of ${traceability.total} OpenSpec scenarios are mapped to automated tests across ${traceability.capabilities.length} capabilities.</p>`,
  );
  lines.push("</div>");
  lines.push("");
  lines.push(
    "- This card focuses on reliability signals developers can scan quickly.",
  );
  lines.push(
    "- Scope: all OpenAgreements packages including the core CLI, contracts-workspace, and MCP connector.",
  );
  lines.push("");
  lines.push("## Visual Snapshot");
  lines.push("");
  lines.push('<div class="trust-chart">');
  lines.push(chartRow);
  lines.push("</div>");
  lines.push("");
  lines.push("## Key Results");
  lines.push("");
  lines.push("### 1) OpenSpec Scenario Mapping");
  lines.push("");
  lines.push(
    "This is **spec scenario mapping coverage**, not line/branch code coverage.",
  );
  lines.push("");
  lines.push(
    "| Metric | Value |",
  );
  lines.push("|---|---:|");
  lines.push(`| Spec scenarios | ${traceability.total} |`);
  lines.push(`| Mapped to tests | ${traceability.covered} |`);
  lines.push(`| Unmapped | ${unmapped} |`);
  lines.push(
    `| Coverage | ${pct(traceability.covered, traceability.total)} |`,
  );
  lines.push(
    `| Capabilities measured | ${traceability.capabilities.length} |`,
  );
  lines.push("");

  if (traceability.missingScenarios.length === 0) {
    lines.push(
      "No unmapped scenarios were found in the currently measured scope.",
    );
    lines.push("");
  } else {
    const previewCount = 10;
    lines.push(
      `Unmapped scenarios found: ${traceability.missingScenarios.length}`,
    );
    lines.push("Top items:");
    for (const item of traceability.missingScenarios.slice(0, previewCount)) {
      const cap = item.capability ? ` (${item.capability})` : "";
      lines.push(`- ${item.scenario}${cap} - ${item.status}`);
    }
    if (traceability.missingScenarios.length > previewCount) {
      lines.push(
        `- ...and ${traceability.missingScenarios.length - previewCount} more (see traceability matrix).`,
      );
    }
    lines.push("");
  }

  lines.push("### 2) Live Signals");
  lines.push("");
  lines.push(
    "| Signal | Link |",
  );
  lines.push("|---|---|");
  lines.push(
    "| Allure test report | [tests.openagreements.ai](https://tests.openagreements.ai) |",
  );
  lines.push(
    "| Code coverage (Codecov) | [![Coverage](https://img.shields.io/codecov/c/github/open-agreements/open-agreements/main)](https://app.codecov.io/gh/open-agreements/open-agreements) |",
  );
  lines.push(
    "| CI status | [![CI](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml/badge.svg)](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml) |",
  );
  lines.push(
    "| npm downloads | [![npm](https://img.shields.io/npm/dm/open-agreements.svg)](https://www.npmjs.com/package/open-agreements) |",
  );
  lines.push("");
  lines.push("## Discussion");
  lines.push("");
  lines.push(
    "- A high mapping percentage means each spec scenario is represented by at least one test.",
  );
  lines.push(
    "- Live test run data (pass rates, failure details) is available in the [Allure report](https://tests.openagreements.ai).",
  );
  lines.push(
    "- Both signals should be read together, along with known limitations below.",
  );
  lines.push("");
  lines.push("## Limitations");
  lines.push("");
  lines.push("- This card does not report line or branch code coverage.");
  lines.push(
    "- Mapping coverage can be 100% and defects can still exist.",
  );
  lines.push("");
  lines.push("## Appendix: Methods (Technical)");
  lines.push("");
  lines.push(
    "- Mapping numbers are read from the generated OpenSpec traceability matrix.",
  );
  lines.push(
    "- Live test data is published to GitHub Pages on every push to main.",
  );
  lines.push(
    "- This page is regenerated by running `npm run generate:system-card`.",
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function main() {
  const { outputPath } = parseArgs();

  // Regenerate the traceability matrix before reading it.
  // Use --write-matrix to produce the markdown file without relying on exit code.
  try {
    execFileSync(
      process.execPath,
      [
        path.join(REPO_ROOT, "scripts", "validate_openspec_coverage.mjs"),
        "--write-matrix",
        TRACEABILITY_PATH,
      ],
      { cwd: REPO_ROOT, stdio: "inherit" },
    );
  } catch {
    // The script may exit non-zero if scenarios are missing — that's expected.
    // The matrix file is still written.
    console.log(
      "Note: validate_openspec_coverage exited non-zero (expected if scenarios are missing).",
    );
  }

  let matrixRaw;
  try {
    matrixRaw = await fs.readFile(TRACEABILITY_PATH, "utf-8");
  } catch {
    console.error(
      `Could not read traceability matrix at: ${TRACEABILITY_PATH}`,
    );
    console.error("Ensure validate_openspec_coverage.mjs runs successfully.");
    process.exit(1);
  }

  const traceability = parseMatrixMarkdown(matrixRaw);

  const systemCard = makeSystemCardMarkdown({ traceability });

  await ensureDir(outputPath);
  await fs.writeFile(outputPath, systemCard, "utf-8");

  const relOutput = path
    .relative(REPO_ROOT, outputPath)
    .split(path.sep)
    .join("/");
  console.log(`Generated system card: ${relOutput}`);
}

await main();

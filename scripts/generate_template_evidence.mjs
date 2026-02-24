#!/usr/bin/env node

/**
 * Generate per-template evidence data for the trust surface.
 *
 * Inputs:
 *   - Template catalog from `open-agreements list --json`
 *   - Allure test results (allure-results/*-result.json) for validation signal
 *
 * Output:
 *   - site/_data/templateEvidence.json (committed, freshness-gated)
 *
 * validation_status tri-state:
 *   - "validated"      — template has dedicated allure test(s) with template_id parameter
 *   - "not_covered"    — template exists but no dedicated validation test
 *   - "not_applicable" — recipe templates (downloaded at runtime, not pre-validated)
 *
 * Usage:
 *   node scripts/generate_template_evidence.mjs
 */

import { execSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const INTEGRATION_TESTS_DIR = join(REPO_ROOT, "integration-tests");
const OUTPUT_PATH = join(REPO_ROOT, "site", "_data", "templateEvidence.json");

const LICENSE_FLAGS = {
  "CC0-1.0": { distributable: true, fillable: true },
  "CC-BY-4.0": { distributable: true, fillable: true },
  "CC-BY-ND-4.0": { distributable: true, fillable: true },
};

function getSourceLabel(name, metadata) {
  if (name.startsWith("common-paper-")) return "Common Paper";
  if (name.startsWith("bonterms-")) return "Bonterms";
  if (name.startsWith("nvca-")) return "NVCA";
  if (name.startsWith("yc-safe-")) return "Y Combinator";
  if (name.startsWith("openagreements-")) return "OpenAgreements";
  // Fall back to source_url for non-prefixed OA templates
  const sourceUrl = String(metadata?.source_url || "").toLowerCase();
  if (
    sourceUrl.includes("openagreements.ai") ||
    sourceUrl.includes("github.com/open-agreements")
  ) {
    return "OpenAgreements";
  }
  return "Unknown";
}

function getSourceUrl(label) {
  const urls = {
    "Common Paper": "https://commonpaper.com",
    Bonterms: "https://bonterms.com",
    NVCA: "https://nvca.org",
    "Y Combinator": "https://www.ycombinator.com/documents",
    OpenAgreements: "https://openagreements.ai",
  };
  return urls[label] || "#";
}

function formatName(id) {
  return id
    .replace(/^(common-paper-|bonterms-|nvca-|yc-safe-|openagreements-)/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bNda\b/g, "NDA")
    .replace(/\bCsa\b/g, "CSA")
    .replace(/\bDpa\b/g, "DPA")
    .replace(/\bBaa\b/g, "BAA")
    .replace(/\bSla\b/g, "SLA")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSow\b/g, "SOW")
    .replace(/\bIp\b/g, "IP")
    .replace(/\bSafe\b/g, "SAFE")
    .replace(/\bMfn\b/g, "MFN")
    .replace(/\bRofr\b/g, "ROFR")
    .replace(/\bCoi\b/g, "COI")
    .replace(/\bSpa\b/g, "SPA")
    .replace(/\bIra\b/g, "IRA")
    .replace(/\bLoi\b/g, "LOI");
}

/**
 * Scan integration test source files for allureParameter('template_id', '...')
 * calls to determine which templates have dedicated validation tests.
 *
 * This is deterministic (same source = same result) unlike reading allure-results
 * which vary by environment and accumulate across runs.
 */
function collectValidatedTemplateIds() {
  const validated = new Set();

  let entries;
  try {
    entries = readdirSync(INTEGRATION_TESTS_DIR);
  } catch {
    return validated;
  }

  const testFiles = entries.filter((f) => f.endsWith(".test.ts"));
  const pattern = /allureParameter\s*\(\s*['"]template_id['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;

  for (const file of testFiles) {
    try {
      const source = readFileSync(join(INTEGRATION_TESTS_DIR, file), "utf-8");
      let match;
      while ((match = pattern.exec(source)) !== null) {
        validated.add(match[1]);
      }
      // Reset lastIndex for next file
      pattern.lastIndex = 0;
    } catch {
      // Skip unreadable files
    }
  }

  return validated;
}

function main() {
  // Get template catalog
  const bin = resolve(REPO_ROOT, "bin/open-agreements.js");
  const raw = execSync(`node ${bin} list --json`, {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    timeout: 30000,
  });
  const { items } = JSON.parse(raw);

  // Collect validated template IDs from allure results
  const validatedTemplates = collectValidatedTemplateIds();

  // Build evidence rows
  const evidence = items.map((item) => {
    const isRecipe = !item.license;
    const flags = isRecipe
      ? { distributable: false, fillable: false }
      : LICENSE_FLAGS[item.license] || { distributable: false, fillable: false };
    const sourceLabel = getSourceLabel(item.name, item);
    const sourceUrl = getSourceUrl(sourceLabel);

    // Determine validation status
    let validationStatus;
    let validationSource = "none";

    if (isRecipe) {
      validationStatus = "not_applicable";
    } else if (validatedTemplates.has(item.name)) {
      validationStatus = "validated";
      validationSource = "test-source-scan";
    } else {
      validationStatus = "not_covered";
    }

    // Check for preview images
    const previewDir = join(
      REPO_ROOT,
      "site",
      "assets",
      "previews",
      item.name,
    );
    const hasPreview = existsSync(previewDir);

    return {
      id: item.name,
      displayName: formatName(item.name),
      sourceLabel,
      sourceUrl,
      license: item.license || "Recipe",
      distributable: flags.distributable,
      fillable: flags.fillable,
      requiredFields: item.fields.filter((f) => f.required).length,
      totalFields: item.fields.length,
      validation_status: validationStatus,
      validation_source: validationSource,
      hasPreview,
    };
  });

  // Sort: validated first, then not_covered, then not_applicable
  const statusOrder = { validated: 0, not_covered: 1, not_applicable: 2 };
  evidence.sort(
    (a, b) =>
      (statusOrder[a.validation_status] ?? 3) -
      (statusOrder[b.validation_status] ?? 3),
  );

  const output = {
    total_templates: evidence.length,
    validated_count: evidence.filter((e) => e.validation_status === "validated")
      .length,
    not_covered_count: evidence.filter(
      (e) => e.validation_status === "not_covered",
    ).length,
    not_applicable_count: evidence.filter(
      (e) => e.validation_status === "not_applicable",
    ).length,
    templates: evidence,
  };

  const outDir = dirname(OUTPUT_PATH);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");

  const relative = OUTPUT_PATH.replace(REPO_ROOT + "/", "");
  console.log(`Generated template evidence: ${relative}`);
  console.log(
    `  ${output.validated_count} validated, ${output.not_covered_count} not covered, ${output.not_applicable_count} not applicable (${output.total_templates} total)`,
  );
}

main();

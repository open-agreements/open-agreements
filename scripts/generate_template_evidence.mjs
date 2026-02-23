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
const ALLURE_RESULTS_DIR = join(REPO_ROOT, "allure-results");
const OUTPUT_PATH = join(REPO_ROOT, "site", "_data", "templateEvidence.json");

const LICENSE_FLAGS = {
  "CC0-1.0": { distributable: true, fillable: true },
  "CC-BY-4.0": { distributable: true, fillable: true },
  "CC-BY-ND-4.0": { distributable: true, fillable: true },
};

function getSourceLabel(name) {
  if (name.startsWith("common-paper-")) return "Common Paper";
  if (name.startsWith("bonterms-")) return "Bonterms";
  if (name.startsWith("nvca-")) return "NVCA";
  if (name.startsWith("yc-safe-")) return "Y Combinator";
  if (name.startsWith("openagreements-")) return "OpenAgreements";
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
 * Scan allure results for template_id parameters to determine which templates
 * have dedicated validation tests.
 */
function collectValidatedTemplateIds() {
  const validated = new Map(); // templateId -> { count, latestStop }

  let entries;
  try {
    entries = readdirSync(ALLURE_RESULTS_DIR);
  } catch {
    return validated;
  }

  const resultFiles = entries.filter((f) => f.endsWith("-result.json"));

  for (const file of resultFiles) {
    try {
      const data = JSON.parse(
        readFileSync(join(ALLURE_RESULTS_DIR, file), "utf-8"),
      );
      const params = data.parameters || [];
      const templateParam = params.find(
        (p) => p.name === "template_id" || p.name === "templateId",
      );

      if (templateParam && templateParam.value) {
        const id = templateParam.value;
        const existing = validated.get(id) || { count: 0, latestStop: null };
        existing.count++;
        if (typeof data.stop === "number") {
          existing.latestStop =
            existing.latestStop == null
              ? data.stop
              : Math.max(existing.latestStop, data.stop);
        }
        validated.set(id, existing);
      }
    } catch {
      // Skip malformed files
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
    const sourceLabel = getSourceLabel(item.name);
    const sourceUrl = getSourceUrl(sourceLabel);

    // Determine validation status
    let validationStatus;
    let lastValidationAt = null;
    let validationSource = "none";

    if (isRecipe) {
      validationStatus = "not_applicable";
    } else if (validatedTemplates.has(item.name)) {
      validationStatus = "validated";
      const info = validatedTemplates.get(item.name);
      lastValidationAt =
        info.latestStop != null
          ? new Date(info.latestStop).toISOString()
          : null;
      validationSource = "allure-template-suite";
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
      last_validation_at: lastValidationAt,
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
    generated_at_utc: new Date().toISOString(),
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

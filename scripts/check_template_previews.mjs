#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TEMPLATES_DIR = resolve(ROOT, "content", "templates");
const PREVIEWS_DIR = resolve(ROOT, "site", "assets", "previews");

function listTemplateIds() {
  return readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function loadTemplateMetadata(templateId) {
  const metadataPath = resolve(TEMPLATES_DIR, templateId, "metadata.yaml");
  if (!existsSync(metadataPath)) {
    return {};
  }
  const raw = readFileSync(metadataPath, "utf8");
  const parsed = yaml.load(raw);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function isOpenAgreementsOwned(templateId, metadata) {
  if (templateId.startsWith("openagreements-")) {
    return true;
  }
  const sourceUrl = String(metadata.source_url || "").toLowerCase();
  return (
    sourceUrl.includes("openagreements.ai") ||
    sourceUrl.includes("github.com/open-agreements/open-agreements")
  );
}

function main() {
  const allTemplateIds = listTemplateIds();
  const ownedTemplates = allTemplateIds.filter((templateId) =>
    isOpenAgreementsOwned(templateId, loadTemplateMetadata(templateId))
  );

  const missing = [];
  for (const templateId of ownedTemplates) {
    const previewDir = resolve(PREVIEWS_DIR, templateId);
    const pngCount = existsSync(previewDir)
      ? readdirSync(previewDir).filter((name) => name.endsWith(".png")).length
      : 0;
    if (pngCount === 0) {
      missing.push(templateId);
    }
  }

  if (missing.length > 0) {
    console.error("FAIL template preview gate: missing PNG preview pages for:");
    for (const templateId of missing) {
      console.error(`- ${templateId}`);
    }
    console.error("");
    console.error("Generate previews locally:");
    console.error("npm run generate:template-previews");
    console.error("Or generate just one template:");
    console.error("npm run generate:template-previews -- --template <template-id>");
    process.exit(1);
  }

  console.log(
    `PASS template preview gate: ${ownedTemplates.length} OpenAgreements template(s) have preview PNGs.`
  );
}

main();

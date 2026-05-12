import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(__dirname, "../..");
export const TEMPLATES_DIR = resolve(REPO_ROOT, "content", "templates");
export const PREVIEWS_DIR = resolve(REPO_ROOT, "site", "assets", "previews");

export function listTemplateIds() {
  return readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function loadTemplateMetadata(templateId) {
  const metadataPath = resolve(TEMPLATES_DIR, templateId, "metadata.yaml");
  if (!existsSync(metadataPath)) {
    return {};
  }
  const raw = readFileSync(metadataPath, "utf8");
  const parsed = yaml.load(raw);
  return parsed && typeof parsed === "object" ? parsed : {};
}

export function isOpenAgreementsOwned(templateId, metadata) {
  if (templateId.startsWith("openagreements-")) {
    return true;
  }
  const sourceUrl = String(metadata.source_url || "").toLowerCase();
  return (
    sourceUrl.includes("openagreements.org") ||
    sourceUrl.includes("openagreements.ai") ||
    sourceUrl.includes("github.com/open-agreements/open-agreements")
  );
}

export function listOpenAgreementsTemplateIds() {
  return listTemplateIds().filter((templateId) =>
    isOpenAgreementsOwned(templateId, loadTemplateMetadata(templateId))
  );
}

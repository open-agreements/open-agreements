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

function hostMatches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isOpenAgreementsOwned(templateId, metadata) {
  if (templateId.startsWith("openagreements-")) {
    return true;
  }
  const rawUrl = String(metadata.source_url || "").trim();
  if (!rawUrl) {
    return false;
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (hostMatches(host, "openagreements.org") || hostMatches(host, "openagreements.ai")) {
    return true;
  }
  if (hostMatches(host, "github.com")) {
    const path = url.pathname.toLowerCase().replace(/^\/+/, "");
    return path === "open-agreements/open-agreements" || path.startsWith("open-agreements/open-agreements/");
  }
  return false;
}

export function listOpenAgreementsTemplateIds() {
  return listTemplateIds().filter((templateId) =>
    isOpenAgreementsOwned(templateId, loadTemplateMetadata(templateId))
  );
}

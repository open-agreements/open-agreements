import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(__dirname, "../..");
export const TEMPLATES_DIR = resolve(REPO_ROOT, "templates");
export const PREVIEWS_DIR = resolve(REPO_ROOT, "data", "template-previews");

/**
 * Map every slug to its on-disk directory. Since the S3 source/rights
 * restructure (#1249) slugs live two levels deep as
 * templates/<source>-<rights>/<slug>/. Slugs are globally unique.
 */
export function templateSlugDirs() {
  const map = new Map();
  for (const segment of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
    if (!segment.isDirectory()) continue;
    const segmentDir = resolve(TEMPLATES_DIR, segment.name);
    for (const slug of readdirSync(segmentDir, { withFileTypes: true })) {
      if (!slug.isDirectory()) continue;
      if (!map.has(slug.name)) map.set(slug.name, resolve(segmentDir, slug.name));
    }
  }
  return map;
}

/** Resolve a slug to its directory, or undefined if not present. */
export function resolveTemplateSlugDir(templateId) {
  return templateSlugDirs().get(templateId);
}

export function listTemplateIds() {
  return [...templateSlugDirs().keys()].sort();
}

// Load and parse a template's metadata.yaml given its directory. Returns {} when
// the file is absent. Single js-yaml parse site shared by loadTemplateMetadata
// and the canonical-source compiler so the two cannot drift.
export function loadMetadataFromDir(dir) {
  const metadataPath = resolve(dir, "metadata.yaml");
  if (!existsSync(metadataPath)) {
    return {};
  }
  const raw = readFileSync(metadataPath, "utf8");
  const parsed = yaml.load(raw);
  return parsed && typeof parsed === "object" ? parsed : {};
}

export function loadTemplateMetadata(templateId) {
  const dir = resolveTemplateSlugDir(templateId);
  return dir ? loadMetadataFromDir(dir) : {};
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

/**
 * Upstream-authored templates are synced from the canonical Markdoc source and
 * marked by a `template.mdoc` in their directory. They ship a fully-rendered,
 * humanized DOCX rather than an OA fill-token document, and OA does not render
 * their preview PNGs — so the preview gates exempt them.
 */
export function isUpstreamAuthored(templateId) {
  const dir = resolveTemplateSlugDir(templateId);
  return dir ? existsSync(resolve(dir, "template.mdoc")) : false;
}

/**
 * OA-owned templates whose previews OA itself renders (i.e. excluding
 * upstream-authored templates). This is the set the preview gates require PNGs
 * for and check freshness on.
 */
export function listOpenAgreementsRenderedTemplateIds() {
  return listOpenAgreementsTemplateIds().filter((id) => !isUpstreamAuthored(id));
}

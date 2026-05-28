#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  REPO_ROOT,
  listOpenAgreementsTemplateIds,
} from "./lib/template-utils.mjs";

const __filename = fileURLToPath(import.meta.url);

// ----- Template classification constants ------------------------------------
// Verified against origin/main HEAD d3ac01a (see plan §Architecture).
// Update any of these sets when a new OA template lands or the renderer
// architecture shifts.

export const CANONICAL_TEMPLATE_IDS = new Set([
  "openagreements-board-consent-safe",
  "openagreements-stockholder-consent-safe",
  "openagreements-employment-offer-letter",
  "openagreements-employee-ip-inventions-assignment",
  "openagreements-restrictive-covenant-wyoming",
]);

export const JSON_SPEC_TEMPLATE_IDS = new Set([
  "openagreements-employment-confidentiality-acknowledgement",
]);

export const SHARED_RENDERER_TEMPLATE_IDS = new Set([
  ...CANONICAL_TEMPLATE_IDS,
  ...JSON_SPEC_TEMPLATE_IDS,
]);

// OA-owned via metadata.yaml source_url, not the openagreements- prefix.
// Needed because a deleted template directory loses its metadata.yaml, so
// the gate can't read source_url at base; this explicit allowlist preserves
// ownership detection. Extend if a new non-prefix OA template lands.
export const NON_PREFIX_OA_TEMPLATE_IDS = new Set([
  "closing-checklist",
  "working-group-list",
]);

const COVER_LAYOUT_TEMPLATE_IDS = new Set([
  "openagreements-employment-offer-letter",
  "openagreements-employee-ip-inventions-assignment",
  "openagreements-employment-confidentiality-acknowledgement",
  "openagreements-restrictive-covenant-wyoming",
]);

const TRADITIONAL_CONSENT_LAYOUT_TEMPLATE_IDS = new Set([
  "openagreements-board-consent-safe",
  "openagreements-stockholder-consent-safe",
]);

const SHARED_STYLE_TEMPLATE_IDS = new Set([
  ...SHARED_RENDERER_TEMPLATE_IDS,
  ...NON_PREFIX_OA_TEMPLATE_IDS,
]);

// Files in scripts/template_renderer/** that any SHARED_RENDERER template
// passes through during `npm run generate:templates`.
const SHARED_RENDERER_TRIGGER_PATHS = new Set([
  "scripts/generate_templates.mjs",
  "scripts/template_renderer/index.mjs",
  "scripts/template_renderer/schema.mjs",
  "scripts/template_renderer/canonical-source.mjs",
  "scripts/template_renderer/canonical-sources.mjs",
  "scripts/template_renderer/canonical-frontmatter.mjs",
]);

const COVER_LAYOUT_TRIGGER_PATH =
  "scripts/template_renderer/layouts/cover-standard-signature-v1.mjs";
const TRADITIONAL_LAYOUT_TRIGGER_PATH =
  "scripts/template_renderer/layouts/traditional-consent-v1.mjs";
const SHARED_STYLE_TRIGGER_PATH =
  "scripts/template-specs/styles/openagreements-default-v1.json";

const CHECKLIST_GENERATOR_PATH = "scripts/generate_checklist_template.mjs";
const WORKING_GROUP_GENERATOR_PATH = "scripts/generate_working_group_template.mjs";

// Any change to the actual rendering primitives fans out to all OA-owned
// templates. Computed dynamically against current HEAD so future templates
// are covered.
//
// Intentionally narrow: `scripts/generate_template_previews.mjs` is the
// orchestrator (CLI parsing, template enumeration, Quick Look fallback). It
// doesn't directly produce pixels — `render_docx_pages.mjs` and
// `libreoffice_headless.mjs` do. Including the orchestrator would make pure
// refactors (like the one that introduced this gate) require regenerating
// every preview, which is busywork. The tradeoff: if someone bumps the
// default DPI in the orchestrator, the gate won't catch it — but that's a
// rare, reviewable change. See plan §"Determinism is best-effort".
const PIPELINE_TRIGGER_PATHS = new Set([
  "scripts/render_docx_pages.mjs",
  "scripts/libreoffice_headless.mjs",
]);

// Per-template render-input filenames (under content/templates/<id>/).
const TEMPLATE_MD_FILE = "template.md";
const TEMPLATE_JSON_FILE = "template.json";
const TEMPLATE_DOCX_FILE = "template.docx";

// ----- Wire format parsing --------------------------------------------------

/**
 * Parse a changed-files input into a normalized record list.
 *
 * Accepts:
 *   - A JSON array of { status, path, previousPath? } records (from
 *     actions/github-script via pulls.listFiles). GitHub statuses are
 *     "added" | "modified" | "removed" | "renamed" | "copied" | "changed" |
 *     "unchanged".
 *   - A `git diff --name-status -z` byte stream as a string.
 *
 * Renames are normalized to a synthetic { delete previousPath, add path }
 * pair so the per-path rules can treat add/modify/delete uniformly.
 *
 * @param {string} input
 * @returns {Array<{ status: string, path: string }>}
 */
export function parseChangedFiles(input) {
  if (input == null) return [];
  const trimmed = String(input).trim();
  if (trimmed === "") return [];

  let raw;
  if (trimmed.startsWith("[")) {
    raw = parseJsonInput(trimmed);
  } else {
    raw = parseGitDiffZ(trimmed);
  }

  // Normalize: split renames into delete(previousPath) + add(path).
  const out = [];
  for (const r of raw) {
    const status = normalizeStatus(r.status);
    if (status === "renamed" || status === "copied") {
      if (r.previousPath) {
        out.push({ status: "removed", path: r.previousPath });
      }
      out.push({ status: "added", path: r.path });
    } else {
      out.push({ status, path: r.path });
    }
  }
  return out;
}

function parseJsonInput(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`OA_CHANGED_FILES is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("OA_CHANGED_FILES must be a JSON array");
  }
  return parsed.map((r) => ({
    status: String(r.status ?? "modified"),
    path: String(r.path ?? ""),
    previousPath: r.previousPath ? String(r.previousPath) : null,
  }));
}

function parseGitDiffZ(text) {
  // `git diff --name-status -z` emits records like:
  //   "M\0path\0M\0other\0R100\0old\0new\0"
  // Status is one letter optionally followed by digits (for R/C scores).
  const tokens = text.split("\0").filter((t) => t.length > 0);
  const STATUS_RE = /^([AMDRCTUXB])(\d+)?$/;
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const m = STATUS_RE.exec(tok);
    if (!m) {
      // Skip junk — shouldn't happen for well-formed `git diff --name-status -z`.
      i += 1;
      continue;
    }
    const letter = m[1];
    if (letter === "R" || letter === "C") {
      const previousPath = tokens[i + 1];
      const newPath = tokens[i + 2];
      out.push({
        status: letter === "R" ? "renamed" : "copied",
        path: newPath,
        previousPath,
      });
      i += 3;
    } else {
      out.push({ status: gitLetterToStatus(letter), path: tokens[i + 1] });
      i += 2;
    }
  }
  return out;
}

function gitLetterToStatus(letter) {
  switch (letter) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "removed";
    case "T":
      return "modified";
    default:
      return "modified";
  }
}

function normalizeStatus(s) {
  const lower = String(s ?? "").toLowerCase();
  switch (lower) {
    case "a":
    case "added":
      return "added";
    case "m":
    case "modified":
    case "t":
    case "changed":
      return "modified";
    case "d":
    case "removed":
    case "deleted":
      return "removed";
    case "r":
    case "renamed":
      return "renamed";
    case "c":
    case "copied":
      return "copied";
    default:
      return "modified";
  }
}

// ----- Ownership ------------------------------------------------------------

/**
 * Returns true if the given template ID is OA-owned, accounting for IDs that
 * only appear in the base of the diff (so HEAD's metadata.yaml is unavailable).
 */
export function isOAOwnedTemplateId(templateId, headOwnedIds) {
  if (headOwnedIds.has(templateId)) return true;
  if (templateId.startsWith("openagreements-")) return true;
  if (NON_PREFIX_OA_TEMPLATE_IDS.has(templateId)) return true;
  return false;
}

// ----- Trigger expansion ----------------------------------------------------

/**
 * Apply per-template and generator-family rules to the record list. Returns a
 * map of templateId -> [{ status, path }] (the first source-side records that
 * triggered the requirement, for failure annotations).
 *
 * @param {Array<{ status: string, path: string }>} records
 * @param {Set<string>} headOwnedIds  IDs of OA-owned templates present in HEAD
 * @returns {Map<string, Array<{ status: string, path: string }>>}
 */
export function expandTriggers(records, headOwnedIds) {
  const triggers = new Map(); // templateId -> [trigger record, ...]
  const addTrigger = (templateId, record) => {
    if (!triggers.has(templateId)) triggers.set(templateId, []);
    triggers.get(templateId).push(record);
  };

  for (const record of records) {
    const tplMatch = matchTemplatePath(record.path);
    if (tplMatch) {
      const { templateId, filename } = tplMatch;
      if (!isOAOwnedTemplateId(templateId, headOwnedIds)) continue;
      if (filename === TEMPLATE_DOCX_FILE) {
        addTrigger(templateId, record);
      } else if (
        filename === TEMPLATE_MD_FILE &&
        CANONICAL_TEMPLATE_IDS.has(templateId)
      ) {
        addTrigger(templateId, record);
      } else if (
        filename === TEMPLATE_JSON_FILE &&
        JSON_SPEC_TEMPLATE_IDS.has(templateId)
      ) {
        addTrigger(templateId, record);
      }
      // metadata.yaml, README.md, practice-note.md, reference-source.docx,
      // .template.generated.json — not render-affecting (see plan §3c).
      continue;
    }

    // Generator-family rules (each independent; not first-match).
    const path = record.path;
    if (SHARED_RENDERER_TRIGGER_PATHS.has(path)) {
      for (const id of SHARED_RENDERER_TEMPLATE_IDS) addTrigger(id, record);
    }
    if (path === COVER_LAYOUT_TRIGGER_PATH) {
      for (const id of COVER_LAYOUT_TEMPLATE_IDS) addTrigger(id, record);
    }
    if (path === TRADITIONAL_LAYOUT_TRIGGER_PATH) {
      for (const id of TRADITIONAL_CONSENT_LAYOUT_TEMPLATE_IDS)
        addTrigger(id, record);
    }
    if (path === SHARED_STYLE_TRIGGER_PATH) {
      for (const id of SHARED_STYLE_TEMPLATE_IDS) addTrigger(id, record);
    }
    if (path === CHECKLIST_GENERATOR_PATH) {
      addTrigger("closing-checklist", record);
    }
    if (path === WORKING_GROUP_GENERATOR_PATH) {
      addTrigger("working-group-list", record);
    }
    if (PIPELINE_TRIGGER_PATHS.has(path)) {
      for (const id of headOwnedIds) addTrigger(id, record);
    }
  }

  return triggers;
}

function matchTemplatePath(p) {
  const m = /^content\/templates\/([^/]+)\/([^/]+)$/.exec(p);
  if (!m) return null;
  return { templateId: m[1], filename: m[2] };
}

// ----- Satisfaction check ---------------------------------------------------

/**
 * For each triggered template, check whether the diff contains at least one
 * record under site/assets/previews/<id>/page-N.png. Returns the IDs that
 * do NOT have a matching preview record.
 *
 * @param {Array<{ status: string, path: string }>} records
 * @param {Map<string, Array>} triggered
 * @returns {string[]}
 */
export function findMissingFreshness(records, triggered) {
  const previewIdsTouched = new Set();
  const PREVIEW_RE = /^site\/assets\/previews\/([^/]+)\/page-\d+\.png$/;
  for (const r of records) {
    const m = PREVIEW_RE.exec(r.path);
    if (m) previewIdsTouched.add(m[1]);
  }

  const missing = [];
  for (const id of triggered.keys()) {
    if (!previewIdsTouched.has(id)) missing.push(id);
  }
  missing.sort();
  return missing;
}

// ----- Input acquisition ----------------------------------------------------

function readChangedFilesFromInput(env) {
  const requireInput = env.OA_GATE_REQUIRE_INPUT === "1";
  const fromEnv = env.OA_CHANGED_FILES;

  if (fromEnv !== undefined) {
    const trimmed = String(fromEnv).trim();
    if (trimmed === "" || trimmed === "[]") {
      if (requireInput) {
        return {
          mode: "ci-empty",
          records: [],
        };
      }
      return { mode: "ci-empty-permissive", records: [] };
    }
    return { mode: "ci", records: parseChangedFiles(trimmed) };
  }

  if (requireInput) {
    return { mode: "ci-missing", records: [] };
  }

  // Local fallback: git diff --name-status -z origin/main...HEAD.
  const baseRef = env.OA_LOCAL_BASE_REF || "origin/main";
  const refCheck = spawnSync("git", ["rev-parse", "--verify", baseRef], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (refCheck.status !== 0) {
    return { mode: "local-skip-no-base", records: [], baseRef };
  }

  const diff = spawnSync(
    "git",
    ["diff", "--name-status", "-z", `${baseRef}...HEAD`],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  if (diff.status !== 0) {
    return { mode: "local-skip-no-base", records: [], baseRef };
  }

  return {
    mode: "local",
    records: parseChangedFiles(diff.stdout || ""),
    baseRef,
  };
}

function isLocalWorktreeDirty(env) {
  if (env.OA_CHANGED_FILES !== undefined) return false; // CI mode
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (status.status !== 0) return false;
  return String(status.stdout || "").trim() !== "";
}

// ----- Failure formatting ---------------------------------------------------

function formatFailureMessage(triggered, missing) {
  const lines = [];
  lines.push(
    `FAIL preview-freshness gate: ${missing.length} OA-owned template(s) need a refreshed preview.`
  );
  lines.push("");
  for (const id of missing) {
    const triggers = triggered.get(id) || [];
    const firstSource = triggers[0]?.path ?? "(unknown)";
    lines.push(`- ${id}`);
    lines.push(`  Triggered by: ${firstSource}`);
    lines.push(
      `  Run: npm run generate:template-previews -- --template ${id}`
    );
  }
  lines.push("");
  lines.push(
    "For a pipeline-wide change, run: npm run generate:template-previews"
  );
  lines.push(
    "Then commit the updated site/assets/previews/<id>/page-*.png files."
  );
  return lines.join("\n");
}

function emitGithubAnnotations(triggered, missing) {
  // One annotation per failing template, pointing at the first source-side
  // path that triggered it (typically a template.md/template.json/template.docx
  // or a generator script). Inline PR-diff rendering is best-effort.
  for (const id of missing) {
    const triggers = triggered.get(id) || [];
    const sourcePath = triggers[0]?.path ?? "";
    const message =
      `Preview not refreshed for ${id}. ` +
      `Run: npm run generate:template-previews -- --template ${id}`;
    const file = escapeAnnotation(sourcePath);
    const msg = escapeAnnotation(message);
    process.stderr.write(`::error file=${file},line=1::${msg}\n`);
  }
}

function escapeAnnotation(s) {
  return String(s)
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}

// ----- CLI entrypoint -------------------------------------------------------

const FRESHNESS_SKIP_LABEL = "freshness/skip";

function hasFreshnessSkipLabel(env) {
  const raw = env.OA_PR_LABELS;
  if (typeof raw !== "string" || raw.length === 0) return false;
  return raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .includes(FRESHNESS_SKIP_LABEL);
}

export async function main(env) {
  if (hasFreshnessSkipLabel(env)) {
    console.log(
      `PASS preview-freshness gate: '${FRESHNESS_SKIP_LABEL}' label applied — gate explicitly bypassed.`
    );
    return;
  }

  const input = readChangedFilesFromInput(env);

  if (input.mode === "ci-missing") {
    console.error(
      "FAIL preview-freshness gate: OA_CHANGED_FILES env is required when OA_GATE_REQUIRE_INPUT=1. " +
        "Check that the CI workflow populates it from actions/github-script."
    );
    process.exit(1);
  }

  if (input.mode === "ci-empty") {
    console.error(
      "FAIL preview-freshness gate: OA_CHANGED_FILES is empty under OA_GATE_REQUIRE_INPUT=1. " +
        "A PR with no changed files cannot reach this job; check workflow wiring."
    );
    process.exit(1);
  }

  if (input.mode === "local-skip-no-base") {
    console.log(
      `skipped: no ${input.baseRef} ref available locally. Run 'git fetch origin main' to enable the check.`
    );
    return;
  }

  if (input.mode === "ci-empty-permissive") {
    console.log("PASS preview-freshness gate: no changed files in input.");
    return;
  }

  if (isLocalWorktreeDirty(env)) {
    console.warn(
      "warning: local mode checks committed branch diff only; uncommitted changes (per `git status --porcelain`) are NOT inspected by this gate."
    );
  }

  // Build OA-owned set at HEAD for ownership + pipeline-wide expansion.
  const headOwnedIds = new Set(listOpenAgreementsTemplateIds());

  const triggered = expandTriggers(input.records, headOwnedIds);
  if (triggered.size === 0) {
    console.log(
      "PASS preview-freshness gate: no render-affecting paths in diff."
    );
    return;
  }

  const missing = findMissingFreshness(input.records, triggered);

  if (missing.length === 0) {
    console.log(
      `PASS preview-freshness gate: ${triggered.size} template(s) had matching preview updates.`
    );
    return;
  }

  emitGithubAnnotations(triggered, missing);
  console.error(formatFailureMessage(triggered, missing));
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await main(process.env);
}

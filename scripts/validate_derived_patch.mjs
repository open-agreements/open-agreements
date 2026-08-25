#!/usr/bin/env node
/**
 * Gatekeeper for the derived-artifact self-heal split.
 *
 * The unprivileged half of the split runs pull-request-controlled code and
 * emits a patch. This script is the only thing standing between that patch and
 * a privileged `git apply` + push, so it is deliberately paranoid and refuses
 * anything it does not positively recognise.
 *
 * It MUST be run from a checkout of the base branch, never from the pull
 * request: the allowlist comes from scripts/derived_artifacts.mjs, and a PR that
 * could supply its own copy of the registry could authorise writes to any path.
 *
 * Usage: node scripts/validate_derived_patch.mjs <patch-file>
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`Refusing patch: ${message}`);
  process.exit(1);
}

function allowlist() {
  const out = execFileSync(
    process.execPath,
    [resolve(repoRoot, "scripts/derived_artifacts.mjs"), "--list-paths"],
    { cwd: repoRoot, encoding: "utf-8" }
  );
  const paths = out.split("\n").map((line) => line.trim()).filter(Boolean);
  if (paths.length === 0) fail("the derived-artifact registry listed no paths.");
  return paths;
}

/**
 * A path is allowed when it *is* a registered entry or sits beneath one. The
 * prefix test appends "/" so that a registered "plugins/open-agreements" cannot
 * be stretched into "plugins/open-agreements-evil".
 */
function isAllowed(path, allowed) {
  return allowed.some((entry) => path === entry || path.startsWith(`${entry}/`));
}

function assertSafePath(path, allowed, context) {
  if (path.startsWith("/")) fail(`absolute path in ${context}: ${path}`);
  if (path.split("/").includes("..")) fail(`path traversal in ${context}: ${path}`);
  if (!isAllowed(path, allowed)) {
    fail(`${context} touches an unregistered path: ${path}`);
  }
}

/** Unquote a git diff path, dropping the a/ or b/ prefix. */
function normalize(raw) {
  let path = raw.trim();
  if (path.startsWith('"') && path.endsWith('"')) {
    // Git quotes paths containing specials; a quoted path in a machine-generated
    // patch over ASCII artifact names is unexpected enough to reject outright.
    fail(`quoted path in patch: ${path}`);
  }
  if (path === "/dev/null") return null;
  if (path.startsWith("a/") || path.startsWith("b/")) path = path.slice(2);
  return path;
}

const patchFile = process.argv[2];
if (!patchFile) fail("no patch file given.");

const patch = readFileSync(patchFile, "utf-8");
if (patch.trim().length === 0) fail("patch is empty.");

const allowed = allowlist();
let fileCount = 0;

for (const line of patch.split("\n")) {
  if (line.startsWith("diff --git ")) {
    fileCount += 1;
    // "diff --git a/x b/y" — split on " b/" so a space-bearing name still pairs.
    const rest = line.slice("diff --git ".length);
    const split = rest.indexOf(" b/");
    if (split === -1) fail(`unparseable diff header: ${line}`);
    const before = normalize(rest.slice(0, split));
    const after = normalize(rest.slice(split + 1));
    for (const path of [before, after]) {
      if (path) assertSafePath(path, allowed, "diff header");
    }
    continue;
  }

  if (line.startsWith("--- ") || line.startsWith("+++ ")) {
    const path = normalize(line.slice(4));
    if (path) assertSafePath(path, allowed, "file header");
    continue;
  }

  if (line.startsWith("rename from ") || line.startsWith("rename to ") ||
      line.startsWith("copy from ") || line.startsWith("copy to ")) {
    const path = normalize(line.slice(line.indexOf(" ", line.indexOf(" ") + 1) + 1));
    if (path) assertSafePath(path, allowed, "rename/copy header");
    continue;
  }

  // Symlinks turn a content write into a write anywhere the link points.
  if (/^(old|new|deleted file|new file) mode 120000$/.test(line.trim())) {
    fail("patch creates or modifies a symlink.");
  }
}

if (fileCount === 0) fail("patch contains no file diffs.");

console.log(
  `Patch accepted: ${fileCount} file diff(s), all within the ${allowed.length} registered derived path(s).`
);

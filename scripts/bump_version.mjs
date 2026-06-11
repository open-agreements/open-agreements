#!/usr/bin/env node

/**
 * Bump version across all manifests that the release preflight checks.
 *
 * Usage:  node scripts/bump_version.mjs <new-version>
 *         node scripts/bump_version.mjs --check
 * Example: node scripts/bump_version.mjs 0.7.0
 *
 * Updates:
 *   - package.json
 *   - packages/contracts-workspace-mcp/package.json
 *   - packages/contract-templates-mcp/package.json
 *   - packages/checklist-mcp/package.json
 *   - packages/signing/package.json
 *   - gemini-extension.json
 *   - .cursor-plugin/plugin.json
 *   - server.json (top-level version AND packages[].version)
 *
 * --check verifies every file above carries the same version and that
 * server.json satisfies MCP registry constraints, without writing anything.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VERSION_FILES = [
  "package.json",
  "packages/contracts-workspace-mcp/package.json",
  "packages/contract-templates-mcp/package.json",
  "packages/checklist-mcp/package.json",
  "packages/signing/package.json",
  "gemini-extension.json",
  ".cursor-plugin/plugin.json",
];

export const SERVER_JSON = "server.json";

// The official MCP registry rejects publishes whose description exceeds 100
// chars — a 422 at publish time, after npm has already shipped. Gate it at
// bump time instead (UseJunior/safe-docx#399).
export const REGISTRY_DESCRIPTION_MAX = 100;

const DEFAULT_ROOT = resolve(import.meta.dirname, "..");

function readJson(root, relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), "utf8"));
}

export function checkVersionSync(root = DEFAULT_ROOT) {
  const versions = new Map();
  const errors = [];

  for (const relPath of VERSION_FILES) {
    versions.set(relPath, readJson(root, relPath).version);
  }

  const serverJson = readJson(root, SERVER_JSON);
  versions.set(SERVER_JSON, serverJson.version);
  for (const [index, pkg] of (serverJson.packages ?? []).entries()) {
    versions.set(`${SERVER_JSON} packages[${index}]`, pkg.version);
  }

  const uniqueVersions = new Set(versions.values());
  if (uniqueVersions.size > 1) {
    errors.push("Version mismatch detected:");
    for (const [file, version] of versions) {
      errors.push(`  ${version ?? "(missing)"}  ${file}`);
    }
  }

  const description = serverJson.description ?? "";
  if (description.length > REGISTRY_DESCRIPTION_MAX) {
    errors.push(
      `${SERVER_JSON} description is ${description.length} chars; ` +
        `the MCP registry caps it at ${REGISTRY_DESCRIPTION_MAX}.`,
    );
  }

  return { ok: errors.length === 0, errors, versions };
}

export function bumpVersion(newVersion, root = DEFAULT_ROOT) {
  for (const relPath of VERSION_FILES) {
    const absPath = resolve(root, relPath);
    const raw = readFileSync(absPath, "utf8");
    const oldVersion = JSON.parse(raw).version;
    // Replace only the first "version" value to preserve all other formatting
    const updated = raw.replace(
      /("version"\s*:\s*")([^"]+)(")/,
      `$1${newVersion}$3`,
    );
    if (updated === raw && oldVersion !== newVersion) {
      throw new Error(`${relPath}: failed to locate version field`);
    }
    writeFileSync(absPath, updated);
    console.log(`  ${relPath}: ${oldVersion} -> ${newVersion}`);
  }

  // server.json carries the version twice: top-level and per registry
  // package. Both must move together or the registry publish ships a
  // wrong-versioned entry.
  const serverAbsPath = resolve(root, SERVER_JSON);
  const serverRaw = readFileSync(serverAbsPath, "utf8");
  const serverOldVersion = JSON.parse(serverRaw).version;
  const serverUpdated = serverRaw.replace(
    /("version"\s*:\s*")([^"]+)(")/g,
    `$1${newVersion}$3`,
  );
  if (serverUpdated === serverRaw && serverOldVersion !== newVersion) {
    throw new Error(`${SERVER_JSON}: failed to locate version field`);
  }
  writeFileSync(serverAbsPath, serverUpdated);
  console.log(`  ${SERVER_JSON}: ${serverOldVersion} -> ${newVersion}`);

  const result = checkVersionSync(root);
  if (!result.ok) {
    throw new Error(
      `version sync check failed after bump:\n${result.errors.join("\n")}`,
    );
  }
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node scripts/bump_version.mjs <new-version>");
    console.error("       node scripts/bump_version.mjs --check");
    console.error("Example: node scripts/bump_version.mjs 0.7.0");
    process.exit(1);
  }

  if (arg === "--check") {
    const result = checkVersionSync();
    if (!result.ok) {
      for (const line of result.errors) console.error(line);
      process.exit(1);
    }
    const version = [...result.versions.values()][0];
    console.log(
      `All ${result.versions.size} version fields are at ${version}.`,
    );
    return;
  }

  if (!/^\d+\.\d+\.\d+$/.test(arg)) {
    console.error(`Invalid semver: ${arg}`);
    process.exit(1);
  }

  bumpVersion(arg);
  console.log(
    `\nDone. All ${VERSION_FILES.length + 1} manifests set to ${arg}.`,
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`bump_version failed: ${message}`);
    process.exit(1);
  }
}

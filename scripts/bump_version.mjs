#!/usr/bin/env node

/**
 * Bump version across all manifests that the release preflight checks.
 *
 * Usage:  node scripts/bump_version.mjs <new-version>
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
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const VERSION_FILES = [
  "package.json",
  "packages/contracts-workspace-mcp/package.json",
  "packages/contract-templates-mcp/package.json",
  "packages/checklist-mcp/package.json",
  "packages/signing/package.json",
  "gemini-extension.json",
  ".cursor-plugin/plugin.json",
];

const newVersion = process.argv[2];
if (!newVersion) {
  console.error("Usage: node scripts/bump_version.mjs <new-version>");
  console.error("Example: node scripts/bump_version.mjs 0.7.0");
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(`Invalid semver: ${newVersion}`);
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");

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
    console.error(`  ${relPath}: FAILED to locate version field`);
    process.exit(1);
  }
  writeFileSync(absPath, updated);
  console.log(`  ${relPath}: ${oldVersion} -> ${newVersion}`);
}

console.log(`\nDone. All ${VERSION_FILES.length} manifests set to ${newVersion}.`);

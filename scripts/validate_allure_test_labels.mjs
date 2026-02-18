#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const TEST_PATH_RE = /^(integration-tests|src|packages\/[^/]+\/tests)\/.+\.test\.ts$/;

const helperImportRe = /from\s+['"][^'"]*helpers\/allure-test\.js['"]/;
const wrapperReferenceRe = /\b(itAllure|testAllure)\b/;
const epicWrapperAssignmentRe =
  /(?:const|let|var)\s+\w+\s*=\s*(?:itAllure|testAllure)\.(?:epic\(\s*['"`][^'"`]+['"`]\s*\)|withLabels\(\s*\{[\s\S]*?\bepic\s*:)/m;
const inlineEpicUsageRe =
  /\b(?:itAllure|testAllure)\.epic\(\s*['"`][^'"`]+['"`]\s*\)\s*\(/;
const inlineWithLabelsEpicUsageRe =
  /\b(?:itAllure|testAllure)\.withLabels\(\s*\{[\s\S]*?\bepic\s*:/m;

function walk(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.test.ts')) continue;
    const relative = absolute.slice(`${ROOT}/`.length);
    if (TEST_PATH_RE.test(relative)) out.push(relative);
  }
}

function discoverTestFiles() {
  const files = [];
  walk(join(ROOT, 'integration-tests'), files);
  walk(join(ROOT, 'src'), files);
  walk(join(ROOT, 'packages'), files);
  return [...new Set(files)].sort();
}

function normalizeInputFiles(rawFiles) {
  const normalized = rawFiles
    .map((file) => file.trim())
    .filter((file) => file.length > 0)
    .map((file) => file.replace(/^\.\//, ''))
    .filter((file) => TEST_PATH_RE.test(file));
  return [...new Set(normalized)].sort();
}

function parseVitestImports(body) {
  const imports = [];
  const vitestImportRe = /import\s*\{([^}]*)\}\s*from\s*['"]vitest['"]/g;
  let match = vitestImportRe.exec(body);
  while (match) {
    imports.push(
      ...match[1]
        .split(',')
        .map((specifier) => specifier.trim())
        .filter(Boolean)
        .map((specifier) => specifier.split(/\s+as\s+/)[0]?.trim())
        .filter(Boolean),
    );
    match = vitestImportRe.exec(body);
  }
  return imports;
}

function validateFile(relativePath) {
  const absolutePath = join(ROOT, relativePath);
  const body = readFileSync(absolutePath, 'utf-8');
  const errors = [];

  if (!helperImportRe.test(body)) {
    errors.push('must import the Allure helper (`helpers/allure-test.js`).');
  }

  if (!wrapperReferenceRe.test(body)) {
    errors.push('must reference `itAllure` or `testAllure`.');
  }

  const hasEpicAssignment =
    epicWrapperAssignmentRe.test(body) ||
    inlineEpicUsageRe.test(body) ||
    inlineWithLabelsEpicUsageRe.test(body);
  if (!hasEpicAssignment) {
    errors.push('must assign an explicit epic using `.epic(...)` or `.withLabels({ epic: ... })`.');
  }

  const vitestImports = parseVitestImports(body);
  if (vitestImports.includes('it') || vitestImports.includes('test')) {
    errors.push('must not import plain `it`/`test` from `vitest`; use `itAllure`/`testAllure` wrappers.');
  }

  return errors;
}

const cliFiles = normalizeInputFiles(process.argv.slice(2));
const filesToCheck = cliFiles.length > 0 ? cliFiles : discoverTestFiles();

if (filesToCheck.length === 0) {
  process.exit(0);
}

const failures = [];
for (const file of filesToCheck) {
  const errors = validateFile(file);
  if (errors.length > 0) {
    failures.push({ file, errors });
  }
}

if (failures.length > 0) {
  console.error('Allure label coverage check failed.\n');
  for (const failure of failures) {
    console.error(`- ${failure.file}`);
    for (const error of failure.errors) {
      console.error(`  - ${error}`);
    }
  }
  console.error('\nExpected outcome: Allure-style tests emit Epic/Feature/Story labels via shared wrappers.');
  process.exit(1);
}


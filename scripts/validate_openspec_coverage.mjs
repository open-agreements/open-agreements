#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SPEC_ROOT = path.join(REPO_ROOT, 'openspec', 'specs');
const DEFAULT_MATRIX_PATH = path.join(REPO_ROOT, 'tests', 'OPENSPEC_TRACEABILITY.md');
const TEST_SEARCH_ROOTS = [
  path.join(REPO_ROOT, 'tests'),
  path.join(REPO_ROOT, 'test'),
  path.join(REPO_ROOT, 'packages'),
];

function normalizeScenarioName(value) {
  return value
    .trim()
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s+/g, ' ');
}

function mdEscapeTableCell(value) {
  return String(value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function dirExists(dirPath) {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function listFilesRecursively(rootDir, predicate) {
  const out = [];
  const ignoredDirs = new Set([
    'node_modules',
    '.git',
    'dist',
    'coverage',
    'allure-results',
    'allure-report',
  ]);

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          continue;
        }
        await walk(full);
        continue;
      }
      if (predicate(full)) {
        out.push(full);
      }
    }
  }

  await walk(rootDir);
  return out.sort();
}

async function listSpecCapabilities() {
  const entries = await fs.readdir(SPEC_ROOT, { withFileTypes: true });
  const capabilities = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const specPath = path.join(SPEC_ROOT, entry.name, 'spec.md');
    if (await fileExists(specPath)) {
      capabilities.push(entry.name);
    }
  }
  return capabilities.sort();
}

async function listSpecFilesForCapability(capability) {
  const specPath = path.join(SPEC_ROOT, capability, 'spec.md');
  return (await fileExists(specPath)) ? [specPath] : [];
}

function parseScenariosFromSpec(content) {
  const scenarios = new Set();
  const scenarioHeader = /^\s*####\s+Scenario:\s*(.+?)\s*$/gm;
  let match = scenarioHeader.exec(content);
  while (match) {
    scenarios.add(normalizeScenarioName(match[1]));
    match = scenarioHeader.exec(content);
  }
  return scenarios;
}

function parseCapabilityFromTest(content, testFile) {
  const direct = content.match(/const\s+TEST_CAPABILITY\s*=\s*['"]([^'"]+)['"]/);
  if (direct) {
    return direct[1];
  }

  const described = content.match(/OpenSpec traceability:\s*([A-Za-z0-9_-]+)/);
  if (described) {
    return described[1];
  }

  if (!content.includes('OpenSpec Traceability')) {
    return null;
  }

  throw new Error(`Cannot infer TEST_CAPABILITY from ${testFile}`);
}

function parseStoriesFromTest(content) {
  const stories = new Set();

  const helperCalls = /tagScenario\(\s*['"`]([^'"`]+)['"`]\s*,/g;
  let match = helperCalls.exec(content);
  while (match) {
    stories.add(normalizeScenarioName(match[1]));
    match = helperCalls.exec(content);
  }

  const direct = /allure\.story\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  match = direct.exec(content);
  while (match) {
    stories.add(normalizeScenarioName(match[1]));
    match = direct.exec(content);
  }

  return stories;
}

function parseSkippedStoriesFromTest(content) {
  const skipped = new Set();
  const skippedPattern = /(?:test|it)\.(?:skip|todo)\(\s*['"`](?:Scenario:\s*)?([^'"`]+)['"`]/g;
  let match = skippedPattern.exec(content);
  while (match) {
    skipped.add(normalizeScenarioName(match[1]));
    match = skippedPattern.exec(content);
  }
  return skipped;
}

function parsePendingMarkersFromTest(content) {
  const markers = new Set();
  if (/\bpending_impl\b/i.test(content)) {
    markers.add('pending_impl');
  }
  if (/pending parity work/i.test(content)) {
    markers.add('pending parity work');
  }
  return [...markers].sort();
}

function printSet(title, values) {
  if (values.length === 0) {
    return;
  }
  console.error(`  ${title}:`);
  for (const value of values) {
    console.error(`    - ${value}`);
  }
}

async function validateCapabilityCoverage({ capability, testFiles }) {
  const storySet = new Set();
  const skippedStorySet = new Set();
  const pendingMarkerSet = new Set();
  const storyToFiles = new Map();

  for (const testFile of testFiles) {
    const content = await fs.readFile(testFile, 'utf-8');
    const relTestFile = path.relative(REPO_ROOT, testFile).split(path.sep).join('/');

    for (const story of parseStoriesFromTest(content)) {
      storySet.add(story);
      const files = storyToFiles.get(story) ?? new Set();
      files.add(relTestFile);
      storyToFiles.set(story, files);
    }

    for (const story of parseSkippedStoriesFromTest(content)) {
      skippedStorySet.add(story);
    }
    for (const marker of parsePendingMarkersFromTest(content)) {
      pendingMarkerSet.add(marker);
    }
  }

  const specFiles = await listSpecFilesForCapability(capability);
  if (specFiles.length === 0) {
    return {
      capability,
      ok: false,
      reason: `No canonical spec files found for capability '${capability}' under openspec/specs/${capability}/spec.md`,
      missing: [],
      extra: [],
      skippedStories: [...skippedStorySet].sort(),
      pendingMarkers: [...pendingMarkerSet].sort(),
      stories: [...storySet].sort(),
      scenarios: [],
      storyToFiles: Object.fromEntries(
        [...storyToFiles.entries()].map(([k, v]) => [k, [...v].sort()])
      ),
    };
  }

  const scenarioSet = new Set();
  for (const specFile of specFiles) {
    const content = await fs.readFile(specFile, 'utf-8');
    for (const scenario of parseScenariosFromSpec(content)) {
      scenarioSet.add(scenario);
    }
  }

  if (scenarioSet.size === 0) {
    return {
      capability,
      ok: false,
      reason: `No '#### Scenario:' entries found for capability '${capability}'`,
      missing: [],
      extra: [],
      skippedStories: [...skippedStorySet].sort(),
      pendingMarkers: [...pendingMarkerSet].sort(),
      stories: [...storySet].sort(),
      scenarios: [],
      storyToFiles: Object.fromEntries(
        [...storyToFiles.entries()].map(([k, v]) => [k, [...v].sort()])
      ),
    };
  }

  const scenarios = [...scenarioSet].sort();
  const stories = [...storySet].sort();
  const scenarioLookup = new Set(scenarios);
  const storyLookup = new Set(stories);

  const missing = scenarios.filter((scenario) => !storyLookup.has(scenario));
  const extra = stories.filter((story) => !scenarioLookup.has(story));
  const skippedStories = [...skippedStorySet].sort();
  const pendingMarkers = [...pendingMarkerSet].sort();

  return {
    capability,
    ok: missing.length === 0
      && extra.length === 0
      && skippedStories.length === 0
      && pendingMarkers.length === 0,
    reason: '',
    missing,
    extra,
    skippedStories,
    pendingMarkers,
    stories,
    scenarios,
    storyToFiles: Object.fromEntries(
      [...storyToFiles.entries()].map(([k, v]) => [k, [...v].sort()])
    ),
  };
}

function buildMatrixMarkdown({ reports, unknownTraceabilityCapabilities }) {
  const lines = [];
  lines.push('# OpenAgreements OpenSpec Traceability Matrix');
  lines.push('');
  lines.push('> Auto-generated by `scripts/validate_openspec_coverage.mjs`.');
  lines.push('> Do not hand-edit this file.');
  lines.push('');
  lines.push('This matrix maps canonical OpenSpec `#### Scenario:` entries to Allure story mappings extracted from `*.allure.test.ts` files.');
  lines.push('');

  for (const report of reports) {
    lines.push(`## Capability: \`${report.capability}\``);
    lines.push('');
    lines.push('| Scenario | Status | Allure Test Files | Notes |');
    lines.push('|---|---|---|---|');

    if (!report.scenarios || report.scenarios.length === 0) {
      lines.push(`| _No scenarios discovered_ | n/a | n/a | ${mdEscapeTableCell(report.reason || 'No scenarios found.')} |`);
      lines.push('');
      continue;
    }

    const skippedLookup = new Set(report.skippedStories ?? []);
    const missingLookup = new Set(report.missing ?? []);

    for (const scenario of report.scenarios) {
      const mappedFiles = report.storyToFiles?.[scenario] ?? [];
      const status = skippedLookup.has(scenario)
        ? 'pending_impl'
        : missingLookup.has(scenario)
          ? 'missing'
          : mappedFiles.length > 0
            ? 'covered'
            : 'missing';

      const fileCell = mappedFiles.length > 0
        ? mappedFiles.map((file) => `\`${file}\``).join(', ')
        : 'n/a';

      let notes = '';
      if (skippedLookup.has(scenario)) {
        notes = 'Mapped scenario is marked skip/todo in tests.';
      } else if (missingLookup.has(scenario)) {
        notes = 'No Allure story mapping found.';
      }

      lines.push(
        `| ${mdEscapeTableCell(scenario)} | ${status} | ${mdEscapeTableCell(fileCell)} | ${mdEscapeTableCell(notes)} |`
      );
    }

    if (report.extra && report.extra.length > 0) {
      lines.push('');
      lines.push('Extra stories not found in spec:');
      for (const value of report.extra) {
        lines.push(`- ${value}`);
      }
    }

    if (report.pendingMarkers && report.pendingMarkers.length > 0) {
      lines.push('');
      lines.push('Pending markers found in tests:');
      for (const value of report.pendingMarkers) {
        lines.push(`- ${value}`);
      }
    }

    lines.push('');
  }

  if (unknownTraceabilityCapabilities.length > 0) {
    lines.push('## Unknown Traceability Capabilities');
    lines.push('');
    lines.push('The following `TEST_CAPABILITY` values appear in tests but do not have a matching canonical spec capability:');
    lines.push('');
    for (const capability of unknownTraceabilityCapabilities) {
      lines.push(`- ${capability}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function writeMatrixFile(matrixPath, content) {
  let previous = '';
  try {
    previous = await fs.readFile(matrixPath, 'utf-8');
  } catch {
    previous = '';
  }

  await fs.mkdir(path.dirname(matrixPath), { recursive: true });
  await fs.writeFile(matrixPath, content, 'utf-8');
  return previous !== content;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const capabilities = [];
  let writeMatrixPath = DEFAULT_MATRIX_PATH;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--capability') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--capability requires a value');
      }
      capabilities.push(value);
      index += 1;
      continue;
    }
    if (arg === '--write-matrix') {
      const value = args[index + 1];
      if (value && !value.startsWith('--')) {
        writeMatrixPath = path.resolve(process.cwd(), value);
        index += 1;
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { capabilities, writeMatrixPath };
}

async function collectAllureTestFiles() {
  const files = [];
  for (const root of TEST_SEARCH_ROOTS) {
    if (!(await dirExists(root))) {
      continue;
    }
    const found = await listFilesRecursively(root, (file) => file.endsWith('.allure.test.ts'));
    files.push(...found);
  }
  return [...new Set(files)].sort();
}

async function main() {
  const { capabilities: requestedCapabilities, writeMatrixPath } = parseArgs();
  const canonicalCapabilities = await listSpecCapabilities();

  const allureTestFiles = await collectAllureTestFiles();
  const byCapability = new Map();

  for (const file of allureTestFiles) {
    const content = await fs.readFile(file, 'utf-8');
    const capability = parseCapabilityFromTest(content, file);
    if (!capability) {
      continue;
    }
    const list = byCapability.get(capability) ?? [];
    list.push(file);
    byCapability.set(capability, list);
  }

  const capabilitiesToValidate = requestedCapabilities.length > 0
    ? requestedCapabilities
    : canonicalCapabilities;

  if (capabilitiesToValidate.length === 0) {
    console.log('No canonical specs found under openspec/specs.');
    return;
  }

  let hasFailures = false;
  const reports = [];

  const unknownTraceabilityCapabilities = [...byCapability.keys()]
    .filter((capability) => !canonicalCapabilities.includes(capability))
    .sort();
  if (requestedCapabilities.length === 0 && unknownTraceabilityCapabilities.length > 0) {
    hasFailures = true;
    console.error('Found traceability tests with unknown TEST_CAPABILITY values:');
    for (const capability of unknownTraceabilityCapabilities) {
      console.error(`  - ${capability}`);
    }
  }

  for (const capability of capabilitiesToValidate) {
    const files = byCapability.get(capability) ?? [];
    if (files.length === 0) {
      reports.push({
        capability,
        ok: false,
        reason: `Capability '${capability}' is missing traceability tests.`,
        missing: [],
        extra: [],
        skippedStories: [],
        pendingMarkers: [],
        stories: [],
        scenarios: [],
        storyToFiles: {},
      });
      hasFailures = true;
      console.error(`Capability '${capability}' is missing traceability tests. Add a *.allure.test.ts file with TEST_CAPABILITY='${capability}'.`);
      continue;
    }

    const report = await validateCapabilityCoverage({ capability, testFiles: files });
    reports.push(report);
    if (report.ok) {
      console.log(`PASS ${capability}: ${report.scenarios.length} scenarios covered by ${report.stories.length} story mappings`);
      continue;
    }

    hasFailures = true;
    console.error(`FAIL ${capability}`);
    if (report.reason) {
      console.error(`  ${report.reason}`);
    }
    printSet('Missing stories for spec scenarios', report.missing);
    printSet('Extra stories not found in spec', report.extra);
    printSet('Skipped/todo scenarios in traceability tests', report.skippedStories);
    printSet('Pending markers in traceability tests', report.pendingMarkers);
  }

  const matrix = buildMatrixMarkdown({ reports, unknownTraceabilityCapabilities });
  const matrixChanged = await writeMatrixFile(writeMatrixPath, matrix);
  console.log(`Wrote traceability matrix: ${path.relative(REPO_ROOT, writeMatrixPath)}`);

  if (process.env.CI && matrixChanged) {
    hasFailures = true;
    console.error('Traceability matrix changed in CI. Commit updated matrix output.');
  }

  if (hasFailures) {
    process.exitCode = 1;
  }
}

await main();

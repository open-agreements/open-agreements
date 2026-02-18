#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SPEC_ROOT = path.join(REPO_ROOT, 'openspec', 'specs');
const DEFAULT_MATRIX_PATH = path.join(REPO_ROOT, 'integration-tests', 'OPENSPEC_TRACEABILITY.md');
const TEST_ROOTS = ['integration-tests', 'src'];
const TEST_FILE_PATTERN = /\.test\.(?:[cm]?ts|[cm]?js|tsx|jsx)$/;
const SCENARIO_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function normalizeScenarioName(value) {
  return value
    .trim()
    .replace(/\s+/g, ' ');
}

function mdEscapeTableCell(value) {
  return String(value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function parseScenarioHeader(value) {
  const normalized = normalizeScenarioName(value);
  const match = normalized.match(/^\[([^\]]+)\]\s+(.+)$/);
  if (!match) {
    return { id: '', title: normalized };
  }
  return {
    id: match[1].trim(),
    title: normalizeScenarioName(match[2]),
  };
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
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

function parseScenariosFromSpec(content, specPathRel) {
  const scenarios = [];
  const errors = [];
  const seenIds = new Set();
  const scenarioHeader = /^\s*####\s+Scenario:\s*(.+?)\s*$/gm;
  let match = scenarioHeader.exec(content);

  while (match) {
    const { id, title } = parseScenarioHeader(match[1]);
    if (!id) {
      errors.push(`${specPathRel}: scenario '${title}' is missing an explicit ID (use [OA-001] format).`);
      match = scenarioHeader.exec(content);
      continue;
    }
    if (!SCENARIO_ID_PATTERN.test(id)) {
      errors.push(`${specPathRel}: scenario ID '${id}' has invalid format.`);
      match = scenarioHeader.exec(content);
      continue;
    }
    if (seenIds.has(id)) {
      errors.push(`${specPathRel}: duplicate scenario ID '${id}'.`);
      match = scenarioHeader.exec(content);
      continue;
    }
    seenIds.add(id);
    scenarios.push({ id, title });
    match = scenarioHeader.exec(content);
  }

  return { scenarios, errors };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const capabilities = [];
  let writeMatrixRequested = false;
  let writeMatrixPath = null;
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
      writeMatrixRequested = true;
      const value = args[index + 1];
      if (value && !value.startsWith('--')) {
        writeMatrixPath = path.resolve(process.cwd(), value);
        index += 1;
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (writeMatrixRequested && !writeMatrixPath) {
    writeMatrixPath = DEFAULT_MATRIX_PATH;
  }
  return { capabilities, writeMatrixPath };
}

async function listTestFiles() {
  const files = [];

  async function walk(absDir) {
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      const absPath = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absPath);
        continue;
      }
      if (!TEST_FILE_PATTERN.test(entry.name)) {
        continue;
      }
      files.push(toPosixPath(path.relative(REPO_ROOT, absPath)));
    }
  }

  for (const root of TEST_ROOTS) {
    const absRoot = path.join(REPO_ROOT, root);
    try {
      const stat = await fs.stat(absRoot);
      if (!stat.isDirectory()) {
        continue;
      }
      await walk(absRoot);
    } catch {
      // Ignore missing test roots.
    }
  }

  return files.sort();
}

function getScriptKind(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs')) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function getStringLiteralValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function extractScenarioIdsFromOpenSpecArgs(args) {
  const values = [];
  const errors = [];

  for (const arg of args) {
    if (ts.isArrayLiteralExpression(arg)) {
      for (const element of arg.elements) {
        const value = getStringLiteralValue(element);
        if (value === null) {
          errors.push('openspec([...]) must contain only string literal IDs.');
          continue;
        }
        values.push(value.trim());
      }
      continue;
    }

    const value = getStringLiteralValue(arg);
    if (value === null) {
      errors.push('openspec(...) arguments must be string literal IDs or arrays of IDs.');
      continue;
    }
    values.push(value.trim());
  }

  return {
    ids: [...new Set(values.filter((value) => value.length > 0))],
    errors,
  };
}

function extractOpenSpecInvocation(node) {
  if (!ts.isCallExpression(node)) {
    return null;
  }

  // direct form: it.openspec('OA-001')('title', ...)
  if (ts.isCallExpression(node.expression)) {
    const inner = node.expression;
    if (
      ts.isPropertyAccessExpression(inner.expression)
      && inner.expression.name.text === 'openspec'
    ) {
      return {
        openspecCall: inner,
        status: 'covered',
      };
    }
  }

  // chained form: it.openspec('OA-001').skip('title', ...)
  if (ts.isPropertyAccessExpression(node.expression) && ts.isCallExpression(node.expression.expression)) {
    const method = node.expression.name.text;
    const inner = node.expression.expression;
    if (
      ts.isPropertyAccessExpression(inner.expression)
      && inner.expression.name.text === 'openspec'
    ) {
      return {
        openspecCall: inner,
        status: (method === 'skip' || method === 'todo') ? 'pending' : 'covered',
      };
    }
  }

  return null;
}

function createBindingRef({ relFile, sourceFile, node, title }) {
  const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const line = location.line + 1;
  return `${relFile}:${line} :: ${title}`;
}

async function collectOpenSpecBindings() {
  const testFiles = await listTestFiles();
  const bindingsByScenarioId = new Map();
  const invalidBindings = [];

  for (const relFile of testFiles) {
    const absFile = path.join(REPO_ROOT, relFile);
    const content = await fs.readFile(absFile, 'utf-8');
    const sourceFile = ts.createSourceFile(
      relFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(relFile)
    );

    function visit(node) {
      if (ts.isCallExpression(node)) {
        const invocation = extractOpenSpecInvocation(node);
        if (invocation) {
          const { openspecCall, status } = invocation;
          const titleNode = node.arguments[0];
          const title = titleNode
            ? (getStringLiteralValue(titleNode) ?? '<dynamic test title>')
            : '<missing test title>';

          const { ids, errors } = extractScenarioIdsFromOpenSpecArgs(openspecCall.arguments);
          for (const error of errors) {
            invalidBindings.push(`${relFile}: ${error} (test: ${title})`);
          }
          if (ids.length === 0) {
            invalidBindings.push(`${relFile}: openspec(...) has no scenario IDs (test: ${title})`);
          }

          const ref = createBindingRef({ relFile, sourceFile, node, title });
          for (const id of ids) {
            if (!SCENARIO_ID_PATTERN.test(id)) {
              invalidBindings.push(`${relFile}: invalid scenario ID '${id}' (test: ${title})`);
              continue;
            }
            const existing = bindingsByScenarioId.get(id) ?? [];
            if (!existing.some((entry) => entry.ref === ref)) {
              existing.push({ ref, status });
            }
            bindingsByScenarioId.set(id, existing);
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return {
    bindingsByScenarioId,
    invalidBindings: [...new Set(invalidBindings)].sort(),
    testFiles,
  };
}

function createEmptyCapabilityReport(capability) {
  return {
    capability,
    ok: false,
    reason: '',
    scenarios: [],
    missing: [],
    pending: [],
    scenarioToBindings: {},
  };
}

function validateCapabilityCoverage({ capability, scenarios, bindingsByScenarioId }) {
  const report = createEmptyCapabilityReport(capability);
  report.scenarios = [...scenarios].sort((a, b) => a.id.localeCompare(b.id));

  if (report.scenarios.length === 0) {
    report.reason = `No '#### Scenario:' entries found for capability '${capability}'`;
    return report;
  }

  const missing = [];
  const pending = [];
  const scenarioToBindings = {};

  for (const scenario of report.scenarios) {
    const bindings = bindingsByScenarioId.get(scenario.id) ?? [];
    const renderedBindings = bindings
      .map((entry) => entry.ref)
      .sort();

    scenarioToBindings[scenario.id] = renderedBindings;

    if (bindings.length === 0) {
      missing.push(scenario.id);
      continue;
    }

    const hasCoveredBinding = bindings.some((entry) => entry.status === 'covered');
    if (!hasCoveredBinding) {
      pending.push(scenario.id);
    }
  }

  report.missing = [...new Set(missing)].sort();
  report.pending = [...new Set(pending)].sort();
  report.scenarioToBindings = scenarioToBindings;
  report.ok = report.missing.length === 0 && report.pending.length === 0;
  return report;
}

function buildMatrixMarkdown({ reports, unknownScenarioIds, invalidBindings }) {
  const lines = [];
  lines.push('# OpenAgreements OpenSpec Traceability Matrix');
  lines.push('');
  lines.push('> Auto-generated by `scripts/validate_openspec_coverage.mjs`.');
  lines.push('> Do not hand-edit this file.');
  lines.push('');
  lines.push('This matrix maps canonical OpenSpec `#### Scenario:` entries to test-local `.openspec(...)` bindings.');
  lines.push('');

  for (const report of reports) {
    lines.push(`## Capability: \`${report.capability}\``);
    lines.push('');
    lines.push('| Scenario | Status | Mapped Tests | Notes |');
    lines.push('|---|---|---|---|');

    if (!report.scenarios || report.scenarios.length === 0) {
      lines.push(`| _No scenarios discovered_ | n/a | n/a | ${mdEscapeTableCell(report.reason || 'No scenarios found.')} |`);
      lines.push('');
      continue;
    }

    const missingLookup = new Set(report.missing ?? []);
    const pendingLookup = new Set(report.pending ?? []);

    for (const scenario of report.scenarios) {
      const mappedTests = report.scenarioToBindings?.[scenario.id] ?? [];
      const isMissing = missingLookup.has(scenario.id);
      const isPending = pendingLookup.has(scenario.id);

      const status = isPending
        ? 'pending_impl'
        : isMissing
          ? 'missing'
          : 'covered';

      const mappedCell = mappedTests.length > 0
        ? mappedTests.map((testRef) => `\`${testRef}\``).join(', ')
        : 'n/a';

      let notes = '';
      if (isPending) {
        notes = 'Mapped test exists but is skip/todo.';
      } else if (isMissing) {
        notes = 'No test with matching .openspec(...) annotation found.';
      }

      lines.push(
        `| ${mdEscapeTableCell(`[${scenario.id}] ${scenario.title}`)} | ${status} | ${mdEscapeTableCell(mappedCell)} | ${mdEscapeTableCell(notes)} |`
      );
    }

    lines.push('');
  }

  if (unknownScenarioIds.length > 0) {
    lines.push('## Unknown Scenario IDs');
    lines.push('');
    lines.push('The following IDs are used in tests but not found in canonical specs:');
    lines.push('');
    for (const id of unknownScenarioIds) {
      lines.push(`- ${id}`);
    }
    lines.push('');
  }

  if (invalidBindings.length > 0) {
    lines.push('## Invalid Test Bindings');
    lines.push('');
    for (const value of invalidBindings) {
      lines.push(`- ${value}`);
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

function printSet(title, values) {
  if (values.length === 0) {
    return;
  }
  console.error(`  ${title}:`);
  for (const value of values) {
    console.error(`    - ${value}`);
  }
}

async function main() {
  const { capabilities: requestedCapabilities, writeMatrixPath } = parseArgs();
  const canonicalCapabilities = await listSpecCapabilities();
  const capabilitiesToValidate = requestedCapabilities.length > 0
    ? requestedCapabilities
    : canonicalCapabilities;

  if (capabilitiesToValidate.length === 0) {
    console.log('No canonical specs found under openspec/specs.');
    return;
  }

  const { bindingsByScenarioId, invalidBindings } = await collectOpenSpecBindings();
  let hasFailures = false;
  const reports = [];
  const canonicalScenarioIdToCapability = new Map();
  const duplicateScenarioIds = [];
  const specParseErrors = [];

  for (const capability of capabilitiesToValidate) {
    const specFiles = await listSpecFilesForCapability(capability);
    if (specFiles.length === 0) {
      const report = createEmptyCapabilityReport(capability);
      report.reason = `No canonical spec files found for capability '${capability}' under openspec/specs/${capability}/spec.md`;
      reports.push(report);
      hasFailures = true;
      console.error(`FAIL ${capability}`);
      console.error(`  ${report.reason}`);
      continue;
    }

    const scenarios = [];
    for (const specFile of specFiles) {
      const content = await fs.readFile(specFile, 'utf-8');
      const relSpecPath = toPosixPath(path.relative(REPO_ROOT, specFile));
      const parsed = parseScenariosFromSpec(content, relSpecPath);
      scenarios.push(...parsed.scenarios);
      specParseErrors.push(...parsed.errors);
    }

    const dedupedScenarios = [];
    const seenScenarioIds = new Set();
    for (const scenario of scenarios) {
      if (seenScenarioIds.has(scenario.id)) {
        specParseErrors.push(`Capability '${capability}' defines duplicate scenario ID '${scenario.id}'.`);
        continue;
      }
      seenScenarioIds.add(scenario.id);
      dedupedScenarios.push(scenario);

      const existingCapability = canonicalScenarioIdToCapability.get(scenario.id);
      if (existingCapability && existingCapability !== capability) {
        duplicateScenarioIds.push(`${scenario.id} (used by ${existingCapability} and ${capability})`);
      } else {
        canonicalScenarioIdToCapability.set(scenario.id, capability);
      }
    }

    const report = validateCapabilityCoverage({
      capability,
      scenarios: dedupedScenarios,
      bindingsByScenarioId,
    });
    reports.push(report);

    if (report.ok) {
      console.log(`PASS ${capability}: ${report.scenarios.length} scenarios covered by test-local .openspec(...) bindings`);
      continue;
    }

    hasFailures = true;
    console.error(`FAIL ${capability}`);
    if (report.reason) {
      console.error(`  ${report.reason}`);
    }
    printSet('Missing scenario IDs', report.missing ?? []);
    printSet('Scenario IDs mapped only to skipped/todo tests', report.pending ?? []);
  }

  if (specParseErrors.length > 0) {
    hasFailures = true;
    console.error('Spec scenario parse errors:');
    printSet('Errors', [...new Set(specParseErrors)].sort());
  }

  if (duplicateScenarioIds.length > 0) {
    hasFailures = true;
    console.error('Duplicate scenario IDs across capabilities:');
    printSet('Duplicates', [...new Set(duplicateScenarioIds)].sort());
  }

  if (invalidBindings.length > 0) {
    hasFailures = true;
    console.error('Invalid .openspec(...) test bindings:');
    printSet('Invalid bindings', invalidBindings);
  }

  const unknownScenarioIds = [...bindingsByScenarioId.keys()]
    .filter((scenarioId) => !canonicalScenarioIdToCapability.has(scenarioId))
    .sort();

  if (unknownScenarioIds.length > 0) {
    hasFailures = true;
    console.error('Found test bindings for unknown scenario IDs:');
    printSet('Unknown scenario IDs', unknownScenarioIds);
  }

  const matrix = buildMatrixMarkdown({
    reports,
    unknownScenarioIds,
    invalidBindings,
  });
  if (writeMatrixPath) {
    await writeMatrixFile(writeMatrixPath, matrix);
    console.log(`Wrote traceability matrix: ${path.relative(REPO_ROOT, writeMatrixPath)}`);
  } else {
    console.log('Traceability matrix not written (use --write-matrix [path] to export).');
  }

  if (hasFailures) {
    process.exitCode = 1;
  }
}

await main();

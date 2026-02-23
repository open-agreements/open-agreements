#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const CHANGES_ROOT = path.join(REPO_ROOT, 'openspec', 'changes');
const SPEC_ROOT = path.join(REPO_ROOT, 'openspec', 'specs');
const DEFAULT_MATRIX_PATH = path.join(REPO_ROOT, 'integration-tests', 'OPENSPEC_TRACEABILITY.md');
const TEST_ROOTS = ['integration-tests', 'src'];
const TEST_FILE_PATTERN = /\.test\.(?:[cm]?ts|[cm]?js|tsx|jsx)$/;
const SCENARIO_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const SCENARIO_HEADER_RE = /^\s*####\s+Scenario:\s*(.+?)\s*$/;
const SCENARIO_BLOCK_TERMINATOR_RE = /^\s*(?:###\s+Requirement:|##\s+)/;
const SCENARIO_WHEN_RE = /^\s*-\s+\*\*WHEN\*\*/i;
const SCENARIO_THEN_RE = /^\s*-\s+\*\*THEN\*\*/i;
const REPO_PATH_REFERENCE_RE = /\b(?:src|integration-tests|packages|openspec|scripts)\/[A-Za-z0-9._/-]*/;
const ABSOLUTE_PATH_REFERENCE_RE = /(?:^|[`'"])(?:\/Users\/|\/home\/|[A-Za-z]:\\)/;
const REGRESSION_TITLE_RE = /\b(?:regression|hotfix|bugfix|workaround)\b/i;
const ALLURE_HELPER_IMPORT_RE = /(?:^|\/)helpers\/allure-test\.js$/;
const ALLURE_WRAPPER_EXPORT_NAMES = new Set(['itAllure', 'testAllure']);
const ALLURE_WRAPPER_CHAIN_METHODS = new Set(['epic', 'withLabels', 'openspec']);

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

async function listActiveChangeSpecFiles(changesRoot = CHANGES_ROOT) {
  const out = [];
  let changeEntries;
  try {
    changeEntries = await fs.readdir(changesRoot, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const changeEntry of changeEntries) {
    if (!changeEntry.isDirectory() || changeEntry.name === 'archive') {
      continue;
    }

    const specsRoot = path.join(changesRoot, changeEntry.name, 'specs');
    let capabilityEntries;
    try {
      capabilityEntries = await fs.readdir(specsRoot, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const capabilityEntry of capabilityEntries) {
      if (!capabilityEntry.isDirectory()) {
        continue;
      }
      const specPath = path.join(specsRoot, capabilityEntry.name, 'spec.md');
      if (!(await fileExists(specPath))) {
        continue;
      }
      out.push({
        changeId: changeEntry.name,
        capability: capabilityEntry.name,
        specPath,
      });
    }
  }

  return out.sort((a, b) => a.specPath.localeCompare(b.specPath));
}

export async function collectScenarioIdsFromActiveChangeSpecs({
  changesRoot = CHANGES_ROOT,
  repoRoot = REPO_ROOT,
} = {}) {
  const scenarioIdToSources = new Map();
  const specFiles = await listActiveChangeSpecFiles(changesRoot);

  for (const specFile of specFiles) {
    const content = await fs.readFile(specFile.specPath, 'utf-8');
    const relSpecPath = toPosixPath(path.relative(repoRoot, specFile.specPath));
    const parsed = parseScenariosFromSpec(content, relSpecPath);

    for (const scenario of parsed.scenarios) {
      const existing = scenarioIdToSources.get(scenario.id) ?? [];
      if (!existing.includes(relSpecPath)) {
        existing.push(relSpecPath);
      }
      scenarioIdToSources.set(scenario.id, existing);
    }
  }

  return { scenarioIdToSources };
}

function formatSpecLocation(specPathRel, line) {
  if (Number.isInteger(line) && line > 0) {
    return `${specPathRel}:${line}`;
  }
  return specPathRel;
}

function findPathDependentReference(values) {
  for (const value of values) {
    const normalized = normalizeScenarioName(value);
    if (normalized.length === 0) {
      continue;
    }
    if (REPO_PATH_REFERENCE_RE.test(normalized) || ABSOLUTE_PATH_REFERENCE_RE.test(normalized)) {
      return normalized;
    }
  }
  return null;
}

function validateScenarioAuthoring({ specPathRel, line, id, title, bodyLines }) {
  const errors = [];
  const scenarioLabel = id || title || '<unnamed scenario>';
  const location = formatSpecLocation(specPathRel, line);

  const hasWhen = bodyLines.some((value) => SCENARIO_WHEN_RE.test(value));
  if (!hasWhen) {
    errors.push(
      `${location}: scenario '${scenarioLabel}' must include at least one **WHEN** bullet to stay behavior-oriented.`
    );
  }

  const hasThen = bodyLines.some((value) => SCENARIO_THEN_RE.test(value));
  if (!hasThen) {
    errors.push(
      `${location}: scenario '${scenarioLabel}' must include at least one **THEN** bullet to stay behavior-oriented.`
    );
  }

  if (REGRESSION_TITLE_RE.test(title)) {
    errors.push(
      `${location}: scenario '${scenarioLabel}' title should describe durable behavior, not a one-off regression label.`
    );
  }

  const pathReference = findPathDependentReference([title, ...bodyLines]);
  if (pathReference) {
    errors.push(
      `${location}: scenario '${scenarioLabel}' references '${pathReference}'. Specs should be path-independent.`
    );
  }

  return errors;
}

export function parseScenariosFromSpec(content, specPathRel) {
  const scenarios = [];
  const errors = [];
  const seenIds = new Set();
  const lines = content.split(/\r?\n/);
  let pendingScenario = null;

  function flushPendingScenario() {
    if (!pendingScenario) {
      return;
    }

    const { id, title } = parseScenarioHeader(pendingScenario.header);
    errors.push(
      ...validateScenarioAuthoring({
        specPathRel,
        line: pendingScenario.line,
        id,
        title,
        bodyLines: pendingScenario.bodyLines,
      })
    );

    if (!id) {
      errors.push(
        `${formatSpecLocation(specPathRel, pendingScenario.line)}: scenario '${title}' is missing an explicit ID (use [OA-001] format).`
      );
      pendingScenario = null;
      return;
    }
    if (!SCENARIO_ID_PATTERN.test(id)) {
      errors.push(`${formatSpecLocation(specPathRel, pendingScenario.line)}: scenario ID '${id}' has invalid format.`);
      pendingScenario = null;
      return;
    }
    if (seenIds.has(id)) {
      errors.push(`${formatSpecLocation(specPathRel, pendingScenario.line)}: duplicate scenario ID '${id}'.`);
      pendingScenario = null;
      return;
    }
    seenIds.add(id);
    scenarios.push({ id, title });
    pendingScenario = null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (pendingScenario && SCENARIO_BLOCK_TERMINATOR_RE.test(line)) {
      flushPendingScenario();
    }

    const match = line.match(SCENARIO_HEADER_RE);
    if (match) {
      flushPendingScenario();
      pendingScenario = {
        header: match[1],
        line: index + 1,
        bodyLines: [],
      };
      continue;
    }
    if (pendingScenario) {
      pendingScenario.bodyLines.push(line);
    }
  }
  flushPendingScenario();

  return { scenarios, errors };
}

export function parseArgs(argv = process.argv.slice(2), cwd = process.cwd()) {
  const args = argv;
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
        writeMatrixPath = path.resolve(cwd, value);
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
        openspecRoot: inner.expression.expression,
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
        openspecRoot: inner.expression.expression,
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

function getImportModuleSpecifier(node) {
  if (!ts.isImportDeclaration(node)) {
    return null;
  }
  if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
    return null;
  }
  return node.moduleSpecifier.text;
}

function collectAllureImportAliases(sourceFile) {
  const aliases = new Set();
  for (const statement of sourceFile.statements) {
    const moduleSpecifier = getImportModuleSpecifier(statement);
    if (!moduleSpecifier || !ALLURE_HELPER_IMPORT_RE.test(moduleSpecifier)) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) {
      continue;
    }
    for (const element of bindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (ALLURE_WRAPPER_EXPORT_NAMES.has(importedName)) {
        aliases.add(element.name.text);
      }
    }
  }
  return aliases;
}

function unwrapExpression(node) {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return unwrapExpression(node.expression);
  }
  return node;
}

function isAllureWrapperExpression(node, knownWrapperAliases) {
  const expression = unwrapExpression(node);
  if (ts.isIdentifier(expression)) {
    return knownWrapperAliases.has(expression.text);
  }

  if (ts.isPropertyAccessExpression(expression)) {
    if (!ALLURE_WRAPPER_CHAIN_METHODS.has(expression.name.text)) {
      return false;
    }
    return isAllureWrapperExpression(expression.expression, knownWrapperAliases);
  }

  if (ts.isCallExpression(expression)) {
    if (!ts.isPropertyAccessExpression(expression.expression)) {
      return false;
    }
    const methodName = expression.expression.name.text;
    if (!ALLURE_WRAPPER_CHAIN_METHODS.has(methodName)) {
      return false;
    }
    return isAllureWrapperExpression(expression.expression.expression, knownWrapperAliases);
  }

  return false;
}

function collectAllureWrapperAliases(sourceFile) {
  const knownAliases = collectAllureImportAliases(sourceFile);
  const declarations = [];

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) {
      const alias = declaration.name.text;
      if (knownAliases.has(alias)) {
        continue;
      }
      if (isAllureWrapperExpression(declaration.initializer, knownAliases)) {
        knownAliases.add(alias);
        changed = true;
      }
    }
  }

  return knownAliases;
}

function mergeBindings(target, source) {
  for (const [scenarioId, entries] of source.entries()) {
    const existing = target.get(scenarioId) ?? [];
    for (const entry of entries) {
      if (!existing.some((candidate) => candidate.ref === entry.ref && candidate.status === entry.status)) {
        existing.push(entry);
      }
    }
    target.set(scenarioId, existing);
  }
}

export function collectOpenSpecBindingsFromSource({ relFile, content }) {
  const bindingsByScenarioId = new Map();
  const invalidBindings = [];
  const sourceFile = ts.createSourceFile(
    relFile,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(relFile)
  );
  const knownAllureWrappers = collectAllureWrapperAliases(sourceFile);

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const invocation = extractOpenSpecInvocation(node);
      if (invocation) {
        const { openspecCall, openspecRoot, status } = invocation;
        const titleNode = node.arguments[0];
        const title = titleNode
          ? (getStringLiteralValue(titleNode) ?? '<dynamic test title>')
          : '<missing test title>';

        if (!isAllureWrapperExpression(openspecRoot, knownAllureWrappers)) {
          invalidBindings.push(
            `${relFile}: .openspec(...) must use an Allure wrapper derived from itAllure/testAllure (test: ${title})`
          );
          ts.forEachChild(node, visit);
          return;
        }

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
  return {
    bindingsByScenarioId,
    invalidBindings: [...new Set(invalidBindings)].sort(),
  };
}

export function computeUnknownScenarioIds(bindingsByScenarioId, knownScenarioIds) {
  return [...bindingsByScenarioId.keys()]
    .filter((scenarioId) => !knownScenarioIds.has(scenarioId))
    .sort();
}

async function collectOpenSpecBindings() {
  const testFiles = await listTestFiles();
  const bindingsByScenarioId = new Map();
  const invalidBindings = [];

  for (const relFile of testFiles) {
    const absFile = path.join(REPO_ROOT, relFile);
    const content = await fs.readFile(absFile, 'utf-8');
    const parsed = collectOpenSpecBindingsFromSource({ relFile, content });
    mergeBindings(bindingsByScenarioId, parsed.bindingsByScenarioId);
    invalidBindings.push(...parsed.invalidBindings);
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
    lines.push('The following IDs are used in tests but not found in canonical specs or active change specs:');
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

export async function main(argv = process.argv.slice(2)) {
  const { capabilities: requestedCapabilities, writeMatrixPath } = parseArgs(argv);
  const canonicalCapabilities = await listSpecCapabilities();
  const { scenarioIdToSources: activeChangeScenarioIdToSources } = await collectScenarioIdsFromActiveChangeSpecs();
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

  const knownScenarioIds = new Set([...canonicalScenarioIdToCapability.keys(), ...activeChangeScenarioIdToSources.keys()]);
  const unknownScenarioIds = computeUnknownScenarioIds(bindingsByScenarioId, knownScenarioIds);

  if (unknownScenarioIds.length > 0) {
    hasFailures = true;
    console.error('Found test bindings for unknown scenario IDs (not present in canonical specs or active change specs):');
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

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await main();
}

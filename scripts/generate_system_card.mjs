#!/usr/bin/env node

/**
 * Generate the OpenAgreements System Card.
 *
 * Inputs:
 *   - OpenSpec traceability matrix (from validate_openspec_coverage.mjs --write-matrix)
 *   - Runtime trust data (site/_data/systemCardRuntime.json)
 *
 * Output:
 *   - site/trust/system-card.md (Eleventy page with frontmatter)
 *
 * Usage:
 *   node scripts/generate_system_card.mjs
 *   node scripts/generate_system_card.mjs --output site/trust/system-card.md
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const TRACEABILITY_PATH = path.join(
  REPO_ROOT,
  "integration-tests",
  "OPENSPEC_TRACEABILITY.md",
);
const RUNTIME_DATA_PATH = path.join(
  REPO_ROOT,
  "site",
  "_data",
  "systemCardRuntime.json",
);
const ALLURE_TEST_RESULTS_PATH = path.join(
  REPO_ROOT,
  "allure-report",
  "data",
  "test-results",
);

const TEST_ROOTS = ["integration-tests", "src", "packages"];
const TEST_FILE_PATTERN = /\.test\.(?:[cm]?ts|[cm]?js|tsx|jsx)$/;
const ALLURE_HELPER_IMPORT_RE = /(?:^|\/)helpers\/allure-test\.js$/;
const ALLURE_WRAPPER_EXPORT_NAMES = new Set(["itAllure", "testAllure"]);
const ALLURE_WRAPPER_CHAIN_METHODS = new Set(["epic", "withLabels", "openspec"]);
const UNKNOWN_EPIC_LABEL = "No epic label";
const UNMAPPED_EPIC_LABEL = "Unmapped";
const MAPPED_TEST_REF_RE = /^(.+?):(\d+)\s+::\s+(.+)$/;
const DEFAULT_ALLURE_REPORT_URL = "https://tests.openagreements.ai";
const GITHUB_BLOB_ROOT = "https://github.com/open-agreements/open-agreements/blob";

function parseArgs() {
  const args = process.argv.slice(2);
  let outputPath = path.join(REPO_ROOT, "site", "trust", "system-card.md");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output") {
      const value = args[i + 1];
      if (!value) throw new Error("--output requires a path value");
      outputPath = path.resolve(process.cwd(), value);
      i++;
      continue;
    }
    throw new Error(`Unknown argument: ${args[i]}`);
  }
  return { outputPath };
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

async function listTestFiles() {
  const files = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
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
      if (!stat.isDirectory()) continue;
      await walk(absRoot);
    } catch {
      // Ignore missing test roots.
    }
  }

  return files.sort();
}

function getScriptKind(filePath) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
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

function unwrapExpression(node) {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return unwrapExpression(node.expression);
  }
  return node;
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
      && inner.expression.name.text === "openspec"
    ) {
      return {
        openspecRoot: inner.expression.expression,
      };
    }
  }

  // chained form: it.openspec('OA-001').skip('title', ...)
  if (ts.isPropertyAccessExpression(node.expression) && ts.isCallExpression(node.expression.expression)) {
    const inner = node.expression.expression;
    if (
      ts.isPropertyAccessExpression(inner.expression)
      && inner.expression.name.text === "openspec"
    ) {
      return {
        openspecRoot: inner.expression.expression,
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

function resolveEpicFromWrapperExpression(node, aliasToEpic) {
  const expression = unwrapExpression(node);
  if (ts.isIdentifier(expression)) {
    return aliasToEpic.get(expression.text) ?? null;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    if (!ALLURE_WRAPPER_CHAIN_METHODS.has(expression.name.text)) {
      return null;
    }
    return resolveEpicFromWrapperExpression(expression.expression, aliasToEpic);
  }

  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
    const methodName = expression.expression.name.text;
    if (!ALLURE_WRAPPER_CHAIN_METHODS.has(methodName)) {
      return null;
    }
    const baseEpic = resolveEpicFromWrapperExpression(expression.expression.expression, aliasToEpic);
    if (methodName === "epic") {
      const epic = getStringLiteralValue(expression.arguments[0]);
      if (epic && epic.trim().length > 0) {
        return epic.trim();
      }
    }
    return baseEpic;
  }

  return null;
}

function collectAllureWrapperEpics(sourceFile) {
  const knownAliases = collectAllureImportAliases(sourceFile);
  const aliasToEpic = new Map();
  const declarations = [];

  for (const alias of knownAliases) {
    aliasToEpic.set(alias, null);
  }

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
      if (!isAllureWrapperExpression(declaration.initializer, knownAliases)) {
        continue;
      }
      if (!knownAliases.has(alias)) {
        knownAliases.add(alias);
        changed = true;
      }
      const epic = resolveEpicFromWrapperExpression(declaration.initializer, aliasToEpic);
      const normalizedEpic = epic ?? null;
      if ((aliasToEpic.get(alias) ?? null) !== normalizedEpic) {
        aliasToEpic.set(alias, normalizedEpic);
        changed = true;
      }
    }
  }

  return { knownAliases, aliasToEpic };
}

async function collectBindingEpicMap() {
  const bindingEpicByRef = new Map();
  const testFiles = await listTestFiles();

  for (const relFile of testFiles) {
    const absFile = path.join(REPO_ROOT, relFile);
    const content = await fs.readFile(absFile, "utf-8");
    const sourceFile = ts.createSourceFile(
      relFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(relFile),
    );
    const { knownAliases, aliasToEpic } = collectAllureWrapperEpics(sourceFile);

    function visit(node) {
      if (ts.isCallExpression(node)) {
        const invocation = extractOpenSpecInvocation(node);
        if (
          invocation
          && isAllureWrapperExpression(invocation.openspecRoot, knownAliases)
        ) {
          const titleNode = node.arguments[0];
          const title = titleNode
            ? (getStringLiteralValue(titleNode) ?? "<dynamic test title>")
            : "<missing test title>";
          const ref = createBindingRef({ relFile, sourceFile, node, title });
          const epic = resolveEpicFromWrapperExpression(invocation.openspecRoot, aliasToEpic)
            ?? UNKNOWN_EPIC_LABEL;
          if (!bindingEpicByRef.has(ref)) {
            bindingEpicByRef.set(ref, epic);
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return bindingEpicByRef;
}

function parseMappedTestRefs(cellValue) {
  const refs = [];
  const regex = /`([^`]+)`/g;
  let match;
  while ((match = regex.exec(cellValue)) !== null) {
    const ref = match[1].trim();
    if (ref.length > 0) {
      refs.push(ref);
    }
  }
  return refs;
}

function normalizeTestPath(value) {
  return toPosixPath(String(value ?? "").trim()).replace(/^\.\//, "");
}

function normalizeTestTitle(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function makeAllureLookupKey(filePath, title) {
  return `${normalizeTestPath(filePath)}::${normalizeTestTitle(title)}`;
}

function parseMappedTestRef(ref) {
  const match = String(ref).match(MAPPED_TEST_REF_RE);
  if (!match) return null;
  const line = Number(match[2]);
  if (!Number.isFinite(line) || line <= 0) return null;
  return {
    filePath: normalizeTestPath(match[1]),
    line,
    title: normalizeTestTitle(match[3]),
  };
}

function extractFilePathFromAllureFullName(fullName) {
  if (typeof fullName !== "string") return null;
  const hashIndex = fullName.indexOf("#");
  if (hashIndex <= 0) return null;
  return normalizeTestPath(fullName.slice(0, hashIndex));
}

async function loadAllureTestResultIndex() {
  const byRef = new Map();

  let fileNames;
  try {
    fileNames = await fs.readdir(ALLURE_TEST_RESULTS_PATH);
  } catch {
    return { available: false, byRef };
  }

  for (const fileName of fileNames) {
    if (!fileName.endsWith(".json")) continue;
    const absPath = path.join(ALLURE_TEST_RESULTS_PATH, fileName);
    let parsed;
    try {
      parsed = JSON.parse(await fs.readFile(absPath, "utf-8"));
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object") continue;
    const testResultId = typeof parsed.id === "string" ? parsed.id : null;
    const testName = typeof parsed.name === "string" ? parsed.name : null;
    const filePath = extractFilePathFromAllureFullName(parsed.fullName);
    if (!testResultId || !testName || !filePath) continue;

    const key = makeAllureLookupKey(filePath, testName);
    if (!byRef.has(key)) {
      byRef.set(key, testResultId);
    }
  }

  return { available: true, byRef };
}

function normalizeScenarioStatus(status) {
  return status === "covered" ? "covered" : "missing";
}

function pickPrimaryEpic(mappedTestRefs, bindingEpicByRef) {
  if (mappedTestRefs.length === 0) {
    return UNMAPPED_EPIC_LABEL;
  }

  const counts = new Map();
  for (const ref of mappedTestRefs) {
    const epic = bindingEpicByRef.get(ref) ?? UNKNOWN_EPIC_LABEL;
    counts.set(epic, (counts.get(epic) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))[0]?.[0]
    ?? UNKNOWN_EPIC_LABEL;
}

function buildEpicBreakdown(rows, bindingEpicByRef) {
  const byEpic = new Map();

  for (const row of rows) {
    const epic = pickPrimaryEpic(row.mappedTestRefs, bindingEpicByRef);
    const existing = byEpic.get(epic) ?? {
      epic,
      total: 0,
      covered: 0,
      missing: 0,
      scenarios: [],
    };

    existing.total += 1;
    if (row.status === "covered") {
      existing.covered += 1;
    } else {
      existing.missing += 1;
    }

    existing.scenarios.push({
      scenario: row.scenario,
      status: row.status,
      mappedTestRefs: row.mappedTestRefs,
    });

    byEpic.set(epic, existing);
  }

  const breakdown = [...byEpic.values()].sort(
    (a, b) => (b.total - a.total) || a.epic.localeCompare(b.epic),
  );

  for (const item of breakdown) {
    item.scenarios.sort((a, b) => a.scenario.localeCompare(b.scenario));
  }

  return breakdown;
}

function parseMatrixMarkdown(markdown, { bindingEpicByRef }) {
  const rows = [];
  let currentCapability = null;

  for (const line of markdown.split("\n")) {
    const capMatch = line.match(/^##\s+Capability:\s+`([^`]+)`/);
    if (capMatch) {
      currentCapability = capMatch[1];
      continue;
    }

    if (!line.startsWith("|")) continue;

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((v) => v.trim());

    if (cells.length < 2) continue;
    if (cells[0] === "Scenario" || cells[0] === "---" || cells[0].startsWith("_")) continue;

    const sourceStatus = cells[1];
    if (!["covered", "missing", "pending_impl"].includes(sourceStatus)) continue;

    rows.push({
      scenario: cells[0],
      status: normalizeScenarioStatus(sourceStatus),
      mappedTestRefs: parseMappedTestRefs(cells[2] ?? ""),
      capability: currentCapability,
    });
  }

  const epicBreakdown = buildEpicBreakdown(rows, bindingEpicByRef);

  return {
    total: rows.length,
    covered: rows.filter((r) => r.status === "covered").length,
    missing: rows.filter((r) => r.status === "missing").length,
    capabilities: [...new Set(rows.map((r) => r.capability).filter(Boolean))],
    missingScenarios: rows
      .filter((r) => r.status === "missing")
      .map((r) => ({
        scenario: r.scenario,
        status: r.status,
        capability: r.capability,
      })),
    epicBreakdown,
  };
}

function pct(value, total) {
  if (!total) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function percentValue(num, denom) {
  if (!denom) return null;
  return (num / denom) * 100;
}

function fixedPercent(value) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeLink(url, label) {
  if (!url) return "Unavailable";
  return `[${label}](${url})`;
}

function toUtcDisplay(value) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toISOString().replace("T", " ").replace(".000Z", "Z");
}

function resolveGithubBlobRef(runtimeTrust) {
  const commitUrl = runtimeTrust?.run?.commit_url;
  if (typeof commitUrl === "string") {
    const match = commitUrl.match(/\/commit\/([0-9a-f]{7,40})/i);
    if (match) return match[1];
  }
  const commitSha = runtimeTrust?.run?.commit_sha;
  if (typeof commitSha === "string" && commitSha.trim().length > 0) {
    return commitSha.trim();
  }
  return "main";
}

function toGithubSourceUrl({ filePath, line, blobRef }) {
  const encodedPath = normalizeTestPath(filePath)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${GITHUB_BLOB_ROOT}/${encodeURIComponent(blobRef)}/${encodedPath}#L${line}`;
}

function toAllureTestResultUrl({ reportUrl, testResultId }) {
  const baseUrl = String(reportUrl || DEFAULT_ALLURE_REPORT_URL).replace(/\/+$/, "");
  const [reportBase] = baseUrl.split("#");
  return `${reportBase}#/${encodeURIComponent(testResultId)}`;
}

function shouldUseAllureDeepLinks(reportUrl) {
  const envOverride = process.env.SYSTEM_CARD_ENABLE_REMOTE_ALLURE_DEEP_LINKS;
  if (envOverride === "1") return true;

  try {
    const url = new URL(String(reportUrl || DEFAULT_ALLURE_REPORT_URL));
    const host = (url.hostname || "").toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

function renderMappedTestReference(ref, linkContext) {
  const parsed = parseMappedTestRef(ref);
  if (!parsed) {
    return `<div class="mapped-test-entry"><code>${escapeHtml(ref)}</code></div>`;
  }

  const key = makeAllureLookupKey(parsed.filePath, parsed.title);
  const allureTestResultId = linkContext.useAllureDeepLinks
    ? (linkContext.allureByRef.get(key) ?? null)
    : null;
  const githubUrl = toGithubSourceUrl({
    filePath: parsed.filePath,
    line: parsed.line,
    blobRef: linkContext.githubBlobRef,
  });

  const allureUrl = allureTestResultId
    ? toAllureTestResultUrl({
      reportUrl: linkContext.allureReportUrl,
      testResultId: allureTestResultId,
    })
    : String(linkContext.allureReportUrl || DEFAULT_ALLURE_REPORT_URL);
  const allureLabel = allureTestResultId ? "Test details" : "Allure report";
  const allureClassName = allureTestResultId
    ? "mapped-test-allure-link"
    : "mapped-test-allure-link is-fallback";

  return [
    '<div class="mapped-test-entry">',
    `<span class="mapped-test-title">${escapeHtml(parsed.title)}</span>`,
    '<span class="mapped-test-links">',
    `<a class="mapped-test-source-link" href="${escapeHtml(githubUrl)}" target="_blank" rel="noopener noreferrer">Test code</a>`,
    `<a class="${allureClassName}" href="${escapeHtml(allureUrl)}" target="_blank" rel="noopener noreferrer">${allureLabel}</a>`,
    "</span>",
    "</div>",
  ].join("");
}

async function loadRuntimeTrustData() {
  try {
    const raw = await fs.readFile(RUNTIME_DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      available: true,
      data: parsed,
      path: RUNTIME_DATA_PATH,
    };
  } catch (error) {
    return {
      available: false,
      data: null,
      path: RUNTIME_DATA_PATH,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function chartClassForPercent(value) {
  if (value == null) return "is-na";
  if (value >= 99) return "is-good";
  if (value >= 95) return "is-mid";
  return "is-low";
}

function chartRowHtml({ label, total, covered, missing }) {
  const percent = percentValue(covered, total);
  const width = percent == null ? 100 : Math.max(0, Math.min(100, percent));
  const cssClass = chartClassForPercent(percent);

  return [
    '<div class="chart-row">',
    `<div class="chart-label">${escapeHtml(label)} <span class="chart-detail">${escapeHtml(`${total} scenarios`)}</span></div>`,
    `<div class="chart-track"><span class="chart-fill ${cssClass}" style="width:${width.toFixed(1)}%"></span></div>`,
    `<div class="chart-note">${escapeHtml(missing > 0 ? `${covered} covered · ${missing} missing` : `${covered} covered`)}</div>`,
    "</div>",
  ].join("");
}

function renderEpicDetails(epic, linkContext) {
  const rows = epic.scenarios.map((scenario) => {
    const testRefs = scenario.mappedTestRefs.length > 0
      ? scenario.mappedTestRefs.map((ref) => renderMappedTestReference(ref, linkContext)).join("")
      : "n/a";
    return [
      "<tr>",
      `<td><span class="scenario-status is-${escapeHtml(scenario.status)}">${escapeHtml(scenario.status)}</span></td>`,
      `<td>${escapeHtml(scenario.scenario)}</td>`,
      `<td>${testRefs}</td>`,
      "</tr>",
    ].join("");
  }).join("\n");

  return [
    '<details class="epic-breakdown">',
    `<summary>${escapeHtml(epic.epic)} (${escapeHtml(`${epic.total} scenarios`)}${epic.missing > 0 ? `, ${escapeHtml(`${epic.missing} missing`)}` : ""})</summary>`,
    '<table class="epic-breakdown-table">',
    "<thead><tr><th>Status</th><th>Scenario</th><th>Mapped tests</th></tr></thead>",
    `<tbody>${rows}</tbody>`,
    "</table>",
    "</details>",
  ].join("\n");
}

function metricCardHtml({ label, value, note, warning = false }) {
  return [
    `<div class="trust-metric-card${warning ? " is-warning" : ""}">`,
    `<p class="trust-metric-label">${escapeHtml(label)}</p>`,
    `<p class="trust-metric-value">${escapeHtml(value)}</p>`,
    `<p class="trust-metric-note">${escapeHtml(note)}</p>`,
    "</div>",
  ].join("");
}

function makeSystemCardMarkdown({ traceability, runtimeTrust, linkContext }) {
  const runtime = runtimeTrust.available ? runtimeTrust.data : null;
  const runtimeSource = runtime?.runtime_source ?? "allure-summary";
  const hasRuntimeMetrics = runtime?.metrics_available !== false;
  const latestPassRate = runtime?.stats?.pass_rate_percent;
  const latestTotal = runtime?.stats?.total;
  const latestPassed = runtime?.stats?.passed;
  const latestFailed = runtime?.stats?.failed;
  const runtimeGeneratedAtUtc = runtime?.generated_at_utc;
  const runtimeCreatedAtUtc = runtime?.run?.created_at_utc;
  const runtimeAgeMinutes = runtime?.freshness?.age_minutes;
  const runtimeIsStale = runtime?.freshness?.is_stale;

  const passRateText = Number.isFinite(latestPassRate) ? fixedPercent(latestPassRate) : "Unavailable";
  const latestTotalText = Number.isFinite(latestTotal) ? String(latestTotal) : "Unavailable";
  const latestPassedText = Number.isFinite(latestPassed) ? String(latestPassed) : "Unavailable";
  const latestRunText = hasRuntimeMetrics && Number.isFinite(latestPassed) && Number.isFinite(latestTotal)
    ? `${latestPassed}/${latestTotal}`
    : "Unavailable";
  const failCountText = hasRuntimeMetrics && Number.isFinite(latestFailed)
    ? String(latestFailed)
    : "Unavailable";
  const mappingCoverageText = pct(traceability.covered, traceability.total);
  const dataAgeText = Number.isFinite(runtimeAgeMinutes) ? `${runtimeAgeMinutes} min` : "Unavailable";

  const runtimeSummary = hasRuntimeMetrics && Number.isFinite(latestPassed) && Number.isFinite(latestTotal)
    ? `${latestPassed}/${latestTotal} passing tests`
    : "runtime results are currently unavailable";

  const effectiveLinkContext = linkContext ?? {
    githubBlobRef: resolveGithubBlobRef(runtime),
    allureReportUrl: runtime?.report_url ?? DEFAULT_ALLURE_REPORT_URL,
    useAllureDeepLinks: shouldUseAllureDeepLinks(runtime?.report_url ?? DEFAULT_ALLURE_REPORT_URL),
    allureByRef: new Map(),
  };

  const chartRows = traceability.epicBreakdown.map((item) => chartRowHtml({
    label: item.epic,
    total: item.total,
    covered: item.covered,
    missing: item.missing,
  }));

  if (chartRows.length === 0) {
    chartRows.push(chartRowHtml({
      label: "OpenSpec scenario mapping",
      total: traceability.total,
      covered: traceability.covered,
      missing: traceability.missing,
    }));
  }

  const proofLines = [
    `- Runtime source: ${runtimeSource === "build-metadata" ? "build metadata" : "allure summary"}`,
    runtimeSource === "build-metadata"
      ? `- Build timestamp (UTC): ${toUtcDisplay(runtimeGeneratedAtUtc ?? runtimeCreatedAtUtc)}`
      : `- Last verified run (UTC): ${toUtcDisplay(runtimeCreatedAtUtc)}`,
    `- Commit: ${runtime?.run?.commit_sha ? safeLink(runtime.run.commit_url, runtime.run.commit_sha) : "Unavailable"}`,
    `- CI run: ${safeLink(runtime?.run?.ci_run_url, "workflow run")}`,
    `- Allure report: ${safeLink(runtime?.report_url ?? DEFAULT_ALLURE_REPORT_URL, "tests.openagreements.ai")}`,
    "- Mapped test entries link to GitHub source lines; matching Allure test-result links are shown when available.",
  ];

  if (Number.isFinite(runtimeAgeMinutes)) {
    proofLines.push(`- Data age: ${runtimeAgeMinutes} minute(s)`);
  }

  const lines = [];
  lines.push("---");
  lines.push("layout: trust-layout.njk");
  lines.push("title: System Card | OpenAgreements");
  lines.push(
    "description: Runtime and traceability evidence for OpenAgreements reliability.",
  );
  lines.push("---");
  lines.push("");
  lines.push("# OpenAgreements System Card");
  lines.push("");
  lines.push(`_Last updated (UTC): ${toUtcDisplay(runtimeGeneratedAtUtc ?? runtimeCreatedAtUtc)}_`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push('<div class="trust-summary-banner">');
  lines.push("<h2>Traceability and runtime status</h2>");
  lines.push(
    runtimeSource === "build-metadata"
      ? `<p>${traceability.covered}/${traceability.total} scenarios are mapped to automated tests across ${traceability.capabilities.length} capabilities, and runtime metadata is stamped at deployment build time.</p>`
      : `<p>${traceability.covered}/${traceability.total} scenarios are mapped to automated tests across ${traceability.capabilities.length} capabilities, and the latest published run reports ${runtimeSummary}.</p>`,
  );
  lines.push("</div>");
  lines.push("");

  lines.push('<div class="trust-metric-grid">');
  lines.push(metricCardHtml({
    label: "Scenario mapping",
    value: `${traceability.covered}/${traceability.total}`,
    note: `${mappingCoverageText} of scenarios are linked to automated tests`,
    warning: traceability.missing > 0,
  }));
  lines.push(metricCardHtml({
    label: "Latest test run",
    value: latestRunText,
    note: runtimeSource === "build-metadata"
      ? "Test result counters are omitted in build-metadata mode"
      : Number.isFinite(latestFailed)
      ? `${failCountText} failing test(s) in latest Allure run`
      : "Latest Allure run data unavailable",
    warning: hasRuntimeMetrics && Number.isFinite(latestFailed) ? latestFailed > 0 : false,
  }));
  lines.push(metricCardHtml({
    label: "Data age",
    value: dataAgeText,
    note: runtimeSource === "build-metadata"
      ? "Minutes since deployment build metadata was generated"
      : "Minutes since the latest published Allure report snapshot",
    warning: runtimeIsStale === true,
  }));
  lines.push("</div>");
  lines.push("");

  if (!runtimeTrust.available) {
    lines.push(
      `> Warning: runtime trust data is unavailable (${runtimeTrust.error}).`,
    );
    lines.push(
      `> Expected file: \`${toPosixPath(path.relative(REPO_ROOT, runtimeTrust.path))}\`.`,
    );
    lines.push("");
  } else if (runtimeIsStale) {
    lines.push(
      `> Warning: runtime data is stale (age ${runtimeAgeMinutes} minute(s)).`,
    );
    lines.push("");
  }

  lines.push("## Visual Snapshot");
  lines.push("");
  lines.push("Grouped by **primary mapped test epic**. Expand an epic to inspect each mapped scenario and test links.");
  lines.push("");
  lines.push('<div class="trust-chart">');
  for (const row of chartRows) {
    lines.push(row);
  }
  lines.push("</div>");
  lines.push("");

  for (const epic of traceability.epicBreakdown) {
    lines.push(renderEpicDetails(epic, effectiveLinkContext));
    lines.push("");
  }

  lines.push("## Key Results");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---:|");
  lines.push(`| Spec scenarios | ${traceability.total} |`);
  lines.push(`| Covered scenarios | ${traceability.covered} |`);
  lines.push(`| Missing scenarios | ${traceability.missing} |`);
  lines.push(`| Mapping coverage | ${mappingCoverageText} |`);
  lines.push(`| Test epics measured | ${traceability.epicBreakdown.length} |`);
  lines.push(`| Latest run tests | ${latestTotalText} |`);
  lines.push(`| Latest passing tests | ${latestPassedText} |`);
  lines.push(`| Latest failing tests | ${failCountText} |`);
  lines.push(`| Latest pass rate | ${passRateText} |`);
  lines.push("");

  if (traceability.missingScenarios.length === 0) {
    lines.push("No missing scenarios were found in the currently measured scope.");
    lines.push("");
  } else {
    const previewCount = 10;
    lines.push(`Missing scenarios found: ${traceability.missingScenarios.length}`);
    lines.push("Top items:");
    for (const item of traceability.missingScenarios.slice(0, previewCount)) {
      const cap = item.capability ? ` (${item.capability})` : "";
      lines.push(`- ${item.scenario}${cap} - missing`);
    }
    if (traceability.missingScenarios.length > previewCount) {
      lines.push(
        `- ...and ${traceability.missingScenarios.length - previewCount} more (see traceability matrix).`,
      );
    }
    lines.push("");
  }

  lines.push("## Live Signals");
  lines.push("");
  lines.push("| Signal | Link |");
  lines.push("|---|---|");
  lines.push(
    "| Allure test report | [tests.openagreements.ai](https://tests.openagreements.ai) |",
  );
  lines.push(
    "| Code coverage (Codecov) | [![Coverage](https://img.shields.io/codecov/c/github/open-agreements/open-agreements/main)](https://app.codecov.io/gh/open-agreements/open-agreements) |",
  );
  lines.push(
    "| CI status | [![CI](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml/badge.svg)](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml) |",
  );
  lines.push(
    "| npm downloads | [![npm](https://img.shields.io/npm/dm/open-agreements.svg)](https://www.npmjs.com/package/open-agreements) |",
  );
  lines.push("");

  lines.push("## Verification Metadata");
  lines.push("");
  lines.push("<details>");
  lines.push("<summary>Build and provenance links</summary>");
  lines.push("");
  lines.push(...proofLines);
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("## Limitations");
  lines.push("");
  lines.push("- Scenario mapping coverage indicates linkage between scenarios and tests, not exhaustive code-path coverage.");
  if (runtimeSource === "build-metadata") {
    lines.push("- Runtime pass/fail counters are not fetched in build-metadata mode; the last updated timestamp reflects deployment build time.");
  } else {
    lines.push("- Runtime pass/fail values reflect the latest published Allure run and can change with each CI run.");
  }
  lines.push("- Independent third-party audits are out of scope for this page.");
  lines.push("");

  lines.push("## Appendix: Methods (Technical)");
  lines.push("");
  lines.push("- Scenario mapping numbers are read from the generated OpenSpec traceability matrix.");
  if (runtimeSource === "build-metadata") {
    lines.push("- Runtime metadata is exported from build/deployment environment variables.");
  } else {
    lines.push("- Runtime pass/fail metrics are exported from `allure-report/summary.json`.");
  }
  lines.push("- This page is regenerated by running `npm run trust:rebuild`.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function main() {
  const { outputPath } = parseArgs();

  // Regenerate the traceability matrix before reading it.
  // Use --write-matrix to produce the markdown file without relying on exit code.
  try {
    execFileSync(
      process.execPath,
      [
        path.join(REPO_ROOT, "scripts", "validate_openspec_coverage.mjs"),
        "--write-matrix",
        TRACEABILITY_PATH,
      ],
      { cwd: REPO_ROOT, stdio: "inherit" },
    );
  } catch {
    // The script may exit non-zero if scenarios are missing - that's expected.
    // The matrix file is still written.
    console.log(
      "Note: validate_openspec_coverage exited non-zero (expected if scenarios are missing).",
    );
  }

  let matrixRaw;
  try {
    matrixRaw = await fs.readFile(TRACEABILITY_PATH, "utf-8");
  } catch {
    console.error(
      `Could not read traceability matrix at: ${TRACEABILITY_PATH}`,
    );
    console.error("Ensure validate_openspec_coverage.mjs runs successfully.");
    process.exit(1);
  }

  const bindingEpicByRef = await collectBindingEpicMap();
  const traceability = parseMatrixMarkdown(matrixRaw, { bindingEpicByRef });
  const runtimeTrust = await loadRuntimeTrustData();
  const runtime = runtimeTrust.available ? runtimeTrust.data : null;
  const allureTestResultIndex = await loadAllureTestResultIndex();
  const linkContext = {
    githubBlobRef: resolveGithubBlobRef(runtime),
    allureReportUrl: runtime?.report_url ?? DEFAULT_ALLURE_REPORT_URL,
    useAllureDeepLinks: shouldUseAllureDeepLinks(runtime?.report_url ?? DEFAULT_ALLURE_REPORT_URL),
    allureByRef: allureTestResultIndex.byRef,
  };

  const systemCard = makeSystemCardMarkdown({ traceability, runtimeTrust, linkContext });

  await ensureDir(outputPath);
  await fs.writeFile(outputPath, systemCard, "utf-8");

  const relOutput = path
    .relative(REPO_ROOT, outputPath)
    .split(path.sep)
    .join("/");
  console.log(`Generated system card: ${relOutput}`);
}

await main();

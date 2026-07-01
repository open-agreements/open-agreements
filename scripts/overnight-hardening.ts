#!/usr/bin/env npx tsx
/**
 * Autonomous NVCA FieldSelector Hardening Loop
 *
 * Processes each non-production fieldSelector sequentially, invoking Codex CLI in a
 * loop to iteratively improve fieldSelector quality until the scorecard hits 15/15
 * or 20 loops are exhausted.
 *
 * Usage:
 *   npx tsx scripts/overnight-hardening.ts [options]
 *
 * Options:
 *   --fieldSelector <id>       Run only one fieldSelector (default: all non-production)
 *   --max-loops <n>     Max iterations per fieldSelector (default: 20)
 *   --dry-run           Grade only, don't invoke Codex
 *   --output-dir <dir>  Report output dir (default: .nvca-hardening-output/)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync, execFileSync, spawnSync } from 'node:child_process';
import { gradeFieldSelector } from './lib/field-selector-grader.js';
import { buildCodexPrompt, loadCoiFixture } from './lib/codex-prompt.js';
import { loadFieldSelectorMetadata, loadCleanConfig } from '../src/core/metadata.js';
import { resolveFieldSelectorDir } from '../src/utils/paths.js';
import { ensureSourceDocx, extractAllText, cleanDocument } from '../src/core/field-selector/index.js';
import type { FieldSelectorScorecard } from './lib/field-selector-grader.js';
import {
  appendExperiment,
  getRecentHistory,
  getAllHistory,
  readIntentFile,
  readResultFile,
  cleanHandshakeFiles,
  computeFieldSelectorTreeHash,
  GRADER_VERSION,
} from './lib/experiment-journal.js';
import type { ExperimentEntry } from './lib/experiment-journal.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(import.meta.dirname!, '..');
const DEFAULT_OUTPUT_DIR = join(PROJECT_ROOT, '.nvca-hardening-output');
// NVCA field-selectors live under templates/<source>-<rights>/<slug>/ after the
// S3 restructure (#1249); their source/rights segment has no CC license.
const NVCA_SEGMENT = 'nvca-free-non-redistributable';
const NVCA_DIR_REL = `templates/${NVCA_SEGMENT}`;
const QUALITY_TRACKER_PATH = join(PROJECT_ROOT, 'templates', NVCA_SEGMENT, 'QUALITY_TRACKER.md');
const FIXTURES_DIR = join(PROJECT_ROOT, 'integration-tests', 'fixtures');

/** Escape regex metacharacters so a value can be safely interpolated into a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Set by main() before any fieldSelector processing
let outputDirGlobal = DEFAULT_OUTPUT_DIR;

// FieldSelector processing order: legal impact priority, skip SPA (production)
const FIELD_SELECTOR_ORDER = [
  'nvca-certificate-of-incorporation',
  'nvca-investors-rights-agreement',
  'nvca-voting-agreement',
  'nvca-rofr-co-sale-agreement',
  'nvca-indemnification-agreement',
  'nvca-management-rights-letter',
];

const JOURNAL_DIR = join(PROJECT_ROOT, '.hardening-journal');
const STALL_LIMIT = 7;  // was 3; safe because memory prevents exact repeats
const EPS_KEEP = 1e-6;  // near-zero so even 1-bracket progress is visible
const STALL_RESET_CUMULATIVE = 0.03;

// ---------------------------------------------------------------------------
// Edit Policy
// ---------------------------------------------------------------------------

function getAllowedGlobs(): string[] {
  return [
    'templates/nvca-free-non-redistributable/nvca-*/metadata.yaml',
    'templates/nvca-free-non-redistributable/nvca-*/replacements.json',
    'templates/nvca-free-non-redistributable/nvca-*/clean.json',
    'templates/nvca-free-non-redistributable/nvca-*/computed.json',
    'templates/nvca-free-non-redistributable/nvca-*/selections.json',
    'integration-tests/fixtures/*.json',
    '.hardening-journal/*.intent.json',
    '.hardening-journal/*.result.json',
  ];
}

const BLOCKED_PATHS = [
  'scripts/',
  'src/',
  'packages/',
  'bin/',
  'site/',
  '.github/',
  'node_modules/',
];

const BLOCKED_EXTENSIONS = [
  '.docx',
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.yml',
  '.yaml',  // only allowed under templates/nvca-free-non-redistributable/nvca-*/
];

function isPathBlocked(filePath: string): boolean {
  for (const blocked of BLOCKED_PATHS) {
    if (filePath.startsWith(blocked)) return true;
  }
  // Block .yaml files unless they're fieldSelector metadata
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    if (filePath.match(/^templates\/nvca-free-non-redistributable\/nvca-[^/]+\/metadata\.yaml$/)) return false;
    return true;
  }
  for (const ext of BLOCKED_EXTENSIONS) {
    if (ext === '.yaml' || ext === '.yml') continue; // handled above
    if (filePath.endsWith(ext)) return true;
  }
  return false;
}

function isPathAllowed(filePath: string): boolean {
  // Explicit allow-list patterns
  if (filePath.match(/^templates\/nvca-free-non-redistributable\/nvca-[^/]+\/(metadata\.yaml|replacements\.json|clean\.json|computed\.json|selections\.json)$/)) {
    return true;
  }
  if (filePath.match(/^integration-tests\/fixtures\/.*\.json$/)) {
    return true;
  }
  if (filePath.match(/^\.hardening-journal\/.*\.(intent|result)\.json$/)) {
    return true;
  }
  return false;
}

function enforceEditPolicy(): string[] {
  const violations: string[] = [];
  try {
    const unstaged = execSync('git diff --name-only HEAD', { cwd: PROJECT_ROOT }).toString().trim();
    const staged = execSync('git diff --cached --name-only', { cwd: PROJECT_ROOT }).toString().trim();
    const allChanged = [...new Set([
      ...(unstaged ? unstaged.split('\n') : []),
      ...(staged ? staged.split('\n') : []),
    ])];

    for (const file of allChanged) {
      if (!file) continue;
      if (isPathBlocked(file) || !isPathAllowed(file)) {
        violations.push(file);
        // Revert the blocked file
        try {
          execSync(
            `git restore --source=HEAD --worktree --staged -- ${JSON.stringify(file)}`,
            { cwd: PROJECT_ROOT },
          );
          console.log(`  POLICY: reverted blocked file: ${file}`);
        } catch {
          // File may be new (untracked), remove it
          try {
            execSync(`git checkout HEAD -- ${JSON.stringify(file)}`, { cwd: PROJECT_ROOT });
          } catch {
            // Truly new file — just note the violation
          }
        }
      }
    }
  } catch {
    // git commands failed; policy unenforced this iteration
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldSelectorReport {
  fieldSelectorId: string;
  startScore: number;
  endScore: number;
  bestScore: number;
  startContinuous: number;
  bestContinuous: number;
  loops: number;
  exitReason: 'perfect' | 'max_loops' | 'stalled' | 'error';
  newFixtures: number;
  scorecards: FieldSelectorScorecard[];
  bestScorecard?: FieldSelectorScorecard;  // last kept scorecard (not reverted)
  errors: string[];
  policyViolations: string[];
}

interface CLIOptions {
  fieldSelector?: string;
  maxLoops: number;
  dryRun: boolean;
  outputDir: string;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const opts: CLIOptions = {
    maxLoops: 20,
    dryRun: false,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--fieldSelector':
        opts.fieldSelector = args[++i];
        break;
      case '--max-loops':
        opts.maxLoops = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--output-dir':
        opts.outputDir = resolve(args[++i]);
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Map fieldSelector IDs to fixture file prefixes (abbreviations used in existing fixtures)
const FIELD_SELECTOR_FIXTURE_PREFIXES: Record<string, string[]> = {
  'nvca-stock-purchase-agreement': ['spa-', 'stock-purchase-agreement-'],
  'nvca-certificate-of-incorporation': ['coi-', 'certificate-of-incorporation-'],
  'nvca-investors-rights-agreement': ['ira-', 'investors-rights-agreement-'],
  'nvca-voting-agreement': ['va-', 'voting-agreement-'],
  'nvca-rofr-co-sale-agreement': ['rofr-', 'rofr-co-sale-agreement-'],
  'nvca-indemnification-agreement': ['indemnification-', 'indemnification-agreement-'],
  'nvca-management-rights-letter': ['mrl-', 'management-rights-letter-'],
};

function fixturesForFieldSelector(fieldSelectorId: string): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  const shortId = fieldSelectorId.replace(/^nvca-/, '');
  const prefixes = FIELD_SELECTOR_FIXTURE_PREFIXES[fieldSelectorId] ?? [shortId + '-'];
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json') && prefixes.some((p) => f.startsWith(p)))
    .map((f) => join(FIXTURES_DIR, f));
}

function countFixtures(fieldSelectorId: string): number {
  return fixturesForFieldSelector(fieldSelectorId).length;
}

function loadBestFixture(fieldSelectorId: string): Record<string, string> {
  const fixtures = fixturesForFieldSelector(fieldSelectorId);
  // Prefer series-c > full > partial > defaults
  const priority = ['series-c', 'full', 'partial', 'defaults'];
  for (const suffix of priority) {
    const match = fixtures.find((f) => f.includes(suffix));
    if (match) return JSON.parse(readFileSync(match, 'utf-8'));
  }
  // Fall back to first available
  if (fixtures.length > 0) return JSON.parse(readFileSync(fixtures[0], 'utf-8'));
  return {};
}

async function getSourceTextExcerpt(fieldSelectorId: string): Promise<string> {
  try {
    const fieldSelectorDir = resolveFieldSelectorDir(fieldSelectorId);
    const meta = loadFieldSelectorMetadata(fieldSelectorDir);
    const cleanConfig = loadCleanConfig(fieldSelectorDir);
    const sourcePath = await ensureSourceDocx(fieldSelectorId, meta);

    // Clean then extract text
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const tempDir = mkdtempSync(join(tmpdir(), `excerpt-${fieldSelectorId}-`));
    try {
      const cleanedPath = join(tempDir, 'cleaned.docx');
      await cleanDocument(sourcePath, cleanedPath, cleanConfig);
      return extractAllText(cleanedPath);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  } catch {
    return '';
  }
}

function getMetadataFieldNames(fieldSelectorId: string): string[] {
  try {
    const fieldSelectorDir = resolveFieldSelectorDir(fieldSelectorId);
    const meta = loadFieldSelectorMetadata(fieldSelectorDir);
    return meta.fields.map((f) => f.name);
  } catch {
    return [];
  }
}

function runTests(): { passed: boolean; output: string } {
  try {
    const result = spawnSync('npx', ['vitest', 'run', 'integration-tests/', '--reporter=verbose'], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5 * 60 * 1000,
      env: { ...process.env },
    });
    const output = (result.stdout?.toString() ?? '') + (result.stderr?.toString() ?? '');
    return { passed: result.status === 0, output };
  } catch (err) {
    return { passed: false, output: `Test runner error: ${(err as Error).message}` };
  }
}

function invokeCodex(prompt: string): { success: boolean; output: string } {
  console.log('  Invoking Codex CLI...');
  // Save a copy of the prompt for debugging
  writeFileSync(join(outputDirGlobal, 'codex-prompt.md'), prompt);

  try {
    // Pass the prompt as a direct argument (no shell) so neither the prompt
    // text nor PROJECT_ROOT is interpreted by a shell.
    const result = execFileSync(
      'codex',
      ['exec', '--full-auto', '-C', PROJECT_ROOT, prompt],
      {
        cwd: PROJECT_ROOT,
        timeout: 10 * 60 * 1000,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    const output = result.toString();
    return { success: true, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer; message?: string };
    const stdout = e.stdout?.toString() ?? '';
    const stderr = e.stderr?.toString() ?? '';
    console.log(`  Codex exit code: ${e.status ?? 'unknown'}`);
    if (stderr) console.log(`  Codex stderr (last 500): ${stderr.slice(-500)}`);
    return { success: false, output: stdout + stderr };
  }
}

function gitCheckpoint(fieldSelectorId: string, iteration: number, score: number, continuousTotal?: number): string {
  const prefixes = FIELD_SELECTOR_FIXTURE_PREFIXES[fieldSelectorId] ?? [fieldSelectorId.replace(/^nvca-/, '') + '-'];
  const fixtureGlobs = prefixes.map((p) => `integration-tests/fixtures/${p}*`).join(' ');
  const continuousStr = continuousTotal !== undefined ? `, continuous ${continuousTotal.toFixed(3)}` : '';
  try {
    // Stage fieldSelector files and fixtures
    execSync(
      `git add ${NVCA_DIR_REL}/${fieldSelectorId}/ ${fixtureGlobs} 2>/dev/null || true`,
      { cwd: PROJECT_ROOT },
    );

    // Check if there are staged changes
    const status = execSync('git diff --cached --stat', { cwd: PROJECT_ROOT }).toString().trim();
    if (!status) {
      return execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT }).toString().trim();
    }

    execSync(
      `git -c commit.gpgsign=false commit -m "$(cat <<'EOF'\nhardening(${fieldSelectorId}): loop ${iteration}, score ${score}/15${continuousStr}\nEOF\n)"`,
      { cwd: PROJECT_ROOT },
    );
    return execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT }).toString().trim();
  } catch {
    return execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT }).toString().trim();
  }
}

function revertToCommit(commitSha: string, fieldSelectorId: string): void {
  const prefixes = FIELD_SELECTOR_FIXTURE_PREFIXES[fieldSelectorId] ?? [fieldSelectorId.replace(/^nvca-/, '') + '-'];
  const fixtureGlobs = prefixes.map((p) => `integration-tests/fixtures/${p}*`).join(' ');
  try {
    execSync(
      `git checkout ${commitSha} -- ${NVCA_DIR_REL}/${fieldSelectorId}/ ${fixtureGlobs} 2>/dev/null || true`,
      { cwd: PROJECT_ROOT },
    );
  } catch {
    // If checkout fails (e.g., files didn't exist at that commit), that's OK
  }
}

// ---------------------------------------------------------------------------
// Convergence Data
// ---------------------------------------------------------------------------

interface ConvergencePoint {
  fieldSelector: string;
  loop: number;
  timestamp: string;
  integer_total: number;
  continuous_total: number;
  max_applicable: number;
  outcome: 'kept' | 'reverted' | 'invalid' | 'policy_violation' | 'baseline';
  S1: number; S2: number; S3: number; S4: number; S5: number; S6: number; S7: number;
  B1: number; B2: number; B3: number; B4: number;
  F1: number; F2: number; F3: number; F4: number;
}

function convergenceTsvPath(): string {
  return join(outputDirGlobal, 'convergence.tsv');
}

function appendConvergencePoint(point: ConvergencePoint): void {
  const tsvPath = convergenceTsvPath();
  const header = 'fieldSelector\tloop\ttimestamp\tinteger_total\tcontinuous_total\tmax_applicable\toutcome\tS1\tS2\tS3\tS4\tS5\tS6\tS7\tB1\tB2\tB3\tB4\tF1\tF2\tF3\tF4\n';

  if (!existsSync(tsvPath)) {
    writeFileSync(tsvPath, header);
  }

  const row = [
    point.fieldSelector,
    point.loop,
    point.timestamp,
    point.integer_total,
    point.continuous_total.toFixed(4),
    point.max_applicable,
    point.outcome,
    point.S1, point.S2, point.S3, point.S4, point.S5, point.S6, point.S7,
    point.B1, point.B2, point.B3, point.B4,
    point.F1, point.F2, point.F3, point.F4,
  ].join('\t');

  appendFileSync(tsvPath, row + '\n');
}

function scorecardToPerCheck(scorecard: FieldSelectorScorecard): Record<string, number> {
  const result: Record<string, number> = {};
  for (const check of scorecard.checks) {
    result[check.id] = check.score ?? (check.passed ? 1.0 : 0.0);
  }
  return result;
}

function consolidateConvergenceData(): void {
  const tsvPath = convergenceTsvPath();
  if (!existsSync(tsvPath)) return;
  // Copy to a timestamped archive
  const archivePath = join(outputDirGlobal, `convergence-${new Date().toISOString().replace(/[:.]/g, '-')}.tsv`);
  writeFileSync(archivePath, readFileSync(tsvPath, 'utf-8'));
  console.log(`  Convergence data archived to: ${archivePath}`);
}

// ---------------------------------------------------------------------------
// Pareto Protection
// ---------------------------------------------------------------------------

function buildCheckHighWater(scorecards: FieldSelectorScorecard[]): Map<string, number> {
  const highWater = new Map<string, number>();
  for (const sc of scorecards) {
    for (const check of sc.checks) {
      const score = check.score ?? (check.passed ? 1.0 : 0.0);
      const current = highWater.get(check.id) ?? 0;
      if (score > current) {
        highWater.set(check.id, score);
      }
    }
  }
  return highWater;
}

function findRegressedChecks(
  highWater: Map<string, number>,
  current: FieldSelectorScorecard,
): string[] {
  const regressed: string[] = [];
  for (const check of current.checks) {
    const score = check.score ?? (check.passed ? 1.0 : 0.0);
    const hw = highWater.get(check.id) ?? 0;
    if (score < hw - EPS_KEEP) {
      regressed.push(check.id);
    }
  }
  return regressed;
}

// ---------------------------------------------------------------------------
// Semantic Revisitation
// ---------------------------------------------------------------------------

function getModifiedReplacementKeys(fieldSelectorId: string): string[] {
  try {
    const diff = execSync(
      `git diff HEAD -- ${NVCA_DIR_REL}/${fieldSelectorId}/replacements.json`,
      { cwd: PROJECT_ROOT },
    ).toString();
    // Extract keys from added/removed lines
    const keys: string[] = [];
    for (const line of diff.split('\n')) {
      if (line.startsWith('+') || line.startsWith('-')) {
        // Match JSON object keys (lines like: "  \"some key\": ...")
        const match = line.match(/^\s*[+-]\s*"([^"]+)"\s*:/);
        if (match) keys.push(match[1]);
      }
    }
    return [...new Set(keys)];
  } catch {
    return [];
  }
}

function detectSemanticRevisitation(
  fieldSelectorId: string,
  modifiedKeys: string[],
): { revisited: boolean; message: string } {
  if (modifiedKeys.length === 0) {
    return { revisited: false, message: '' };
  }

  const history = getAllHistory(fieldSelectorId);
  if (history.length === 0) {
    return { revisited: false, message: '' };
  }

  // Check if any of the modified keys were previously reverted
  const revertedEntries = history.filter((e) => e.outcome === 'reverted' || e.outcome === 'invalid');
  const revisitedKeys: string[] = [];

  for (const key of modifiedKeys) {
    for (const entry of revertedEntries) {
      if (entry.diffSummary.includes(key)) {
        revisitedKeys.push(key);
        break;
      }
    }
  }

  if (revisitedKeys.length > 0) {
    return {
      revisited: true,
      message: `Revisited ${revisitedKeys.length} previously-reverted keys: ${revisitedKeys.slice(0, 5).join(', ')}`,
    };
  }
  return { revisited: false, message: '' };
}

// ---------------------------------------------------------------------------
// Core hardening loop
// ---------------------------------------------------------------------------

async function hardenFieldSelector(
  fieldSelectorId: string,
  maxLoops: number,
  dryRun: boolean,
  outputDir: string,
): Promise<FieldSelectorReport> {
  const fieldSelectorOutputDir = join(outputDir, fieldSelectorId);
  mkdirSync(fieldSelectorOutputDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`FieldSelector: ${fieldSelectorId}`);
  console.log('='.repeat(60));

  const initialFixtureCount = countFixtures(fieldSelectorId);
  const scorecards: FieldSelectorScorecard[] = [];
  const errors: string[] = [];
  const policyViolations: string[] = [];

  // Count existing journal entries for attempt numbering
  const existingEntries = getAllHistory(fieldSelectorId);
  let attemptOffset = existingEntries.length;

  // Safe grading wrapper — returns null on error instead of crashing
  async function safeGrade(label: string): Promise<FieldSelectorScorecard | null> {
    try {
      const vals = loadBestFixture(fieldSelectorId);
      return await gradeFieldSelector(fieldSelectorId, vals, fieldSelectorOutputDir);
    } catch (err) {
      const msg = `Grade failed (${label}): ${(err as Error).message?.slice(0, 200)}`;
      console.log(`  ${msg}`);
      errors.push(msg);
      return null;
    }
  }

  // Initial grade
  console.log('  Grading (baseline)...');
  let scorecard = await safeGrade('baseline');
  if (!scorecard) {
    console.log('  Baseline grading failed — Codex will attempt blind fixes');
    // Create a minimal scorecard so the loop can still run
    scorecard = {
      field_selector_id: fieldSelectorId, timestamp: new Date().toISOString(),
      maturity: 'scaffold', scores: { structural: '?/7', behavioral: '?/4', fill: '?/4', total: '0/15' },
      total_numeric: 0, max_score: 15, checks: [],
      continuous_total: 0, max_applicable: 15,
      field_coverage: { metadata_fields: 0, replacement_refs: 0, uncovered: [] },
      zero_match_keys: [], verify_result: null,
      recommendations: ['Baseline grading failed — fix metadata validation errors first'],
    };
  }
  scorecards.push(scorecard);

  console.log(`  Baseline: ${scorecard.scores.total} (${scorecard.maturity})`);
  for (const check of scorecard.checks) {
    console.log(`    ${check.passed ? '✓' : '✗'} ${check.id} ${check.name}`);
  }

  const startContinuous = scorecard.continuous_total;

  // Unified accepted state — tracks the last KEPT scorecard + commit.
  // Only kept/same-score iterations update this; reverted iterations do not.
  let accepted = {
    scorecard,
    commitSha: execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT }).toString().trim(),
    continuous: scorecard.continuous_total,
    score: scorecard.total_numeric,
  };
  // keptScorecards excludes reverted attempts so Pareto high-water is accurate.
  const keptScorecards: FieldSelectorScorecard[] = [scorecard];
  let bestContinuous = startContinuous;

  // Log baseline convergence point
  const baselinePerCheck = scorecardToPerCheck(scorecard);
  appendConvergencePoint({
    fieldSelector: fieldSelectorId,
    loop: 0,
    timestamp: new Date().toISOString(),
    integer_total: scorecard.total_numeric,
    continuous_total: scorecard.continuous_total,
    max_applicable: scorecard.max_applicable,
    outcome: 'baseline',
    S1: baselinePerCheck['S1'] ?? 0, S2: baselinePerCheck['S2'] ?? 0,
    S3: baselinePerCheck['S3'] ?? 0, S4: baselinePerCheck['S4'] ?? 0,
    S5: baselinePerCheck['S5'] ?? 0, S6: baselinePerCheck['S6'] ?? 0,
    S7: baselinePerCheck['S7'] ?? 0,
    B1: baselinePerCheck['B1'] ?? 0, B2: baselinePerCheck['B2'] ?? 0,
    B3: baselinePerCheck['B3'] ?? 0, B4: baselinePerCheck['B4'] ?? 0,
    F1: baselinePerCheck['F1'] ?? 0, F2: baselinePerCheck['F2'] ?? 0,
    F3: baselinePerCheck['F3'] ?? 0, F4: baselinePerCheck['F4'] ?? 0,
  });

  if (scorecard.continuous_total >= scorecard.max_applicable - EPS_KEEP) {
    console.log('  Already perfect!');
    return {
      fieldSelectorId,
      startScore: scorecard.total_numeric,
      endScore: scorecard.total_numeric,
      bestScore: scorecard.total_numeric,
      startContinuous,
      bestContinuous,
      loops: 0,
      exitReason: 'perfect',
      newFixtures: 0,
      scorecards,
      bestScorecard: scorecard,
      errors,
      policyViolations,
    };
  }

  if (dryRun) {
    // Write scorecard JSON for dry-run review
    writeFileSync(
      join(fieldSelectorOutputDir, 'scorecard.json'),
      JSON.stringify(scorecard, null, 2),
    );
    return {
      fieldSelectorId,
      startScore: scorecard.total_numeric,
      endScore: scorecard.total_numeric,
      bestScore: scorecard.total_numeric,
      startContinuous,
      bestContinuous,
      loops: 0,
      exitReason: 'stalled',
      newFixtures: 0,
      scorecards,
      bestScorecard: scorecard,
      errors,
      policyViolations,
    };
  }

  // Ensure we're on the hardening branch
  try {
    const currentBranch = execSync('git branch --show-current', { cwd: PROJECT_ROOT }).toString().trim();
    const today = new Date().toISOString().slice(0, 10);
    const branchName = `hardening/overnight-${today}`;
    if (currentBranch !== branchName) {
      try {
        execSync(`git checkout -b ${branchName}`, { cwd: PROJECT_ROOT });
      } catch {
        // Branch may already exist, try switching to it
        try {
          execSync(`git checkout ${branchName}`, { cwd: PROJECT_ROOT });
        } catch {
          // Stay on current branch
        }
      }
    }
  } catch {
    // Git operations optional
  }

  let bestScore = scorecard.total_numeric;
  // bestCommitSha is now derived from accepted.commitSha — kept for backward compat
  let bestCommitSha = accepted.commitSha;
  let noImprovementCount = 0;
  let cumulativeGain = 0;
  const startScore = scorecard.total_numeric;
  const coiFixture = loadCoiFixture();

  for (let i = 1; i <= maxLoops; i++) {
    console.log(`\n  --- Loop ${i}/${maxLoops} ---`);

    // Clean handshake files before each iteration
    cleanHandshakeFiles(fieldSelectorId);

    // Get experiment history for prompt
    const experimentHistory = getRecentHistory(fieldSelectorId, 10);

    // Build prompt
    const existingFixtures = fixturesForFieldSelector(fieldSelectorId).map((f) => f.split('/').pop()!);
    const metadataFieldNames = getMetadataFieldNames(fieldSelectorId);
    const sourceExcerpt = await getSourceTextExcerpt(fieldSelectorId);

    const prompt = buildCodexPrompt({
      fieldSelectorId,
      scorecard,
      loopIteration: i,
      sourceTextExcerpt: sourceExcerpt,
      existingFixtures,
      metadataFieldNames,
      coiFixtureAsExample: coiFixture,
      experimentHistory,
      maxLoops,
    });

    // Invoke Codex
    const codexResult = invokeCodex(prompt);
    console.log(`  Codex ${codexResult.success ? 'succeeded' : 'failed'}`);

    // Read handshake files
    const intentData = readIntentFile(fieldSelectorId);
    const resultData = readResultFile(fieldSelectorId);
    if (intentData) {
      console.log(`  Intent: ${intentData.hypothesis.slice(0, 120)}`);
    }
    if (resultData) {
      console.log(`  Result: ${resultData.lesson.slice(0, 120)}`);
    }

    // Enforce edit policy BEFORE grading
    const iterationViolations = enforceEditPolicy();
    if (iterationViolations.length > 0) {
      console.log(`  POLICY: ${iterationViolations.length} blocked file(s) reverted`);
      policyViolations.push(...iterationViolations);
    }

    // Detect semantic revisitation
    const modifiedKeys = getModifiedReplacementKeys(fieldSelectorId);
    const revisitation = detectSemanticRevisitation(fieldSelectorId, modifiedKeys);
    if (revisitation.revisited) {
      console.log(`  WARNING: ${revisitation.message}`);
    }

    // Run tests
    console.log('  Running tests...');
    const testResult = runTests();
    console.log(`  Tests ${testResult.passed ? 'passed' : 'failed'}`);

    // Re-grade (safely — Codex may have broken metadata)
    console.log('  Re-grading...');
    const regrade = await safeGrade(`loop ${i}`);

    // Build experiment entry
    const attemptNum = attemptOffset + i;
    const baseCommit = bestCommitSha.slice(0, 12);
    let fieldSelectorDir: string;
    try {
      fieldSelectorDir = resolveFieldSelectorDir(fieldSelectorId);
    } catch {
      fieldSelectorDir = join(PROJECT_ROOT, 'templates', NVCA_SEGMENT, fieldSelectorId);
    }
    const treeHash = existsSync(fieldSelectorDir) ? computeFieldSelectorTreeHash(fieldSelectorDir) : 'unknown';

    if (!regrade) {
      console.log('  Re-grade failed — Codex likely broke metadata, reverting');
      revertToCommit(accepted.commitSha, fieldSelectorId);
      scorecard = accepted.scorecard; // reset in-memory scorecard to last kept
      noImprovementCount++;

      // Log invalid experiment
      const entry: ExperimentEntry = {
        attempt: attemptNum,
        timestamp: new Date().toISOString(),
        hypothesis: intentData?.hypothesis ?? 'unknown (grade failed)',
        diffSummary: resultData?.lesson ?? 'grade failed after edit',
        scoreBefore: scorecard.continuous_total,
        scoreAfter: 0,
        delta: -scorecard.continuous_total,
        outcome: 'invalid',
        checksRegressed: [],
        checksImproved: [],
        lesson: resultData?.lesson ?? 'Grade failed — likely metadata validation error',
        base_commit: baseCommit,
        fieldSelector_tree_hash: treeHash,
        grader_version: GRADER_VERSION,
      };
      appendExperiment(fieldSelectorId, entry);

      // Log convergence point
      const perCheck = scorecardToPerCheck(scorecard);
      appendConvergencePoint({
        fieldSelector: fieldSelectorId,
        loop: i,
        timestamp: new Date().toISOString(),
        integer_total: scorecard.total_numeric,
        continuous_total: scorecard.continuous_total,
        max_applicable: scorecard.max_applicable,
        outcome: 'invalid',
        S1: perCheck['S1'] ?? 0, S2: perCheck['S2'] ?? 0,
        S3: perCheck['S3'] ?? 0, S4: perCheck['S4'] ?? 0,
        S5: perCheck['S5'] ?? 0, S6: perCheck['S6'] ?? 0,
        S7: perCheck['S7'] ?? 0,
        B1: perCheck['B1'] ?? 0, B2: perCheck['B2'] ?? 0,
        B3: perCheck['B3'] ?? 0, B4: perCheck['B4'] ?? 0,
        F1: perCheck['F1'] ?? 0, F2: perCheck['F2'] ?? 0,
        F3: perCheck['F3'] ?? 0, F4: perCheck['F4'] ?? 0,
      });

      if (noImprovementCount >= STALL_LIMIT) {
        console.log(`  Stalled — ${STALL_LIMIT} consecutive iterations with no improvement`);
        break;
      }
      continue;
    }
    scorecard = regrade;
    scorecards.push(scorecard);
    const newScore = scorecard.total_numeric;
    const newContinuous = scorecard.continuous_total;
    console.log(`  Score: ${scorecard.scores.total} (continuous: ${newContinuous.toFixed(3)})`);

    for (const check of scorecard.checks) {
      if (!check.passed) {
        console.log(`    ✗ ${check.id} ${check.name} — ${check.details ?? ''}`);
      }
    }

    // Check Pareto protection — only kept scorecards inform the high-water mark
    const highWater = buildCheckHighWater(keptScorecards.slice(0, -1));
    const regressed = findRegressedChecks(highWater, scorecard);
    if (regressed.length > 0) {
      console.log(`  Pareto regression on: ${regressed.join(', ')}`);
    }

    // Track previous best for stall logic
    const prevBestContinuous = bestContinuous;

    // Evaluate progress using continuous score with Pareto protection
    let outcome: 'kept' | 'reverted' = 'kept';

    if (newContinuous >= scorecard.max_applicable - EPS_KEEP) {
      // Perfect continuous score
      console.log('  Perfect score achieved!');
      bestScore = newScore;
      bestContinuous = newContinuous;
      bestCommitSha = gitCheckpoint(fieldSelectorId, i, newScore, newContinuous);
      keptScorecards.push(scorecard);
      accepted = { scorecard, commitSha: bestCommitSha, continuous: newContinuous, score: newScore };

      // Log experiment
      const checksImproved = scorecard.checks
        .filter((c) => (c.score ?? (c.passed ? 1.0 : 0.0)) > (highWater.get(c.id) ?? 0) + EPS_KEEP)
        .map((c) => c.id);
      const entry: ExperimentEntry = {
        attempt: attemptNum,
        timestamp: new Date().toISOString(),
        hypothesis: intentData?.hypothesis ?? 'unknown',
        diffSummary: resultData?.lesson ?? `score ${newContinuous.toFixed(3)}`,
        scoreBefore: prevBestContinuous,
        scoreAfter: newContinuous,
        delta: newContinuous - prevBestContinuous,
        outcome: 'kept',
        checksRegressed: [],
        checksImproved,
        lesson: resultData?.lesson ?? 'Perfect score achieved',
        base_commit: baseCommit,
        fieldSelector_tree_hash: treeHash,
        grader_version: GRADER_VERSION,
      };
      appendExperiment(fieldSelectorId, entry);

      // Log convergence point
      const perCheck = scorecardToPerCheck(scorecard);
      appendConvergencePoint({
        fieldSelector: fieldSelectorId,
        loop: i,
        timestamp: new Date().toISOString(),
        integer_total: newScore,
        continuous_total: newContinuous,
        max_applicable: scorecard.max_applicable,
        outcome: 'kept',
        S1: perCheck['S1'] ?? 0, S2: perCheck['S2'] ?? 0,
        S3: perCheck['S3'] ?? 0, S4: perCheck['S4'] ?? 0,
        S5: perCheck['S5'] ?? 0, S6: perCheck['S6'] ?? 0,
        S7: perCheck['S7'] ?? 0,
        B1: perCheck['B1'] ?? 0, B2: perCheck['B2'] ?? 0,
        B3: perCheck['B3'] ?? 0, B4: perCheck['B4'] ?? 0,
        F1: perCheck['F1'] ?? 0, F2: perCheck['F2'] ?? 0,
        F3: perCheck['F3'] ?? 0, F4: perCheck['F4'] ?? 0,
      });

      return {
        fieldSelectorId,
        startScore,
        endScore: newScore,
        bestScore: newScore,
        startContinuous,
        bestContinuous: newContinuous,
        loops: i,
        exitReason: 'perfect',
        newFixtures: countFixtures(fieldSelectorId) - initialFixtureCount,
        scorecards,
        bestScorecard: accepted.scorecard,
        errors,
        policyViolations,
      };
    }

    if (newContinuous > bestContinuous + EPS_KEEP && regressed.length === 0) {
      // Improvement with no Pareto regression
      const gain = newContinuous - bestContinuous;
      cumulativeGain += gain;
      bestScore = Math.max(bestScore, newScore);
      bestContinuous = newContinuous;
      bestCommitSha = gitCheckpoint(fieldSelectorId, i, newScore, newContinuous);
      keptScorecards.push(scorecard);
      accepted = { scorecard, commitSha: bestCommitSha, continuous: newContinuous, score: newScore };
      outcome = 'kept';
      console.log(`  New best: ${newContinuous.toFixed(3)}/${scorecard.max_applicable} (committed ${bestCommitSha.slice(0, 8)})`);

      // Stall reset: threshold crossing OR cumulative gain
      if (gain >= STALL_RESET_CUMULATIVE || cumulativeGain >= STALL_RESET_CUMULATIVE) {
        noImprovementCount = 0;
        cumulativeGain = 0;
      } else {
        noImprovementCount++;
      }
    } else if (newContinuous < bestContinuous - EPS_KEEP || regressed.length > 0) {
      // Regression or Pareto violation — revert to accepted state
      const reason = regressed.length > 0
        ? `Pareto regression on ${regressed.join(', ')}`
        : `continuous ${newContinuous.toFixed(3)} < best ${bestContinuous.toFixed(3)}`;
      console.log(`  Reverting: ${reason}`);
      revertToCommit(accepted.commitSha, fieldSelectorId);
      scorecard = accepted.scorecard; // reset in-memory scorecard to last kept
      outcome = 'reverted';
      noImprovementCount++;
    } else {
      // Same score — still commit if there are improvements in details
      const sha = gitCheckpoint(fieldSelectorId, i, newScore, newContinuous);
      keptScorecards.push(scorecard);
      accepted = { scorecard, commitSha: sha, continuous: newContinuous, score: newScore };
      outcome = 'kept';
      noImprovementCount++;
      console.log(`  No improvement (${noImprovementCount}/${STALL_LIMIT} before stall)`);
    }

    // Compute improved/regressed check lists for journal
    const checksImproved = scorecard.checks
      .filter((c) => (c.score ?? (c.passed ? 1.0 : 0.0)) > (highWater.get(c.id) ?? 0) + EPS_KEEP)
      .map((c) => c.id);
    const checksRegressed = regressed;

    // Log to experiment journal
    const entry: ExperimentEntry = {
      attempt: attemptNum,
      timestamp: new Date().toISOString(),
      hypothesis: intentData?.hypothesis ?? 'unknown',
      diffSummary: resultData?.lesson ?? `score ${newContinuous.toFixed(3)}`,
      scoreBefore: prevBestContinuous,
      scoreAfter: newContinuous,
      delta: newContinuous - prevBestContinuous,
      outcome,
      checksRegressed,
      checksImproved,
      lesson: resultData?.lesson ?? `${outcome}: ${newContinuous.toFixed(3)} vs best ${bestContinuous.toFixed(3)}`,
      base_commit: baseCommit,
      fieldSelector_tree_hash: treeHash,
      grader_version: GRADER_VERSION,
    };
    appendExperiment(fieldSelectorId, entry);

    // Log convergence point
    const perCheck = scorecardToPerCheck(scorecard);
    appendConvergencePoint({
      fieldSelector: fieldSelectorId,
      loop: i,
      timestamp: new Date().toISOString(),
      integer_total: newScore,
      continuous_total: newContinuous,
      max_applicable: scorecard.max_applicable,
      outcome,
      S1: perCheck['S1'] ?? 0, S2: perCheck['S2'] ?? 0,
      S3: perCheck['S3'] ?? 0, S4: perCheck['S4'] ?? 0,
      S5: perCheck['S5'] ?? 0, S6: perCheck['S6'] ?? 0,
      S7: perCheck['S7'] ?? 0,
      B1: perCheck['B1'] ?? 0, B2: perCheck['B2'] ?? 0,
      B3: perCheck['B3'] ?? 0, B4: perCheck['B4'] ?? 0,
      F1: perCheck['F1'] ?? 0, F2: perCheck['F2'] ?? 0,
      F3: perCheck['F3'] ?? 0, F4: perCheck['F4'] ?? 0,
    });

    // Stall detection
    if (noImprovementCount >= STALL_LIMIT) {
      console.log(`  Stalled — ${STALL_LIMIT} consecutive iterations with no improvement`);
      return {
        fieldSelectorId,
        startScore,
        endScore: newScore,
        bestScore,
        startContinuous,
        bestContinuous,
        loops: i,
        exitReason: 'stalled',
        newFixtures: countFixtures(fieldSelectorId) - initialFixtureCount,
        scorecards,
        bestScorecard: accepted.scorecard,
        errors,
        policyViolations,
      };
    }
  }

  return {
    fieldSelectorId,
    startScore,
    endScore: scorecard.total_numeric,
    bestScore,
    startContinuous,
    bestContinuous,
    loops: maxLoops,
    exitReason: 'max_loops',
    newFixtures: countFixtures(fieldSelectorId) - initialFixtureCount,
    scorecards,
    bestScorecard: accepted.scorecard,
    errors,
    policyViolations,
  };
}

// ---------------------------------------------------------------------------
// Morning report generator
// ---------------------------------------------------------------------------

function generateMorningReport(
  reports: FieldSelectorReport[],
  startTime: Date,
  outputDir: string,
): void {
  const endTime = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMin = Math.floor(durationMs / 60000);
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const today = new Date().toISOString().slice(0, 10);
  const totalImprovement = reports.reduce((sum, r) => sum + (r.bestScore - r.startScore), 0);
  const totalContinuousImprovement = reports.reduce((sum, r) => sum + (r.bestContinuous - r.startContinuous), 0);

  const lines: string[] = [];
  lines.push(`# NVCA Hardening Report — ${today}`);
  lines.push('');
  lines.push('| FieldSelector | Start | Best | Continuous | Loops | Exit Reason | New Fixtures | Violations |');
  lines.push('|--------|-------|------|------------|-------|-------------|--------------|------------|');

  for (const r of reports) {
    const shortId = r.fieldSelectorId.replace(/^nvca-/, '');
    const continuousStr = `${r.startContinuous.toFixed(1)}→${r.bestContinuous.toFixed(1)}`;
    const violationCount = r.policyViolations.length;
    lines.push(
      `| ${shortId} | ${r.startScore}/15 | ${r.bestScore}/15 | ${continuousStr} | ${r.loops} | ${r.exitReason} | ${r.newFixtures} | ${violationCount} |`,
    );
  }

  lines.push('');
  lines.push(`Duration: ${durationStr}`);
  lines.push(`Total improvement: +${totalImprovement} points across ${reports.length} fieldSelectors`);
  lines.push(`Total continuous improvement: +${totalContinuousImprovement.toFixed(3)}`);

  // Report errors if any
  const reportsWithErrors = reports.filter((r) => r.errors.length > 0);
  if (reportsWithErrors.length > 0) {
    lines.push('');
    lines.push('## Errors');
    for (const r of reportsWithErrors) {
      lines.push(`### ${r.fieldSelectorId}`);
      for (const e of r.errors) {
        lines.push(`- ${e.slice(0, 200)}`);
      }
    }
  }

  // Report policy violations if any
  const reportsWithViolations = reports.filter((r) => r.policyViolations.length > 0);
  if (reportsWithViolations.length > 0) {
    lines.push('');
    lines.push('## Edit Policy Violations');
    for (const r of reportsWithViolations) {
      lines.push(`### ${r.fieldSelectorId}`);
      const uniqueViolations = [...new Set(r.policyViolations)];
      for (const v of uniqueViolations) {
        lines.push(`- ${v}`);
      }
    }
  }

  const reportPath = join(outputDir, 'morning-report.md');
  writeFileSync(reportPath, lines.join('\n') + '\n');
  console.log(`\nMorning report written to: ${reportPath}`);

  // Also write detailed JSON
  const detailPath = join(outputDir, 'hardening-detail.json');
  writeFileSync(detailPath, JSON.stringify(reports, null, 2));
}

// ---------------------------------------------------------------------------
// Quality tracker updater
// ---------------------------------------------------------------------------

function updateQualityTracker(reports: FieldSelectorReport[]): void {
  if (!existsSync(QUALITY_TRACKER_PATH)) return;

  let content = readFileSync(QUALITY_TRACKER_PATH, 'utf-8');
  const today = new Date().toISOString().slice(0, 10);

  for (const report of reports) {
    const lastScorecard = report.bestScorecard ?? report.scorecards[report.scorecards.length - 1];
    if (!lastScorecard) continue;

    const { structural, behavioral, fill } = lastScorecard.scores;
    const tier = lastScorecard.maturity;
    const shortId = report.fieldSelectorId.replace(/^nvca-/, '');
    const fixtures = fixturesForFieldSelector(report.fieldSelectorId);
    const fixtureStr = fixtures.length > 0
      ? fixtures.map((f) => f.split('/').pop()).join(', ')
      : '—';

    // Replace the row for this fieldSelector
    const rowPattern = new RegExp(`^\\| ${escapeRegExp(report.fieldSelectorId)} \\|.*$`, 'm');
    const newRow = `| ${report.fieldSelectorId} | ${structural} | ${behavioral} | ${fill} | ${lastScorecard.scores.total} | ${tier} | ${fixtureStr} | ${today} |`;

    if (rowPattern.test(content)) {
      content = content.replace(rowPattern, newRow);
    }
  }

  writeFileSync(QUALITY_TRACKER_PATH, content);
  console.log('Quality tracker updated.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  const outputDir = opts.outputDir;
  outputDirGlobal = outputDir;
  mkdirSync(outputDir, { recursive: true });

  console.log('NVCA FieldSelector Hardening Loop');
  console.log(`  Max loops: ${opts.maxLoops}`);
  console.log(`  Stall limit: ${STALL_LIMIT}`);
  console.log(`  Grader version: ${GRADER_VERSION}`);
  console.log(`  Dry run: ${opts.dryRun}`);
  console.log(`  Output dir: ${outputDir}`);

  const fieldSelectorsToProcess = opts.fieldSelector
    ? [opts.fieldSelector]
    : FIELD_SELECTOR_ORDER;

  console.log(`  FieldSelectors: ${fieldSelectorsToProcess.join(', ')}`);

  const startTime = new Date();
  const reports: FieldSelectorReport[] = [];

  for (const fieldSelectorId of fieldSelectorsToProcess) {
    try {
      const report = await hardenFieldSelector(fieldSelectorId, opts.maxLoops, opts.dryRun, outputDir);
      reports.push(report);
    } catch (err) {
      const errMsg = (err as Error).message ?? String(err);
      console.error(`\nError processing ${fieldSelectorId}: ${errMsg}`);
      reports.push({
        fieldSelectorId,
        startScore: 0,
        endScore: 0,
        bestScore: 0,
        startContinuous: 0,
        bestContinuous: 0,
        loops: 0,
        exitReason: 'error',
        newFixtures: 0,
        scorecards: [],
        errors: [errMsg],
        policyViolations: [],
      });
    }
  }

  // Consolidate convergence data
  consolidateConvergenceData();

  // Generate morning report
  generateMorningReport(reports, startTime, outputDir);

  // Update quality tracker
  if (!opts.dryRun) {
    updateQualityTracker(reports);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const r of reports) {
    const delta = r.bestScore - r.startScore;
    const deltaStr = delta > 0 ? ` (+${delta})` : '';
    const continuousDelta = r.bestContinuous - r.startContinuous;
    const continuousDeltaStr = continuousDelta > 0 ? ` (continuous +${continuousDelta.toFixed(3)})` : '';
    console.log(`  ${r.fieldSelectorId}: ${r.startScore} → ${r.bestScore}/15${deltaStr}${continuousDeltaStr} [${r.exitReason}, ${r.loops} loops]`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

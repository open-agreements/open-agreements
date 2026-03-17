/**
 * Persistent experiment journal for the hardening loop.
 *
 * Stores an append-only JSONL log in .hardening-journal/<formId>.jsonl that
 * survives git reverts. Each entry records hypothesis, diff summary, scores,
 * outcome, and a one-line lesson learned.
 *
 * The structured file handshake requires the agent to write intent.json before
 * edits and result.json after edits, preventing hypothesis amnesia.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';

const PROJECT_ROOT = resolve(import.meta.dirname!, '../..');
const JOURNAL_DIR = join(PROJECT_ROOT, '.hardening-journal');

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ExperimentEntry {
  attempt: number;
  timestamp: string;
  hypothesis: string;
  diffSummary: string;
  scoreBefore: number;
  scoreAfter: number;
  delta: number;
  outcome: 'kept' | 'reverted' | 'invalid' | 'policy_violation';
  checksRegressed: string[];
  checksImproved: string[];
  lesson: string;
  base_commit: string;
  recipe_tree_hash: string;
  grader_version: string;
}

export interface IntentFile {
  hypothesis: string;
  planned_files: string[];
  target_checks: string[];
}

export interface ResultFile {
  lesson: string;
  changed_files: string[];
  changed_keys: string[];
}

// ---------------------------------------------------------------------------
// Grader version — bump when check logic changes materially
// ---------------------------------------------------------------------------

export const GRADER_VERSION = '2.0.0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureJournalDir(): void {
  if (!existsSync(JOURNAL_DIR)) {
    mkdirSync(JOURNAL_DIR, { recursive: true });
  }
}

function journalPath(formId: string): string {
  return join(JOURNAL_DIR, `${formId}.jsonl`);
}

function intentPath(formId: string): string {
  return join(JOURNAL_DIR, `${formId}.intent.json`);
}

function resultPath(formId: string): string {
  return join(JOURNAL_DIR, `${formId}.result.json`);
}

/**
 * Compute a stable hash of the recipe directory tree (metadata + replacements +
 * clean + computed) to detect when the recipe baseline has changed.
 */
export function computeRecipeTreeHash(recipeDir: string): string {
  const files = ['metadata.yaml', 'replacements.json', 'clean.json', 'computed.json'];
  const hash = createHash('sha256');
  for (const f of files) {
    const p = join(recipeDir, f);
    if (existsSync(p)) {
      hash.update(f + ':' + readFileSync(p, 'utf-8'));
    }
  }
  return hash.digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Journal read/write
// ---------------------------------------------------------------------------

export function appendExperiment(formId: string, entry: ExperimentEntry): void {
  ensureJournalDir();
  appendFileSync(journalPath(formId), JSON.stringify(entry) + '\n');
}

/**
 * Return the last N experiment entries for this form, filtered by freshness:
 * - Same grader_version
 * - Age ≤ maxAgeDays (default 14)
 */
export function getRecentHistory(
  formId: string,
  n: number = 5,
  maxAgeDays: number = 14,
): ExperimentEntry[] {
  const path = journalPath(formId);
  if (!existsSync(path)) return [];

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
  const entries: ExperimentEntry[] = [];

  for (const line of lines) {
    try {
      const entry: ExperimentEntry = JSON.parse(line);
      if (entry.grader_version !== GRADER_VERSION) continue;
      if (new Date(entry.timestamp).getTime() < cutoff) continue;
      entries.push(entry);
    } catch {
      // Skip malformed lines
    }
  }

  return entries.slice(-n);
}

/**
 * Get ALL entries (unfiltered) for semantic revisitation detection.
 */
export function getAllHistory(formId: string): ExperimentEntry[] {
  const path = journalPath(formId);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
  return lines.map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean) as ExperimentEntry[];
}

// ---------------------------------------------------------------------------
// Structured file handshake
// ---------------------------------------------------------------------------

export function writeIntentFile(formId: string, intent: IntentFile): void {
  ensureJournalDir();
  writeFileSync(intentPath(formId), JSON.stringify(intent, null, 2));
}

export function readIntentFile(formId: string): IntentFile | null {
  const p = intentPath(formId);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8'));
    if (typeof data.hypothesis !== 'string') return null;
    if (!Array.isArray(data.planned_files)) return null;
    if (!Array.isArray(data.target_checks)) return null;
    return data as IntentFile;
  } catch {
    return null;
  }
}

export function readResultFile(formId: string): ResultFile | null {
  const p = resultPath(formId);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8'));
    if (typeof data.lesson !== 'string') return null;
    if (!Array.isArray(data.changed_files)) return null;
    if (!Array.isArray(data.changed_keys)) return null;
    return data as ResultFile;
  } catch {
    return null;
  }
}

export function cleanHandshakeFiles(formId: string): void {
  try { rmSync(intentPath(formId)); } catch { /* ignore */ }
  try { rmSync(resultPath(formId)); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Prompt formatting
// ---------------------------------------------------------------------------

/**
 * Format experiment history as a markdown section for prompt injection.
 */
export function formatHistoryForPrompt(entries: ExperimentEntry[]): string {
  if (entries.length === 0) return '';

  const lines: string[] = [
    '## What We Already Tried (do NOT repeat these approaches)',
    '',
  ];

  for (const entry of entries) {
    const outcomeLabel = entry.outcome === 'kept' ? 'KEPT' : 'REVERTED';
    const scoreChange = `${entry.scoreBefore}→${entry.scoreAfter}`;
    lines.push(
      `Attempt ${entry.attempt} (${outcomeLabel}, ${scoreChange}): ${entry.hypothesis}` +
      (entry.lesson ? ` LESSON: ${entry.lesson}` : ''),
    );
    if (entry.checksRegressed.length > 0) {
      lines.push(`  Regressed: ${entry.checksRegressed.join(', ')}`);
    }
    if (entry.checksImproved.length > 0) {
      lines.push(`  Improved: ${entry.checksImproved.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format the structured output instructions for the agent.
 */
export function formatHandshakeInstructions(formId: string): string {
  return `## Structured Output (REQUIRED)

Before making any edits, write your intent:
\`\`\`bash
cat > .hardening-journal/${formId}.intent.json << 'INTENT_EOF'
{
  "hypothesis": "What you plan to change and why",
  "planned_files": ["list of files you will edit"],
  "target_checks": ["B2", "F2"]
}
INTENT_EOF
\`\`\`

After completing your edits, write your lesson:
\`\`\`bash
cat > .hardening-journal/${formId}.result.json << 'RESULT_EOF'
{
  "lesson": "One-line summary of what happened",
  "changed_files": ["list of files actually changed"],
  "changed_keys": ["list of replacement keys added/modified/removed"]
}
RESULT_EOF
\`\`\``;
}

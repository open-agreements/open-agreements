/**
 * Builds structured prompts for Codex CLI to improve NVCA recipe quality.
 *
 * The prompt includes the current scorecard, failing checks, recommendations,
 * field definitions, and specific guidance based on the failure category.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { RecipeScorecard } from './recipe-grader.js';
import type { ExperimentEntry } from './experiment-journal.js';
import { formatHistoryForPrompt, formatHandshakeInstructions } from './experiment-journal.js';

const PROJECT_ROOT = resolve(import.meta.dirname!, '../..');
const FIXTURES_DIR = join(PROJECT_ROOT, 'integration-tests', 'fixtures');

export interface CodexPromptOptions {
  recipeId: string;
  scorecard: RecipeScorecard;
  testOutput?: string;
  loopIteration: number;
  sourceTextExcerpt?: string;
  existingFixtures: string[];
  metadataFieldNames: string[];
  coiFixtureAsExample: Record<string, string>;
  experimentHistory?: ExperimentEntry[];
  maxLoops?: number;
}

export function buildCodexPrompt(opts: CodexPromptOptions): string {
  const {
    recipeId,
    scorecard,
    testOutput,
    loopIteration,
    sourceTextExcerpt,
    existingFixtures,
    metadataFieldNames,
    coiFixtureAsExample,
    experimentHistory,
    maxLoops,
  } = opts;

  const failingChecks = scorecard.checks.filter((c) => !c.passed);
  const lowestCategory = getLowestCategory(scorecard);

  const sections: string[] = [];

  // Header
  sections.push(`You are improving the NVCA recipe "${recipeId}" in the open-agreements project.`);

  // Score summary (show continuous total if available)
  const continuousInfo = scorecard.continuous_total !== undefined
    ? ` (continuous: ${scorecard.continuous_total.toFixed(3)})`
    : '';
  const effectiveMaxLoops = maxLoops ?? 20;
  sections.push(`## Current Score: ${scorecard.scores.total}${continuousInfo}  (target: 15/15)
## Iteration: ${loopIteration}/${effectiveMaxLoops}`);

  // Experiment history (prevents hypothesis amnesia)
  if (experimentHistory && experimentHistory.length > 0) {
    sections.push(formatHistoryForPrompt(experimentHistory));
  }

  // Structured output handshake
  sections.push(formatHandshakeInstructions(recipeId));

  // Failing checks
  if (failingChecks.length > 0) {
    sections.push(`## Failing Checks:\n${failingChecks.map((c) =>
      `- **${c.id} ${c.name}**: ${c.details ?? 'no details'}`
    ).join('\n')}`);
  } else {
    sections.push('## All Checks Passing!');
  }

  // Recommendations
  if (scorecard.recommendations.length > 0) {
    sections.push(`## Recommendations:\n${scorecard.recommendations.map((r) => `- ${r}`).join('\n')}`);
  }

  // Available fields
  sections.push(`## Available Fields (from metadata.yaml):\n${metadataFieldNames.map((f) => `- ${f}`).join('\n')}`);

  // Editable files
  sections.push(`## Recipe Files You May Edit:
- content/recipes/${recipeId}/metadata.yaml
- content/recipes/${recipeId}/replacements.json
- content/recipes/${recipeId}/clean.json
- content/recipes/${recipeId}/computed.json [create if needed]
- integration-tests/fixtures/${recipeId.replace(/^nvca-/, '')}*.json [create if needed]`);

  // Existing fixtures
  if (existingFixtures.length > 0) {
    sections.push(`## Existing Fixtures:\n${existingFixtures.map((f) => `- ${f}`).join('\n')}`);
  }

  // Fixture requirements
  const shortId = recipeId.replace(/^nvca-/, '');
  sections.push(`## Fixture Requirements:
Create 3 fixtures if they don't exist:
1. \`${shortId}-defaults.json\` — empty object \`{}\` (rely on metadata defaults)
2. \`${shortId}-partial.json\` — company name + a few key fields
3. \`${shortId}-series-c.json\` — every field explicitly set with realistic IMIM Technologies Series C values

Reference fixture (COI pattern):
\`\`\`json
${JSON.stringify(coiFixtureAsExample, null, 2)}
\`\`\`

Fixture files go in: integration-tests/fixtures/`);

  // Rules
  sections.push(`## Rules:
1. FORBIDDEN: Do NOT edit any file in scripts/, src/, packages/, or any .docx file. You may ONLY edit files in content/recipes/${recipeId}/ and integration-tests/fixtures/.
2. Every replacement key value must reference {field_name} defined in metadata.yaml.
3. Use context-qualified keys ("label text > [placeholder]") for ambiguous short placeholders.
4. Replacement values MUST NOT contain the search text (causes infinite loops).
5. Add synthetic but realistic values for any field the example doesn't cover.
6. For mutually exclusive options, ensure the fixture picks one and computed.json handles the branch.
7. All replacement keys with [bracketed placeholders] must match text that actually exists in the source document.
8. When adding new fields to metadata.yaml, always include: name, type, description, and default.
9. Do NOT invent synthetic helper fields (e.g. "optional_blank_value"). Only use fields already defined in metadata.yaml. If a new field is genuinely needed, it must represent real deal-term data, not a formatting workaround.
10. Multi-paragraph bracketed sections (e.g. ["DPA" means...], [Foreign Person...], [Limitation on...]) are OPTIONAL CLAUSES, not fill placeholders. Handle them with clean.json \`removeRanges\` (start/end pattern) or computed.json toggles — NEVER add them to replacements.json.
11. F3 formatting anomalies (single-char underlined runs) are baselined against the cleaned source — the verifier only flags NEW anomalies introduced by fill/patch. If F3 fails, investigate whether recipe edits are introducing formatting corruption.`);

  // Verify command
  sections.push(`## Verify Your Changes:
\`\`\`bash
node bin/open-agreements.js fill ${recipeId} -o /tmp/${recipeId}-test.docx --values integration-tests/fixtures/${shortId}-series-c.json
\`\`\``);

  // Source text excerpt for B-tier failures
  if (sourceTextExcerpt && lowestCategory === 'behavioral') {
    sections.push(`## Source Document Excerpt (first 4000 chars after clean):
\`\`\`
${sourceTextExcerpt.slice(0, 4000)}
\`\`\``);
  }

  // Zero-match keys for F4 failures
  if (scorecard.zero_match_keys.length > 0) {
    sections.push(`## Zero-Match Keys (these replacement keys matched nothing in the source):
${scorecard.zero_match_keys.map((k) => `- \`${k}\``).join('\n')}

These keys exist in replacements.json but don't match any text in the cleaned source document.
Either the key text has a typo, or the source text was already removed by clean.json.
Fix: update the key to match the exact text in the source, or remove if the section is intentionally cleaned.`);
  }

  // Test output from previous iteration
  if (testOutput) {
    sections.push(`## Test Output (from previous iteration):
\`\`\`
${testOutput.slice(0, 3000)}
\`\`\``);
  }

  // Category-specific guidance
  sections.push(getCategoryGuidance(lowestCategory, scorecard, failingChecks));

  // Field coverage details
  if (scorecard.field_coverage.uncovered.length > 0) {
    sections.push(`## Uncovered Fields (not referenced in any replacement):
${scorecard.field_coverage.uncovered.map((f) => `- ${f}`).join('\n')}

Each of these fields is defined in metadata.yaml but not used in replacements.json or computed.json.
Add replacement entries that map source document placeholders to these field values.`);
  }

  return sections.join('\n\n');
}

function getLowestCategory(scorecard: RecipeScorecard): 'structural' | 'behavioral' | 'fill' {
  const s = scorecard.checks.filter((c) => c.id.startsWith('S')).filter((c) => c.passed).length;
  const b = scorecard.checks.filter((c) => c.id.startsWith('B')).filter((c) => c.passed).length;
  const f = scorecard.checks.filter((c) => c.id.startsWith('F')).filter((c) => c.passed).length;

  // Normalize to percentage
  const sRatio = s / 7;
  const bRatio = b / 4;
  const fRatio = f / 4;

  if (sRatio <= bRatio && sRatio <= fRatio) return 'structural';
  if (bRatio <= fRatio) return 'behavioral';
  return 'fill';
}

function getCategoryGuidance(
  category: 'structural' | 'behavioral' | 'fill',
  scorecard: RecipeScorecard,
  failingChecks: Array<{ id: string; name: string; details?: string }>,
): string {
  const lines: string[] = ['## What To Fix This Iteration:'];

  switch (category) {
    case 'structural': {
      lines.push('Focus on structural foundation — these must pass before behavioral/fill checks work properly.');
      const sFailures = failingChecks.filter((c) => c.id.startsWith('S'));
      if (sFailures.some((c) => c.id === 'S1')) {
        lines.push('- Create any missing recipe files (metadata.yaml, replacements.json, clean.json)');
      }
      if (sFailures.some((c) => c.id === 'S2')) {
        lines.push('- Fix metadata.yaml schema errors');
      }
      if (sFailures.some((c) => c.id === 'S3')) {
        lines.push('- Map uncovered metadata fields to replacement entries');
      }
      if (sFailures.some((c) => c.id === 'S4')) {
        lines.push('- Add " > " context qualifiers to short/ambiguous replacement keys');
      }
      if (sFailures.some((c) => c.id === 'S7')) {
        lines.push('- Create test fixtures (defaults, partial, series-c) in integration-tests/fixtures/');
      }
      break;
    }
    case 'behavioral': {
      lines.push('Focus on replacement quality — keys must match actual source document text.');
      const bFailures = failingChecks.filter((c) => c.id.startsWith('B'));
      if (bFailures.some((c) => c.id === 'B2')) {
        lines.push('- Improve bracket pattern coverage: scan the source excerpt above for [bracketed] placeholders not yet in replacements.json');
      }
      if (bFailures.some((c) => c.id === 'B3')) {
        lines.push('- Add replacements for [___] underscore fill patterns in the source');
      }
      if (bFailures.some((c) => c.id === 'B4')) {
        lines.push('- Update clean.json to remove residual drafting notes or footnote artifacts');
      }
      break;
    }
    case 'fill': {
      lines.push('Focus on fill quality — the filled document must pass all verification checks.');
      const fFailures = failingChecks.filter((c) => c.id.startsWith('F'));
      if (fFailures.some((c) => c.id === 'F1')) {
        lines.push('- Fix default-only fill: ensure metadata defaults produce a valid document');
      }
      if (fFailures.some((c) => c.id === 'F2')) {
        lines.push('- Fix full-values fill: ensure all fixture values appear in the output and no placeholders remain');
      }
      if (fFailures.some((c) => c.id === 'F3')) {
        lines.push('- Fix F3 (formatting anomalies) — the verifier now baselines against the source, so failures mean fill/patch introduced new anomalies. Check if replacement values or computed rules are corrupting run-level formatting.');
      }
      if (fFailures.some((c) => c.id === 'F4')) {
        lines.push(`- Fix zero-match keys: ${scorecard.zero_match_keys.slice(0, 5).join(', ')}`);
      }
      break;
    }
  }

  return lines.join('\n');
}

/**
 * Load the COI fixture as a reference pattern for other recipes.
 */
export function loadCoiFixture(): Record<string, string> {
  const coiPath = join(FIXTURES_DIR, 'coi-imim-series-c.json');
  if (!existsSync(coiPath)) return {};
  return JSON.parse(readFileSync(coiPath, 'utf-8'));
}

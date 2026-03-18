#!/usr/bin/env npx tsx
/**
 * Programmatic 15-point recipe quality scorecard.
 *
 * Implements the checks from skills/recipe-quality-audit/SKILL.md as a callable
 * function. Reuses existing recipe infrastructure (verifier, patcher, metadata).
 *
 * Usage (standalone):
 *   npx tsx scripts/lib/recipe-grader.ts <recipe-id> [fixture.json]
 */

import { existsSync, readFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadRecipeMetadata,
  loadCleanConfig,
  validateRecipeMetadata,
} from '../../src/core/metadata.js';
import { resolveRecipeDir } from '../../src/utils/paths.js';
import { runRecipe, extractAllText, verifyOutput } from '../../src/core/recipe/index.js';
import { patchDocument } from '../../src/core/recipe/patcher.js';
import { cleanDocument } from '../../src/core/recipe/cleaner.js';
import { ensureSourceDocx } from '../../src/core/recipe/downloader.js';
import type { VerifyResult, VerifyCheck } from '../../src/core/recipe/types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CheckResult {
  id: string;
  name: string;
  passed: boolean;
  score?: number;         // 0.0–1.0, continuous; defaults to passed ? 1.0 : 0.0
  applicable?: boolean;   // false = N/A, excluded from denominator; defaults to true
  details?: string;
}

export interface RecipeScorecard {
  recipe_id: string;
  timestamp: string;
  maturity: 'scaffold' | 'beta' | 'production';
  scores: { structural: string; behavioral: string; fill: string; total: string };
  total_numeric: number;
  continuous_total: number;   // sum of all check scores (0.0–15.0)
  max_score: number; // 15 (or fewer if some checks are N/A)
  max_applicable: number;     // count of applicable checks
  checks: CheckResult[];
  field_coverage: { metadata_fields: number; replacement_refs: number; uncovered: string[] };
  zero_match_keys: string[];
  verify_result: VerifyResult | null;
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(import.meta.dirname!, '../..');
const FIXTURES_DIR = join(PROJECT_ROOT, 'integration-tests', 'fixtures');

// Map recipe IDs to fixture file prefixes (abbreviations used in existing fixtures)
const RECIPE_FIXTURE_PREFIXES: Record<string, string[]> = {
  'nvca-stock-purchase-agreement': ['spa-', 'stock-purchase-agreement-'],
  'nvca-certificate-of-incorporation': ['coi-', 'certificate-of-incorporation-'],
  'nvca-investors-rights-agreement': ['ira-', 'investors-rights-agreement-'],
  'nvca-voting-agreement': ['va-', 'voting-agreement-'],
  'nvca-rofr-co-sale-agreement': ['rofr-', 'rofr-co-sale-agreement-'],
  'nvca-indemnification-agreement': ['indemnification-', 'indemnification-agreement-'],
  'nvca-management-rights-letter': ['mrl-', 'management-rights-letter-'],
};

function fixturesForRecipe(recipeId: string): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  const shortId = recipeId.replace(/^nvca-/, '');
  const prefixes = RECIPE_FIXTURE_PREFIXES[recipeId] ?? [shortId + '-'];
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json') && prefixes.some((p) => f.startsWith(p)))
    .map((f) => join(FIXTURES_DIR, f));
}

function loadFixtureValues(fixturePath?: string): Record<string, string> {
  if (!fixturePath || !existsSync(fixturePath)) return {};
  return JSON.parse(readFileSync(fixturePath, 'utf-8'));
}

function loadBestFixture(fixtures: string[]): Record<string, string> {
  if (fixtures.length === 0) return {};
  // Prefer series-c > full > partial > defaults
  const priority = ['series-c', 'full', 'partial'];
  for (const suffix of priority) {
    const match = fixtures.find((f) => f.includes(suffix));
    if (match) return loadFixtureValues(match);
  }
  // Fall back to last (most likely the richest fixture alphabetically)
  return loadFixtureValues(fixtures[fixtures.length - 1]);
}

function buildDefaultValues(recipeDir: string): Record<string, string> {
  const meta = loadRecipeMetadata(recipeDir);
  const defaults: Record<string, string> = {};
  for (const field of meta.fields) {
    if (field.default !== undefined) {
      defaults[field.name] = field.default;
    }
  }
  return defaults;
}

// ---------------------------------------------------------------------------
// Individual check implementations
// ---------------------------------------------------------------------------

function checkS1FileInventory(recipeDir: string): CheckResult {
  const required = ['metadata.yaml', 'replacements.json', 'clean.json'];
  const optional = ['computed.json', 'normalize.json', 'selections.json'];
  const missing = required.filter((f) => !existsSync(join(recipeDir, f)));
  const present = optional.filter((f) => existsSync(join(recipeDir, f)));
  return {
    id: 'S1',
    name: 'File inventory',
    passed: missing.length === 0,
    details: missing.length > 0
      ? `Missing required files: ${missing.join(', ')}`
      : `All required files present. Optional: ${present.join(', ') || 'none'}`,
  };
}

function checkS2MetadataValid(recipeDir: string): CheckResult {
  const result = validateRecipeMetadata(recipeDir);
  return {
    id: 'S2',
    name: 'Metadata valid',
    passed: result.valid,
    details: result.valid ? undefined : `Errors: ${result.errors.join('; ')}`,
  };
}

function checkS3FieldCoverage(recipeDir: string): {
  check: CheckResult;
  coverage: { metadata_fields: number; replacement_refs: number; uncovered: string[] };
} {
  const meta = loadRecipeMetadata(recipeDir);
  const replacementsPath = join(recipeDir, 'replacements.json');
  const fieldNames = new Set(meta.fields.map((f) => f.name));

  if (!existsSync(replacementsPath)) {
    return {
      check: { id: 'S3', name: 'Field-to-replacement coverage', passed: false, details: 'No replacements.json' },
      coverage: { metadata_fields: fieldNames.size, replacement_refs: 0, uncovered: [...fieldNames] },
    };
  }

  const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));
  const referencedFields = new Set<string>();
  for (const value of Object.values(replacements)) {
    for (const match of value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
      referencedFields.add(match[1]);
    }
  }

  // Also check computed.json for field references
  const computedPath = join(recipeDir, 'computed.json');
  if (existsSync(computedPath)) {
    const computed = JSON.parse(readFileSync(computedPath, 'utf-8'));
    const computedStr = JSON.stringify(computed);
    for (const match of computedStr.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
      referencedFields.add(match[1]);
    }
    // Also add fields referenced in when_all/when_any predicates
    if (computed.rules) {
      for (const rule of computed.rules) {
        for (const pred of [...(rule.when_all ?? []), ...(rule.when_any ?? [])]) {
          if (pred.field) referencedFields.add(pred.field);
        }
        // set_fill values reference field names too
        if (rule.set_fill) {
          for (const val of Object.values(rule.set_fill)) {
            if (typeof val === 'string') {
              for (const m of val.matchAll(/\$\{([a-zA-Z0-9_]+)\}/g)) {
                referencedFields.add(m[1]);
              }
            }
          }
        }
      }
    }
  }

  const uncovered = [...fieldNames].filter((f) => !referencedFields.has(f));
  const covered = fieldNames.size - uncovered.length;
  const passed = uncovered.length === 0 || covered / fieldNames.size >= 0.8;
  const score = fieldNames.size > 0 ? covered / fieldNames.size : 1.0;

  return {
    check: {
      id: 'S3',
      name: 'Field-to-replacement coverage',
      passed,
      score,
      details: uncovered.length > 0
        ? `${covered}/${fieldNames.size} fields covered. Uncovered: ${uncovered.join(', ')}`
        : `All ${fieldNames.size} fields referenced in replacements`,
    },
    coverage: {
      metadata_fields: fieldNames.size,
      replacement_refs: referencedFields.size,
      uncovered,
    },
  };
}

function checkS4AmbiguousKeys(recipeDir: string): CheckResult {
  const replacementsPath = join(recipeDir, 'replacements.json');
  if (!existsSync(replacementsPath)) {
    return { id: 'S4', name: 'Ambiguous keys', passed: false, details: 'No replacements.json' };
  }
  const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));
  const totalKeys = Object.keys(replacements).length;
  const ambiguous = Object.keys(replacements).filter((key) => {
    // Context-qualified keys are OK regardless of length
    if (key.includes(' > ')) return false;
    // Short keys (< 8 chars) without context are ambiguous
    return key.length < 8;
  });
  const score = totalKeys > 0 ? 1 - (ambiguous.length / totalKeys) : 1.0;
  return {
    id: 'S4',
    name: 'Ambiguous keys',
    passed: ambiguous.length === 0,
    score,
    details: ambiguous.length > 0 ? `Short keys without context: ${ambiguous.join(', ')}` : undefined,
  };
}

function checkS5SmartQuotes(): CheckResult {
  // Auto-pass: patcher normalizes smart quotes via normalizeQuotes()
  return { id: 'S5', name: 'Smart quotes', passed: true, details: 'Auto-pass (patcher normalizes)' };
}

function checkS6SourceSHA(recipeDir: string): CheckResult {
  try {
    const meta = loadRecipeMetadata(recipeDir);
    return {
      id: 'S6',
      name: 'Source SHA',
      passed: !!meta.source_sha256,
      details: meta.source_sha256 ? `SHA: ${meta.source_sha256.slice(0, 16)}...` : 'No source_sha256 in metadata',
    };
  } catch {
    return { id: 'S6', name: 'Source SHA', passed: false, details: 'Could not load metadata' };
  }
}

function checkS7TestFixture(recipeId: string): CheckResult {
  const fixtures = fixturesForRecipe(recipeId);
  return {
    id: 'S7',
    name: 'Test fixture',
    passed: fixtures.length > 0,
    details: fixtures.length > 0
      ? `Found ${fixtures.length} fixture(s)`
      : 'No test fixtures found in integration-tests/fixtures/',
  };
}

async function checkB1SourceScan(recipeId: string, recipeDir: string): Promise<CheckResult> {
  try {
    const meta = loadRecipeMetadata(recipeDir);
    const sourcePath = await ensureSourceDocx(recipeId, meta);
    const text = extractAllText(sourcePath);
    const bracketPatterns = text.match(/\[[_A-Z][_A-Z\s]*\]/g) ?? [];
    return {
      id: 'B1',
      name: 'Source scan',
      passed: bracketPatterns.length > 0,
      details: `Found ${bracketPatterns.length} bracket pattern(s) in source document`,
    };
  } catch (err) {
    return { id: 'B1', name: 'Source scan', passed: false, details: `Error: ${(err as Error).message}` };
  }
}

async function checkB2CoverageRatio(
  recipeId: string,
  recipeDir: string,
): Promise<CheckResult> {
  try {
    const meta = loadRecipeMetadata(recipeDir);
    const sourcePath = await ensureSourceDocx(recipeId, meta);
    const text = extractAllText(sourcePath);

    // All bracket patterns in source
    const bracketPatterns = [...new Set(text.match(/\[[^\]]+\]/g) ?? [])];
    if (bracketPatterns.length === 0) {
      return { id: 'B2', name: 'Coverage ratio', passed: true, details: 'No bracket patterns in source' };
    }

    const replacementsPath = join(recipeDir, 'replacements.json');
    if (!existsSync(replacementsPath)) {
      return { id: 'B2', name: 'Coverage ratio', passed: false, details: 'No replacements.json' };
    }
    const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));
    const replacementKeys = Object.keys(replacements);

    // Count how many bracket patterns are covered by replacement keys
    let covered = 0;
    for (const pattern of bracketPatterns) {
      const isCovered = replacementKeys.some((key) => {
        // Simple key match: key contains the pattern text
        if (key.includes(pattern)) return true;
        // Context key match: the search text portion matches
        if (key.includes(' > ')) {
          const searchText = key.split(' > ').pop()?.trim() ?? '';
          if (searchText === pattern) return true;
        }
        return false;
      });
      if (isCovered) covered++;
    }

    const ratio = covered / bracketPatterns.length;
    return {
      id: 'B2',
      name: 'Coverage ratio',
      passed: ratio >= 0.7,
      score: ratio,
      details: `${covered}/${bracketPatterns.length} bracket patterns covered (${(ratio * 100).toFixed(1)}%)`,
    };
  } catch (err) {
    return { id: 'B2', name: 'Coverage ratio', passed: false, details: `Error: ${(err as Error).message}` };
  }
}

async function checkB3UnmatchedUnderscores(
  recipeId: string,
  recipeDir: string,
): Promise<CheckResult> {
  try {
    const meta = loadRecipeMetadata(recipeDir);
    const sourcePath = await ensureSourceDocx(recipeId, meta);
    const text = extractAllText(sourcePath);

    const underscorePatterns = [...new Set(text.match(/\[_{3,}\]/g) ?? [])];
    if (underscorePatterns.length === 0) {
      return { id: 'B3', name: 'Unmatched underscores', passed: true, details: 'No underscore patterns found' };
    }

    const replacementsPath = join(recipeDir, 'replacements.json');
    if (!existsSync(replacementsPath)) {
      return { id: 'B3', name: 'Unmatched underscores', passed: false, details: 'No replacements.json' };
    }
    const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));
    const replacementKeysStr = JSON.stringify(Object.keys(replacements));

    const unmatched = underscorePatterns.filter((p) => !replacementKeysStr.includes(p));
    return {
      id: 'B3',
      name: 'Unmatched underscores',
      passed: unmatched.length === 0,
      details: unmatched.length > 0
        ? `${unmatched.length} unmatched underscore pattern(s): ${unmatched.slice(0, 5).join(', ')}`
        : `All ${underscorePatterns.length} underscore patterns covered`,
    };
  } catch (err) {
    return { id: 'B3', name: 'Unmatched underscores', passed: false, details: `Error: ${(err as Error).message}` };
  }
}

async function checkB4CleanEffectiveness(
  recipeId: string,
  recipeDir: string,
): Promise<CheckResult> {
  const tempDir = mkdtempSync(join(tmpdir(), `grader-b4-${recipeId}-`));
  try {
    const meta = loadRecipeMetadata(recipeDir);
    const cleanConfig = loadCleanConfig(recipeDir);
    const sourcePath = await ensureSourceDocx(recipeId, meta);
    const cleanedPath = join(tempDir, 'cleaned.docx');
    await cleanDocument(sourcePath, cleanedPath, cleanConfig);

    const text = extractAllText(cleanedPath);
    const issues: string[] = [];
    if (/note to drafter/i.test(text)) issues.push('Contains "Note to Drafter"');
    // Check if removeFootnotes was set and footnotes still present
    if (cleanConfig.removeFootnotes) {
      // Just check text for common footnote markers — the verifier does the XML check
      // Here we just verify the clean step worked at the text level
    }
    if (cleanConfig.removeParagraphPatterns && cleanConfig.removeParagraphPatterns.length > 0) {
      for (const pattern of cleanConfig.removeParagraphPatterns) {
        if (new RegExp(pattern, 'i').test(text)) {
          issues.push(`Pattern still present: ${pattern.slice(0, 40)}`);
        }
      }
    }

    return {
      id: 'B4',
      name: 'Clean effectiveness',
      passed: issues.length === 0,
      details: issues.length > 0 ? issues.join('; ') : 'Clean removed all targeted content',
    };
  } catch (err) {
    return { id: 'B4', name: 'Clean effectiveness', passed: false, details: `Error: ${(err as Error).message}` };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function checkF1DefaultFill(
  recipeId: string,
  recipeDir: string,
  outputDir: string,
): Promise<{ check: CheckResult; verifyResult: VerifyResult | null }> {
  const tempDir = mkdtempSync(join(tmpdir(), `grader-f1-${recipeId}-`));
  try {
    const defaults = buildDefaultValues(recipeDir);
    const outPath = join(outputDir, `${recipeId}-defaults-fill.docx`);
    await runRecipe({
      recipeId,
      outputPath: outPath,
      values: defaults,
    });

    // Clean source for formatting anomaly baseline
    const meta = loadRecipeMetadata(recipeDir);
    const cleanConfig = loadCleanConfig(recipeDir);
    const sourcePath = await ensureSourceDocx(recipeId, meta);
    const cleanedSourcePath = join(tempDir, 'cleaned-source.docx');
    await cleanDocument(sourcePath, cleanedSourcePath, cleanConfig);

    const replacementsPath = join(recipeDir, 'replacements.json');
    const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));
    const result = await verifyOutput(outPath, defaults, replacements, cleanConfig, cleanedSourcePath);

    const failedChecks = result.checks.filter((c) => !c.passed);
    const totalVerify = result.checks.length;
    const passedVerify = totalVerify - failedChecks.length;
    const score = totalVerify > 0 ? passedVerify / totalVerify : (result.passed ? 1.0 : 0.0);
    return {
      check: {
        id: 'F1',
        name: 'Default-only fill',
        passed: result.passed,
        score,
        details: failedChecks.length > 0
          ? `${failedChecks.length} verify check(s) failed: ${failedChecks.map((c) => c.name).join(', ')}`
          : 'Default-only fill passed all verify checks',
      },
      verifyResult: result,
    };
  } catch (err) {
    return {
      check: { id: 'F1', name: 'Default-only fill', passed: false, score: 0, details: `Error: ${(err as Error).message}` },
      verifyResult: null,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function checkF2FullFill(
  recipeId: string,
  recipeDir: string,
  fixtureValues: Record<string, string>,
  outputDir: string,
): Promise<{ check: CheckResult; verifyResult: VerifyResult | null }> {
  if (Object.keys(fixtureValues).length === 0) {
    return {
      check: {
        id: 'F2',
        name: 'Full-values fill',
        passed: false,
        details: 'No fixture provided — create a fixture to test full fill',
      },
      verifyResult: null,
    };
  }

  const tempDir = mkdtempSync(join(tmpdir(), `grader-f2-${recipeId}-`));
  try {
    const defaults = buildDefaultValues(recipeDir);
    const merged = { ...defaults, ...fixtureValues };
    const outPath = join(outputDir, `${recipeId}-full-fill.docx`);
    await runRecipe({
      recipeId,
      outputPath: outPath,
      values: merged,
    });

    // Clean source for formatting anomaly baseline
    const meta = loadRecipeMetadata(recipeDir);
    const cleanConfig = loadCleanConfig(recipeDir);
    const sourcePath = await ensureSourceDocx(recipeId, meta);
    const cleanedSourcePath = join(tempDir, 'cleaned-source.docx');
    await cleanDocument(sourcePath, cleanedSourcePath, cleanConfig);

    const replacementsPath = join(recipeDir, 'replacements.json');
    const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));
    const result = await verifyOutput(outPath, merged, replacements, cleanConfig, cleanedSourcePath);

    const failedChecks = result.checks.filter((c) => !c.passed);
    const totalVerify = result.checks.length;
    const passedVerify = totalVerify - failedChecks.length;
    const score = totalVerify > 0 ? passedVerify / totalVerify : (result.passed ? 1.0 : 0.0);
    return {
      check: {
        id: 'F2',
        name: 'Full-values fill',
        passed: result.passed,
        score,
        details: failedChecks.length > 0
          ? `${failedChecks.length} verify check(s) failed: ${failedChecks.map((c) => `${c.name}${c.details ? ` (${c.details})` : ''}`).join('; ')}`
          : 'Full-values fill passed all verify checks',
      },
      verifyResult: result,
    };
  } catch (err) {
    return {
      check: { id: 'F2', name: 'Full-values fill', passed: false, score: 0, details: `Error: ${(err as Error).message}` },
      verifyResult: null,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function checkF3FormattingAnomalies(
  recipeId: string,
  recipeDir: string,
  fixtureValues: Record<string, string>,
  outputDir: string,
): Promise<CheckResult> {
  // Reuse the fill output from F2 if it exists, otherwise do a fresh fill
  const outPath = join(outputDir, `${recipeId}-full-fill.docx`);
  if (!existsSync(outPath)) {
    // Run with defaults if no full fill was done
    try {
      const defaults = buildDefaultValues(recipeDir);
      const merged = { ...defaults, ...fixtureValues };
      await runRecipe({ recipeId, outputPath: outPath, values: merged });
    } catch {
      return { id: 'F3', name: 'Formatting anomalies', passed: false, details: 'Could not produce fill output' };
    }
  }

  const tempDir = mkdtempSync(join(tmpdir(), `grader-f3-${recipeId}-`));
  try {
    // Clean the source to establish baseline anomaly count
    const meta = loadRecipeMetadata(recipeDir);
    const cleanConfig = loadCleanConfig(recipeDir);
    const sourcePath = await ensureSourceDocx(recipeId, meta);
    const cleanedSourcePath = join(tempDir, 'cleaned-source.docx');
    await cleanDocument(sourcePath, cleanedSourcePath, cleanConfig);

    const replacementsPath = join(recipeDir, 'replacements.json');
    const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));
    const result = await verifyOutput(outPath, {}, replacements, cleanConfig, cleanedSourcePath);
    const anomalyCheck = result.checks.find((c) => c.name === 'No formatting anomalies');
    return {
      id: 'F3',
      name: 'Formatting anomalies',
      passed: anomalyCheck?.passed ?? true,
      details: anomalyCheck?.details,
    };
  } catch (err) {
    return { id: 'F3', name: 'Formatting anomalies', passed: false, details: `Error: ${(err as Error).message}` };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function checkF4ZeroMatchKeys(
  recipeId: string,
  recipeDir: string,
  fixtureValues: Record<string, string>,
  outputDir: string,
): Promise<{ check: CheckResult; zeroMatchKeys: string[] }> {
  const tempDir = mkdtempSync(join(tmpdir(), `grader-f4-${recipeId}-`));
  try {
    const meta = loadRecipeMetadata(recipeDir);
    const cleanConfig = loadCleanConfig(recipeDir);
    const sourcePath = await ensureSourceDocx(recipeId, meta);
    const cleanedPath = join(tempDir, 'cleaned.docx');
    await cleanDocument(sourcePath, cleanedPath, cleanConfig);

    const replacementsPath = join(recipeDir, 'replacements.json');
    const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));

    // Interpolate field values into replacement values
    const defaults = buildDefaultValues(recipeDir);
    const merged = { ...defaults, ...fixtureValues };
    const interpolated: Record<string, string> = {};
    for (const [key, value] of Object.entries(replacements)) {
      interpolated[key] = value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, field) => {
        return merged[field] ?? `{${field}}`;
      });
    }

    const patchedPath = join(tempDir, 'patched.docx');
    const patchResult = await patchDocument(cleanedPath, patchedPath, interpolated);

    const totalKeys = Object.keys(interpolated).length;
    const zeroCount = patchResult.zeroMatchKeys.length;
    const score = totalKeys > 0 ? 1 - (zeroCount / totalKeys) : 1.0;

    return {
      check: {
        id: 'F4',
        name: 'Zero-match keys',
        passed: zeroCount === 0,
        score,
        details: patchResult.zeroMatchKeys.length > 0
          ? `${patchResult.zeroMatchKeys.length} key(s) matched nothing: ${patchResult.zeroMatchKeys.slice(0, 5).join(', ')}`
          : 'All replacement keys matched at least once',
      },
      zeroMatchKeys: patchResult.zeroMatchKeys,
    };
  } catch (err) {
    return {
      check: { id: 'F4', name: 'Zero-match keys', passed: false, score: 0, details: `Error: ${(err as Error).message}` },
      zeroMatchKeys: [],
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Recommendation engine
// ---------------------------------------------------------------------------

function generateRecommendations(checks: CheckResult[], coverage: { uncovered: string[] }, zeroMatchKeys: string[]): string[] {
  const recs: string[] = [];

  for (const check of checks) {
    if (check.passed) continue;
    switch (check.id) {
      case 'S1':
        recs.push('Create missing recipe files (replacements.json, clean.json, metadata.yaml)');
        break;
      case 'S2':
        recs.push(`Fix metadata validation errors: ${check.details}`);
        break;
      case 'S3':
        if (coverage.uncovered.length > 0) {
          recs.push(`Add replacement entries for uncovered fields: ${coverage.uncovered.slice(0, 5).join(', ')}`);
        }
        break;
      case 'S4':
        recs.push(`Add context qualifiers to short replacement keys: ${check.details}`);
        break;
      case 'S6':
        recs.push('Add source_sha256 to metadata.yaml for integrity verification');
        break;
      case 'S7':
        recs.push('Create test fixtures in integration-tests/fixtures/ (defaults, partial, full)');
        break;
      case 'B1':
        recs.push('Source document has no bracket patterns — verify source_url is correct');
        break;
      case 'B2':
        recs.push(`Improve bracket pattern coverage in replacements.json: ${check.details}`);
        break;
      case 'B3':
        recs.push(`Add replacement entries for unmatched underscore patterns: ${check.details}`);
        break;
      case 'B4':
        recs.push(`Clean config is not removing all targeted content: ${check.details}`);
        break;
      case 'F1':
        recs.push(`Default-only fill has issues: ${check.details}`);
        break;
      case 'F2':
        recs.push(`Full-values fill has issues: ${check.details}`);
        break;
      case 'F3':
        recs.push(`Formatting anomalies introduced by fill/patch: ${check.details}`);
        break;
      case 'F4':
        if (zeroMatchKeys.length > 0) {
          recs.push(`Fix zero-match replacement keys (typo or stale?): ${zeroMatchKeys.slice(0, 5).join(', ')}`);
        }
        break;
    }
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Main grading function
// ---------------------------------------------------------------------------

export async function gradeRecipe(
  recipeId: string,
  fixtureValues?: Record<string, string>,
  outputDir?: string,
): Promise<RecipeScorecard> {
  const recipeDir = resolveRecipeDir(recipeId);
  const effectiveOutputDir = outputDir ?? mkdtempSync(join(tmpdir(), `grader-${recipeId}-`));

  const checks: CheckResult[] = [];
  let fieldCoverage = { metadata_fields: 0, replacement_refs: 0, uncovered: [] as string[] };
  let zeroMatchKeys: string[] = [];
  let verifyResult: VerifyResult | null = null;

  // --- Structural checks (S1-S7) ---
  checks.push(checkS1FileInventory(recipeDir));
  checks.push(checkS2MetadataValid(recipeDir));

  const s3 = checkS3FieldCoverage(recipeDir);
  checks.push(s3.check);
  fieldCoverage = s3.coverage;

  checks.push(checkS4AmbiguousKeys(recipeDir));
  checks.push(checkS5SmartQuotes());
  checks.push(checkS6SourceSHA(recipeDir));
  checks.push(checkS7TestFixture(recipeId));

  // --- Behavioral checks (B1-B4) ---
  // These require downloading/processing the source document
  const hasReplacements = existsSync(join(recipeDir, 'replacements.json'));

  if (hasReplacements) {
    checks.push(await checkB1SourceScan(recipeId, recipeDir));
    checks.push(await checkB2CoverageRatio(recipeId, recipeDir));
    checks.push(await checkB3UnmatchedUnderscores(recipeId, recipeDir));
    checks.push(await checkB4CleanEffectiveness(recipeId, recipeDir));
  } else {
    checks.push({ id: 'B1', name: 'Source scan', passed: false, details: 'No replacements.json' });
    checks.push({ id: 'B2', name: 'Coverage ratio', passed: false, details: 'No replacements.json' });
    checks.push({ id: 'B3', name: 'Unmatched underscores', passed: false, details: 'No replacements.json' });
    checks.push({ id: 'B4', name: 'Clean effectiveness', passed: false, details: 'No replacements.json' });
  }

  // --- Fill checks (F1-F4) ---
  if (hasReplacements) {
    // Find best fixture for this recipe
    const fixtures = fixturesForRecipe(recipeId);
    // Prefer series-c > full > partial > defaults (defaults.json is {} which breaks F2)
    const effectiveFixture = fixtureValues ?? loadBestFixture(fixtures);

    const f1 = await checkF1DefaultFill(recipeId, recipeDir, effectiveOutputDir);
    checks.push(f1.check);
    verifyResult = f1.verifyResult;

    const f2 = await checkF2FullFill(recipeId, recipeDir, effectiveFixture, effectiveOutputDir);
    checks.push(f2.check);
    if (f2.verifyResult) verifyResult = f2.verifyResult;

    checks.push(await checkF3FormattingAnomalies(recipeId, recipeDir, effectiveFixture, effectiveOutputDir));

    const f4 = await checkF4ZeroMatchKeys(recipeId, recipeDir, effectiveFixture, effectiveOutputDir);
    checks.push(f4.check);
    zeroMatchKeys = f4.zeroMatchKeys;
  } else {
    checks.push({ id: 'F1', name: 'Default-only fill', passed: false, details: 'No replacements.json' });
    checks.push({ id: 'F2', name: 'Full-values fill', passed: false, details: 'No replacements.json' });
    checks.push({ id: 'F3', name: 'Formatting anomalies', passed: false, details: 'No replacements.json' });
    checks.push({ id: 'F4', name: 'Zero-match keys', passed: false, details: 'No replacements.json' });
  }

  // --- Fill in default scores for checks that didn't set them ---
  for (const check of checks) {
    check.score ??= check.passed ? 1.0 : 0.0;
    check.applicable ??= true;
  }

  // --- Score computation ---
  const structural = checks.filter((c) => c.id.startsWith('S')).filter((c) => c.passed).length;
  const behavioral = checks.filter((c) => c.id.startsWith('B')).filter((c) => c.passed).length;
  const fill = checks.filter((c) => c.id.startsWith('F')).filter((c) => c.passed).length;
  const total = structural + behavioral + fill;

  // Continuous total: sum of all applicable check scores
  const applicableChecks = checks.filter((c) => c.applicable);
  const continuousTotal = applicableChecks.reduce((sum, c) => sum + (c.score ?? 0), 0);
  const maxApplicable = applicableChecks.length;

  const pctApplicable = maxApplicable > 0 ? continuousTotal / maxApplicable : 0;
  const maturity: RecipeScorecard['maturity'] =
    pctApplicable >= 1.0 && fixturesForRecipe(recipeId).length > 0 ? 'production' :
    pctApplicable >= 0.67 ? 'beta' : 'scaffold';

  const recommendations = generateRecommendations(checks, fieldCoverage, zeroMatchKeys);

  return {
    recipe_id: recipeId,
    timestamp: new Date().toISOString(),
    maturity,
    scores: {
      structural: `${structural}/7`,
      behavioral: `${behavioral}/4`,
      fill: `${fill}/4`,
      total: `${total}/15`,
    },
    total_numeric: total,
    continuous_total: continuousTotal,
    max_score: 15,
    max_applicable: maxApplicable,
    checks,
    field_coverage: fieldCoverage,
    zero_match_keys: zeroMatchKeys,
    verify_result: verifyResult,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const recipeId = process.argv[2];
  if (!recipeId) {
    console.error('Usage: npx tsx scripts/lib/recipe-grader.ts <recipe-id> [fixture.json]');
    process.exit(1);
  }

  const fixturePath = process.argv[3];
  const fixtureValues = fixturePath ? loadFixtureValues(resolve(fixturePath)) : undefined;
  const outputDir = join(PROJECT_ROOT, '.nvca-hardening-output');

  if (!existsSync(outputDir)) {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Grading recipe: ${recipeId}`);
  const scorecard = await gradeRecipe(recipeId, fixtureValues, outputDir);

  console.log(`\nScore: ${scorecard.scores.total} (${scorecard.maturity}) — continuous: ${scorecard.continuous_total.toFixed(3)}/${scorecard.max_applicable}`);
  console.log(`  Structural: ${scorecard.scores.structural}`);
  console.log(`  Behavioral: ${scorecard.scores.behavioral}`);
  console.log(`  Fill:       ${scorecard.scores.fill}`);
  console.log('\nChecks:');
  for (const check of scorecard.checks) {
    console.log(`  ${check.passed ? '✓' : '✗'} ${check.id} ${check.name}${check.details ? ` — ${check.details}` : ''}`);
  }
  if (scorecard.recommendations.length > 0) {
    console.log('\nRecommendations:');
    for (const rec of scorecard.recommendations) {
      console.log(`  → ${rec}`);
    }
  }
}

// Only run CLI if invoked directly
const isMainModule = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename!);
if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

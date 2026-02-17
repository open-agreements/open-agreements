import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadRecipeMetadata, loadNormalizeConfig } from '../dist/core/metadata.js';
import { ensureSourceDocx } from '../dist/core/recipe/downloader.js';
import { checkRecipeSourceDrift } from '../dist/core/recipe/source-drift.js';

function parseArgs(argv) {
  const parsed = {
    recipeIds: [],
    download: false,
    strictMissing: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--recipe' || arg === '-r') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --recipe');
      }
      parsed.recipeIds.push(next);
      i += 1;
      continue;
    }
    if (arg === '--download') {
      parsed.download = true;
      continue;
    }
    if (arg === '--strict-missing') {
      parsed.strictMissing = true;
      continue;
    }
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/source_drift_canary.mjs [options]',
      '',
      'Checks recipe source hash + structural anchor drift against metadata/replacements/normalize config.',
      '',
      'Options:',
      '  -r, --recipe <id>    Check only one recipe (repeatable)',
      '      --download       Download source docx if cache is missing',
      '      --strict-missing Fail when source cache is missing',
      '      --json           Print full JSON report',
      '  -h, --help           Show help',
    ].join('\n')
  );
}

function listRecipeIds(recipesRoot) {
  return readdirSync(recipesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function getCachedSourcePath(recipeId) {
  return join(homedir(), '.open-agreements', 'cache', recipeId, 'source.docx');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const root = process.cwd();
  const recipesRoot = join(root, 'recipes');
  const recipeIds = args.recipeIds.length > 0 ? args.recipeIds : listRecipeIds(recipesRoot);

  const report = {
    generated_at: new Date().toISOString(),
    checked: [],
    skipped_missing_source: [],
  };

  for (const recipeId of recipeIds) {
    const recipeDir = join(recipesRoot, recipeId);
    const metadata = loadRecipeMetadata(recipeDir);
    const normalizeConfig = loadNormalizeConfig(recipeDir);
    const replacementsPath = join(recipeDir, 'replacements.json');
    const replacements = existsSync(replacementsPath)
      ? JSON.parse(readFileSync(replacementsPath, 'utf-8'))
      : {};

    let sourcePath = getCachedSourcePath(recipeId);
    if (!existsSync(sourcePath) && args.download) {
      sourcePath = await ensureSourceDocx(recipeId, metadata);
    }

    if (!existsSync(sourcePath)) {
      report.skipped_missing_source.push({
        recipe_id: recipeId,
        source_path: sourcePath,
      });
      continue;
    }

    const result = checkRecipeSourceDrift({
      recipeId,
      sourcePath,
      metadata,
      replacements,
      normalizeConfig,
    });
    report.checked.push(result);
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\nSource Drift Canary');
    console.log(`Checked: ${report.checked.length}`);
    console.log(`Skipped (missing source): ${report.skipped_missing_source.length}`);
    for (const result of report.checked) {
      const status = result.ok ? 'PASS' : 'FAIL';
      console.log(`- ${status} ${result.recipe_id}`);
      if (!result.hash_match) {
        console.log(`    hash mismatch: expected=${result.expected_sha256 ?? '<none>'} actual=${result.actual_sha256}`);
      }
      if (result.diff.missing_replacement_anchor_groups.length > 0) {
        console.log(`    missing replacement anchor groups: ${result.diff.missing_replacement_anchor_groups.length}`);
      }
      if (result.diff.missing_normalize_heading_anchors.length > 0) {
        console.log(`    missing normalize headings: ${result.diff.missing_normalize_heading_anchors.length}`);
      }
      if (result.diff.missing_normalize_paragraph_anchors.length > 0) {
        console.log(`    missing normalize paragraphs: ${result.diff.missing_normalize_paragraph_anchors.length}`);
      }
      if (result.diff.missing_normalize_paragraph_end_anchors.length > 0) {
        console.log(`    missing normalize paragraph-end anchors: ${result.diff.missing_normalize_paragraph_end_anchors.length}`);
      }
    }
    if (report.skipped_missing_source.length > 0) {
      console.log('\nSkipped recipes (source not cached):');
      for (const skipped of report.skipped_missing_source) {
        console.log(`- ${skipped.recipe_id}: ${skipped.source_path}`);
      }
      console.log('Tip: re-run with --download to fetch source documents before canary checks.');
    }
  }

  const hasFailures = report.checked.some((entry) => !entry.ok);
  const missingIsError = args.strictMissing && report.skipped_missing_source.length > 0;
  if (hasFailures || missingIsError) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`source_drift_canary failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

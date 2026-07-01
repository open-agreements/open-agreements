import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadFieldSelectorMetadata, loadNormalizeConfig } from '../dist/core/metadata.js';
import { ensureSourceDocx } from '../dist/core/field-selector/downloader.js';
import { checkFieldSelectorSourceDrift, checkSelectorDrift } from '../dist/core/field-selector/source-drift.js';
import { loadSelectorContracts } from '../dist/core/selectors/index.js';

function parseArgs(argv) {
  const parsed = {
    fieldSelectorIds: [],
    download: false,
    strictMissing: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--fieldSelector' || arg === '-r') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --fieldSelector');
      }
      parsed.fieldSelectorIds.push(next);
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
      'Checks fieldSelector source hash + structural anchor drift against metadata/replacements/normalize config.',
      '',
      'Options:',
      '  -r, --fieldSelector <id>    Check only one fieldSelector (repeatable)',
      '      --download       Download source docx if cache is missing',
      '      --strict-missing Fail when source cache is missing',
      '      --json           Print full JSON report',
      '  -h, --help           Show help',
    ].join('\n')
  );
}

function listFieldSelectorIds(fieldSelectorsRoot) {
  return readdirSync(fieldSelectorsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function getCachedSourcePath(fieldSelectorId) {
  return join(homedir(), '.open-agreements', 'cache', fieldSelectorId, 'source.docx');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const root = process.cwd();
  const fieldSelectorsRoot = join(root, 'field-selectors');
  const fieldSelectorIds = args.fieldSelectorIds.length > 0 ? args.fieldSelectorIds : listFieldSelectorIds(fieldSelectorsRoot);

  const report = {
    generated_at: new Date().toISOString(),
    checked: [],
    skipped_missing_source: [],
  };

  for (const fieldSelectorId of fieldSelectorIds) {
    const fieldSelectorDir = join(fieldSelectorsRoot, fieldSelectorId);
    const metadata = loadFieldSelectorMetadata(fieldSelectorDir);
    const normalizeConfig = loadNormalizeConfig(fieldSelectorDir);
    const replacementsPath = join(fieldSelectorDir, 'replacements.json');
    const replacements = existsSync(replacementsPath)
      ? JSON.parse(readFileSync(replacementsPath, 'utf-8'))
      : {};

    let sourcePath = getCachedSourcePath(fieldSelectorId);
    if (!existsSync(sourcePath) && args.download) {
      sourcePath = await ensureSourceDocx(fieldSelectorId, metadata);
    }

    if (!existsSync(sourcePath)) {
      report.skipped_missing_source.push({
        field_selector_id: fieldSelectorId,
        source_path: sourcePath,
      });
      continue;
    }

    // Selector-contract drift: resolve each field's occurrence locators against
    // the source DOCX via safe-docx; any unresolved occurrence / failed assertion
    // is upstream-form drift and FAILs the canary.
    const { manifests } = loadSelectorContracts(
      fieldSelectorDir,
      metadata.fields.map((f) => f.name),
    );
    const selectorDrift = await checkSelectorDrift(sourcePath, manifests);

    const result = checkFieldSelectorSourceDrift({
      fieldSelectorId,
      sourcePath,
      metadata,
      replacements,
      normalizeConfig,
      selectorDrift,
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
      console.log(`- ${status} ${result.field_selector_id}`);
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
      if (result.diff.unresolved_selector_fields.length > 0) {
        console.log(`    unresolved selector fields: ${result.diff.unresolved_selector_fields.join(', ')}`);
      }
      if (result.diff.assertion_failures.length > 0) {
        console.log(`    selector assertion failures: ${result.diff.assertion_failures.length}`);
      }
      if (result.diff.missing_normalize_paragraph_end_anchors.length > 0) {
        console.log(`    missing normalize paragraph-end anchors: ${result.diff.missing_normalize_paragraph_end_anchors.length}`);
      }
    }
    if (report.skipped_missing_source.length > 0) {
      console.log('\nSkipped fieldSelectors (source not cached):');
      for (const skipped of report.skipped_missing_source) {
        console.log(`- ${skipped.field_selector_id}: ${skipped.source_path}`);
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

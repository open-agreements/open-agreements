import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runFill } from '../commands/fill.js';
import { runValidate } from '../commands/validate.js';
import { runList } from '../commands/list.js';
import { runRecipeCommand, runRecipeClean, runRecipePatch } from '../commands/recipe.js';
import { runScan } from '../commands/scan.js';
import {
  runChecklistCreate,
  runChecklistRender,
  runChecklistPatchValidate,
  runChecklistPatchApply,
} from '../commands/checklist.js';
import { type MemoFormat } from '../core/employment/memo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

export function createProgram(): Command {
  const program = new Command();
  program
    .name('open-agreements')
    .description('Open-source legal template and recipe filling CLI')
    .version(pkg.version);

  // --- Fill command ---

  const fillCmd = new Command('fill');
  fillCmd
    .description('Fill a template with provided values and render a DOCX file')
    .argument('<template>', 'Template name to fill')
    .option('-o, --output <path>', 'Output file path')
    .option('-d, --data <json-file>', 'JSON file with field values')
    .option('--set <key=value...>', 'Set a field value (repeatable)')
    .option('--memo [format]', 'Generate memo artifact(s): json, markdown, or both (default: both)')
    .option('--memo-json <path>', 'Output path for memo JSON')
    .option('--memo-md <path>', 'Output path for memo Markdown')
    .option('--memo-jurisdiction <name>', 'Jurisdiction override used for memo warning rules')
    .option('--memo-baseline <template-id>', 'Baseline template id for deterministic variance checks')
    .action(async (
      template: string,
      opts: {
        output?: string;
        data?: string;
        set?: string[];
        memo?: string | boolean;
        memoJson?: string;
        memoMd?: string;
        memoJurisdiction?: string;
        memoBaseline?: string;
      }
    ) => {
      let values: Record<string, string> = {};

      if (opts.data) {
        values = JSON.parse(readFileSync(opts.data, 'utf-8'));
      }

      for (const pair of opts.set ?? []) {
        const eq = pair.indexOf('=');
        if (eq < 1) throw new Error(`Invalid --set format: "${pair}" (expected key=value)`);
        values[pair.slice(0, eq)] = pair.slice(eq + 1);
      }

      await runFill({
        template,
        output: opts.output,
        values,
        memo: buildMemoArgs(opts),
      });
    });

  program.addCommand(fillCmd);

  // --- Validate command ---

  program
    .command('validate [template]')
    .description('Run validation pipeline on all templates and recipes')
    .option('--strict', 'Treat warnings (scaffolds, missing files) as errors')
    .action((template: string | undefined, opts: { strict?: boolean }) => {
      runValidate({ template, strict: opts.strict });
    });

  // --- List command ---

  program
    .command('list')
    .description('Show all available agreements (templates, external, and recipes)')
    .option('--json', 'Output machine-readable JSON with full field definitions')
    .option('--json-strict', 'Like --json but exit non-zero if any metadata fails')
    .option('--templates-only', 'List only bundled templates (exclude external and recipes)')
    .action((opts: { json?: boolean; jsonStrict?: boolean; templatesOnly?: boolean }) => {
      runList({ json: opts.json, jsonStrict: opts.jsonStrict, templatesOnly: opts.templatesOnly });
    });

  // --- Recipe command ---

  const recipeCmd = new Command('recipe');
  recipeCmd.description('Work with recipe-based document pipelines');

  recipeCmd
    .command('run <recipe-id>')
    .description('Run the full recipe pipeline (clean → patch → fill → verify)')
    .option('-i, --input <path>', 'Source DOCX file (auto-downloads if omitted)')
    .option('-o, --output <path>', 'Output file path')
    .option('-d, --data <json-file>', 'JSON file with field values')
    .option('--keep-intermediate', 'Preserve intermediate files')
    .option('--computed-out <path>', 'Write computed interaction artifact JSON')
    .option('--no-normalize-brackets', 'Disable post-fill bracket artifact normalization')
    .action(async (recipeId: string, opts: { input?: string; output?: string; data?: string; keepIntermediate?: boolean; computedOut?: string; normalizeBrackets?: boolean }) => {
      await runRecipeCommand({
        recipeId,
        input: opts.input,
        output: opts.output,
        data: opts.data,
        keepIntermediate: opts.keepIntermediate,
        computedOut: opts.computedOut,
        normalizeBrackets: opts.normalizeBrackets,
      });
    });

  recipeCmd
    .command('clean <input>')
    .description('Run only the clean stage of a recipe')
    .requiredOption('-o, --output <path>', 'Output file path')
    .requiredOption('--recipe <id>', 'Recipe ID to use for clean config')
    .option('--extract-guidance <path>', 'Extract removed content as guidance JSON to the specified path')
    .action(async (input: string, opts: { output: string; recipe: string; extractGuidance?: string }) => {
      await runRecipeClean({ input, output: opts.output, recipe: opts.recipe, extractGuidance: opts.extractGuidance });
    });

  recipeCmd
    .command('patch <input>')
    .description('Run only the patch stage of a recipe')
    .requiredOption('-o, --output <path>', 'Output file path')
    .requiredOption('--recipe <id>', 'Recipe ID to use for replacements')
    .action(async (input: string, opts: { output: string; recipe: string }) => {
      await runRecipePatch({ input, output: opts.output, recipe: opts.recipe });
    });

  program.addCommand(recipeCmd);

  // --- Scan command ---

  program
    .command('scan <input>')
    .description('Scan a DOCX file for bracketed placeholders')
    .option('--output-replacements <path>', 'Write a draft replacements.json')
    .action((input: string, opts: { outputReplacements?: string }) => {
      runScan({ input, outputReplacements: opts.outputReplacements });
    });

  // --- Checklist command ---

  const checklistCmd = new Command('checklist');
  checklistCmd.description('Work with closing checklists');

  checklistCmd
    .command('create')
    .description('Create a closing checklist DOCX from JSON data')
    .requiredOption('-d, --data <json-file>', 'JSON file with checklist data')
    .option('-o, --output <path>', 'Output file path (default: closing-checklist.docx)')
    .action(async (opts: { data: string; output?: string }) => {
      await runChecklistCreate({ data: opts.data, output: opts.output });
    });

  checklistCmd
    .command('render')
    .description('Render a closing checklist as Markdown from JSON data')
    .requiredOption('-d, --data <json-file>', 'JSON file with checklist data')
    .option('-o, --output <path>', 'Output Markdown file path (prints to stdout if omitted)')
    .action(async (opts: { data: string; output?: string }) => {
      await runChecklistRender({ data: opts.data, output: opts.output });
    });

  checklistCmd
    .command('patch-validate')
    .description('Validate a checklist patch against checklist state (dry run, no mutation)')
    .requiredOption('--state <json-file>', 'Checklist state JSON ({ checklist_id, revision, checklist })')
    .requiredOption('--patch <json-file>', 'Patch envelope JSON file')
    .option('-o, --output <json-file>', 'Output JSON path for validation result')
    .option('--validation-store <json-file>', 'Persist validation artifacts to this JSON file')
    .action(async (
      opts: {
        state: string;
        patch: string;
        output?: string;
        validationStore?: string;
      }
    ) => {
      await runChecklistPatchValidate({
        state: opts.state,
        patch: opts.patch,
        output: opts.output,
        validationStore: opts.validationStore,
      });
    });

  checklistCmd
    .command('patch-apply')
    .description('Apply a previously validated checklist patch to checklist state')
    .requiredOption('--state <json-file>', 'Checklist state JSON ({ checklist_id, revision, checklist })')
    .requiredOption('--request <json-file>', 'Patch apply request JSON ({ validation_id, patch })')
    .option('-o, --output <json-file>', 'Output JSON path for apply result')
    .option('--validation-store <json-file>', 'Validation artifact JSON store (must match validate step)')
    .option('--applied-store <json-file>', 'Applied patch JSON store (for idempotency + patch_id conflicts)')
    .option('--proposed-store <json-file>', 'Proposed patch JSON store (for mode=PROPOSED)')
    .action(async (
      opts: {
        state: string;
        request: string;
        output?: string;
        validationStore?: string;
        appliedStore?: string;
        proposedStore?: string;
      }
    ) => {
      await runChecklistPatchApply({
        state: opts.state,
        request: opts.request,
        output: opts.output,
        validationStore: opts.validationStore,
        appliedStore: opts.appliedStore,
        proposedStore: opts.proposedStore,
      });
    });

  program.addCommand(checklistCmd);

  return program;
}

function buildMemoArgs(opts: {
  memo?: string | boolean;
  memoJson?: string;
  memoMd?: string;
  memoJurisdiction?: string;
  memoBaseline?: string;
}): {
  enabled: boolean;
  format: MemoFormat;
  jsonOutputPath?: string;
  markdownOutputPath?: string;
  jurisdiction?: string;
  baselineTemplateId?: string;
} | undefined {
  const hasMemoRelatedFlag = Boolean(
    opts.memo !== undefined
    || opts.memoJson
    || opts.memoMd
    || opts.memoJurisdiction
    || opts.memoBaseline
  );

  if (!hasMemoRelatedFlag) {
    return undefined;
  }

  let format: MemoFormat = 'both';
  if (typeof opts.memo === 'string') {
    if (opts.memo !== 'json' && opts.memo !== 'markdown' && opts.memo !== 'both') {
      throw new Error(`Invalid --memo format: "${opts.memo}" (expected json, markdown, or both)`);
    }
    format = opts.memo;
  }

  return {
    enabled: true,
    format,
    jsonOutputPath: opts.memoJson,
    markdownOutputPath: opts.memoMd,
    jurisdiction: opts.memoJurisdiction,
    baselineTemplateId: opts.memoBaseline,
  };
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await runCli(process.argv);
}

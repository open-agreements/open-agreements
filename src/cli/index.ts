import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFill } from '../commands/fill.js';
import { runValidate } from '../commands/validate.js';
import { runList } from '../commands/list.js';
import { runRecipeCommand, runRecipeClean, runRecipePatch } from '../commands/recipe.js';
import { runScan } from '../commands/scan.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

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
  .action(async (template: string, opts: { output?: string; data?: string; set?: string[] }) => {
    let values: Record<string, string> = {};

    if (opts.data) {
      values = JSON.parse(readFileSync(opts.data, 'utf-8'));
    }

    for (const pair of opts.set ?? []) {
      const eq = pair.indexOf('=');
      if (eq < 1) throw new Error(`Invalid --set format: "${pair}" (expected key=value)`);
      values[pair.slice(0, eq)] = pair.slice(eq + 1);
    }

    await runFill({ template, output: opts.output, values });
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
  .action(async (recipeId: string, opts: { input?: string; output?: string; data?: string; keepIntermediate?: boolean }) => {
    await runRecipeCommand({
      recipeId,
      input: opts.input,
      output: opts.output,
      data: opts.data,
      keepIntermediate: opts.keepIntermediate,
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

program.parse();

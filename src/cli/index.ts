import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFill } from '../commands/fill.js';
import { runValidate } from '../commands/validate.js';
import { runList } from '../commands/list.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('open-agreements')
  .description('Open-source legal template filling CLI')
  .version(pkg.version);

const fillCmd = new Command('fill');
fillCmd
  .description('Fill a template with provided values and render a DOCX file')
  .argument('<template>', 'Template name to fill')
  .option('-o, --output <path>', 'Output file path')
  .option('-d, --data <json-file>', 'JSON file with field values')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async (template: string, opts: { output?: string; data?: string }) => {
    let values: Record<string, string> = {};

    if (opts.data) {
      values = JSON.parse(readFileSync(opts.data, 'utf-8'));
    }

    // Also parse --field_name "value" pairs from raw argv
    const rawArgs = fillCmd.args.slice(1); // skip template name
    const parseArgs = process.argv.slice(process.argv.indexOf(template) + 1);
    for (let i = 0; i < parseArgs.length; i++) {
      const arg = parseArgs[i];
      if (arg === '-o' || arg === '--output' || arg === '-d' || arg === '--data') {
        i++; // skip known options and their values
        continue;
      }
      if (arg.startsWith('--') && i + 1 < parseArgs.length) {
        const key = arg.slice(2).replace(/-/g, '_');
        values[key] = parseArgs[i + 1];
        i++;
      }
    }

    await runFill({ template, output: opts.output, values });
  });

program.addCommand(fillCmd);

program
  .command('validate [template]')
  .description('Run validation pipeline on one or all templates')
  .action((template?: string) => {
    runValidate({ template });
  });

program
  .command('list')
  .description('Show available templates with license info')
  .action(() => {
    runList();
  });

program.parse();

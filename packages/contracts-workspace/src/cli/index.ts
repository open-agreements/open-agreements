import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerInitCommand } from '../commands/init.js';
import { registerCatalogCommand } from '../commands/catalog.js';
import { registerStatusCommand } from '../commands/status.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')) as {
  version: string;
};

const program = new Command();
program
  .name('open-agreements-workspace')
  .description('Initialize and manage lifecycle-first contract workspaces')
  .version(pkg.version);

registerInitCommand(program);
registerCatalogCommand(program);
registerStatusCommand(program);

program.parse();

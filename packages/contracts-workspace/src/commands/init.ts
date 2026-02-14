import { resolve } from 'node:path';
import type { Command } from 'commander';
import { planWorkspaceInitialization } from '../core/workspace-structure.js';
import type { AgentName } from '../core/types.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Preview topic-first contracts workspace structure and suggested setup actions')
    .option('--agents <agents>', 'Comma-separated agent setup snippets to generate (claude,gemini)')
    .option('--topics <topics>', 'Comma-separated top-level topic folders to suggest')
    .action((opts: { agents?: string; topics?: string }) => {
      const rootDir = process.cwd();
      const agents = parseAgents(opts.agents);
      const topics = parseCsv(opts.topics);

      const result = planWorkspaceInitialization(rootDir, {
        agents,
        topics: topics.length > 0 ? topics : undefined,
      });

      console.log(`Workspace initialization preview for ${resolve(rootDir)}`);
      console.log('No files or directories were created.');
      console.log(`Missing directories: ${result.missingDirectories.length}`);
      console.log(`Missing files: ${result.missingFiles.length}`);

      if (result.missingDirectories.length > 0) {
        console.log('Suggested directories to create:');
        for (const directory of result.missingDirectories) {
          console.log(`- ${directory}`);
        }
      }

      if (result.missingFiles.length > 0) {
        console.log('Suggested files to create or generate:');
        for (const file of result.missingFiles) {
          console.log(`- ${file}`);
        }
      }

      if (result.agentInstructions.length > 0) {
        console.log('Agent setup snippets:');
        for (const line of result.agentInstructions) {
          console.log(`- ${line}`);
        }
      }

      console.log(`Lint findings: ${result.lint.errorCount} errors, ${result.lint.warningCount} warnings`);
      if (result.suggestedCommands.length > 0) {
        console.log('Suggested next commands:');
        for (const command of result.suggestedCommands) {
          console.log(`- ${command}`);
        }
      }

      if (result.missingDirectories.length === 0 && result.missingFiles.length === 0) {
        console.log('Workspace already matches the expected structure.');
      }
    });
}

function parseCsv(input: string | undefined): string[] {
  if (!input) {
    return [];
  }
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseAgents(input: string | undefined): AgentName[] {
  const raw = parseCsv(input).map((agent) => agent.toLowerCase());
  const supported = new Set(['claude', 'gemini']);
  const invalid = raw.filter((agent) => !supported.has(agent));
  if (invalid.length > 0) {
    throw new Error(`Unsupported agents: ${invalid.join(', ')}. Supported values: claude, gemini.`);
  }
  return raw as AgentName[];
}

import { resolve } from 'node:path';
import type { Command } from 'commander';
import { initializeWorkspace } from '../core/workspace-structure.js';
import type { AgentName } from '../core/types.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a lifecycle-first contracts workspace in the current directory')
    .option('--agents <agents>', 'Comma-separated agent setup snippets to generate (claude,gemini)')
    .option('--topics <topics>', 'Comma-separated topic folders to scaffold under forms/')
    .action((opts: { agents?: string; topics?: string }) => {
      const rootDir = process.cwd();
      const agents = parseAgents(opts.agents);
      const topics = parseCsv(opts.topics);

      const result = initializeWorkspace(rootDir, {
        agents,
        topics: topics.length > 0 ? topics : undefined,
      });

      console.log(`Initialized contracts workspace at ${resolve(rootDir)}`);
      console.log(`Created directories: ${result.createdDirectories.length}`);
      console.log(`Created files: ${result.createdFiles.length}`);
      if (result.agentInstructions.length > 0) {
        console.log('Agent setup snippets:');
        for (const line of result.agentInstructions) {
          console.log(`- ${line}`);
        }
      }
      if (result.createdDirectories.length === 0 && result.createdFiles.length === 0) {
        console.log('Workspace already initialized; no new files were created.');
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

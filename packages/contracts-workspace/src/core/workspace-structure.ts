import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dump } from 'js-yaml';
import {
  AGENT_SETUP_DIR,
  CATALOG_FILE,
  CONTRACTS_GUIDE_FILE,
  DEFAULT_FORM_TOPICS,
  LIFECYCLE_DIRS,
  type LifecycleDir,
} from './constants.js';
import { createDefaultCatalog } from './default-catalog.js';
import type { AgentName, InitWorkspaceOptions, InitWorkspaceResult } from './types.js';

export function initializeWorkspace(
  rootDir: string,
  options: InitWorkspaceOptions = {}
): InitWorkspaceResult {
  const createdDirectories: string[] = [];
  const existingDirectories: string[] = [];
  const createdFiles: string[] = [];
  const existingFiles: string[] = [];
  const agentInstructions: string[] = [];

  const topics = options.topics && options.topics.length > 0
    ? options.topics
    : [...DEFAULT_FORM_TOPICS];

  for (const lifecycle of LIFECYCLE_DIRS) {
    const path = join(rootDir, lifecycle);
    ensureDirectory(path, rootDir, createdDirectories, existingDirectories);

    if (lifecycle === 'forms') {
      for (const topic of topics) {
        const topicPath = join(path, topic);
        ensureDirectory(topicPath, rootDir, createdDirectories, existingDirectories);
      }
    }
  }

  const contractsGuidePath = join(rootDir, CONTRACTS_GUIDE_FILE);
  ensureFile(
    contractsGuidePath,
    buildContractsGuide(topics),
    rootDir,
    createdFiles,
    existingFiles
  );

  const catalogFilePath = join(rootDir, CATALOG_FILE);
  ensureFile(
    catalogFilePath,
    dump(createDefaultCatalog(), {
      noRefs: true,
      lineWidth: 120,
      sortKeys: false,
    }),
    rootDir,
    createdFiles,
    existingFiles
  );

  const agents = normalizeAgents(options.agents);
  if (agents.length > 0) {
    const agentSetupRoot = join(rootDir, AGENT_SETUP_DIR);
    ensureDirectory(agentSetupRoot, rootDir, createdDirectories, existingDirectories);

    for (const agent of agents) {
      const snippetPath = join(agentSetupRoot, `${agent}.md`);
      ensureFile(
        snippetPath,
        buildAgentSnippet(agent),
        rootDir,
        createdFiles,
        existingFiles
      );
      agentInstructions.push(
        `${agent}: ${relative(rootDir, snippetPath)} references ${CONTRACTS_GUIDE_FILE}`
      );
    }
  }

  return {
    rootDir,
    createdDirectories,
    existingDirectories,
    createdFiles,
    existingFiles,
    agentInstructions,
  };
}

function ensureDirectory(
  directoryPath: string,
  rootDir: string,
  createdDirectories: string[],
  existingDirectories: string[]
): void {
  const rel = relative(rootDir, directoryPath) || '.';
  if (existsSync(directoryPath)) {
    existingDirectories.push(rel);
    return;
  }

  mkdirSync(directoryPath, { recursive: true });
  createdDirectories.push(rel);
}

function ensureFile(
  filePath: string,
  content: string,
  rootDir: string,
  createdFiles: string[],
  existingFiles: string[]
): void {
  try {
    readFileSync(filePath, 'utf-8');
    existingFiles.push(relative(rootDir, filePath));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw error;
    }

    writeFileSync(filePath, content, 'utf-8');
    createdFiles.push(relative(rootDir, filePath));
  }
}

function normalizeAgents(agents: AgentName[] | undefined): AgentName[] {
  if (!agents || agents.length === 0) {
    return [];
  }

  return [...new Set(agents.filter((agent) => agent === 'claude' || agent === 'gemini'))];
}

function buildContractsGuide(topics: string[]): string {
  const lifecycleLegend = LIFECYCLE_DIRS.map((name) => `- \`${name}/\``).join('\n');
  const topicLegend = topics.map((name) => `- \`${name}\``).join('\n');

  return `# CONTRACTS.md

Shared operating rules for contract workspace automation.

## Folder Semantics

Lifecycle-first top-level folders:
${lifecycleLegend}

Use \`forms/\` for source templates and form libraries. Forms are further organized by topic:
${topicLegend}

## Naming Conventions

- Use descriptive snake_case filenames.
- Execution status is filename-driven: append \`_executed\` before the extension when signed.
- Example: \`acme_subscription_agreement_executed.docx\`.

## Status Tracking

- \`_executed\` in filename is the source of truth for signed status.
- Regenerate workspace index with:
  - \`open-agreements-workspace status generate\`
- Run validator/lint with:
  - \`open-agreements-workspace status lint\`

## Forms Catalog

- Catalog file: \`${CATALOG_FILE}\`
- Validate catalog:
  - \`open-agreements-workspace catalog validate\`
- Fetch allowed entries:
  - \`open-agreements-workspace catalog fetch\`

## AI Agent Expectations

- Always follow this file before reorganizing or renaming contract files.
- Do not move files across lifecycle folders without explicit user confirmation.
- Treat pointer-only catalog entries as references only (do not vendor restricted source documents).
`;
}

function buildAgentSnippet(agent: AgentName): string {
  const title = agent === 'claude' ? 'Claude Code' : 'Gemini CLI';

  return `# ${title} Workspace Setup

Reference file: \`CONTRACTS.md\`

## Instruction

Always read and follow \`CONTRACTS.md\` before changing files in this workspace.

## Suggested startup check

1. Confirm lifecycle folders exist: \`forms/ drafts/ incoming/ executed/ archive/\`.
2. Run \`open-agreements-workspace status lint\` before and after major file operations.
3. For form sourcing, validate and fetch from \`forms-catalog.yaml\`.
`;
}

export function inferLifecycle(relativePath: string): LifecycleDir | null {
  const normalized = relativePath.replaceAll('\\\\', '/');
  const firstSegment = normalized.split('/')[0];
  if (LIFECYCLE_DIRS.includes(firstSegment as LifecycleDir)) {
    return firstSegment as LifecycleDir;
  }
  return null;
}

import { dump } from 'js-yaml';
import {
  AGENT_SETUP_DIR,
  CATALOG_FILE,
  CONTRACTS_GUIDE_FILE,
  DEFAULT_FORM_TOPICS,
  INDEX_FILE,
  LIFECYCLE_DIRS,
  type LifecycleDir,
} from './constants.js';
import { conventionsPath, defaultConventions, writeConventions } from './convention-config.js';
import { scanExistingConventions } from './convention-scanner.js';
import { createDefaultCatalog } from './default-catalog.js';
import { createProvider } from './filesystem-provider.js';
import { buildStatusIndex, collectWorkspaceDocuments, writeStatusIndex } from './indexer.js';
import { lintWorkspace } from './lint.js';
import type { WorkspaceProvider } from './provider.js';
import type {
  AgentName,
  ConventionConfig,
  InitWorkspaceOptions,
  InitWorkspacePlanResult,
  InitWorkspaceResult,
} from './types.js';

export function initializeWorkspace(
  rootDir: string,
  options: InitWorkspaceOptions = {},
  provider?: WorkspaceProvider
): InitWorkspaceResult {
  const p = provider ?? createProvider(rootDir);
  const createdDirectories: string[] = [];
  const existingDirectories: string[] = [];
  const createdFiles: string[] = [];
  const existingFiles: string[] = [];
  const agentInstructions: string[] = [];

  const topics = options.topics && options.topics.length > 0
    ? options.topics
    : [...DEFAULT_FORM_TOPICS];

  // Detect whether directory is non-empty and scan conventions if so
  const isNonEmpty = hasExistingContent(p);
  const conventions = isNonEmpty
    ? scanExistingConventions(p)
    : defaultConventions();

  // Write conventions config
  writeConventions(p, conventions);

  // Track existing lifecycle directories but do not create them.
  // Missing directories surface as lint warnings for the LLM agent to act on.
  for (const lifecycle of LIFECYCLE_DIRS) {
    if (p.exists(lifecycle)) {
      existingDirectories.push(lifecycle);
    }
  }

  ensureFile(
    CONTRACTS_GUIDE_FILE,
    buildContractsGuide(topics),
    p,
    createdFiles,
    existingFiles
  );

  ensureFile(
    CATALOG_FILE,
    dump(createDefaultCatalog(), {
      noRefs: true,
      lineWidth: 120,
      sortKeys: false,
    }),
    p,
    createdFiles,
    existingFiles
  );

  // Generate WORKSPACE.md and FOLDER.md files
  const workspaceDocFile = conventions.documentation.root_file;
  ensureFile(
    workspaceDocFile,
    buildWorkspaceMd(conventions, LIFECYCLE_DIRS as unknown as string[]),
    p,
    createdFiles,
    existingFiles
  );

  // Write FOLDER.md only into lifecycle directories that already exist
  for (const lifecycle of LIFECYCLE_DIRS) {
    if (p.exists(lifecycle)) {
      const folderDocFile = `${lifecycle}/${conventions.documentation.folder_file}`;
      ensureFile(
        folderDocFile,
        buildFolderMd(lifecycle, conventions, true),
        p,
        createdFiles,
        existingFiles
      );
    }
  }

  const agents = normalizeAgents(options.agents);
  if (agents.length > 0) {
    ensureDirectory(AGENT_SETUP_DIR, p, createdDirectories, existingDirectories);

    for (const agent of agents) {
      const snippetRelative = `${AGENT_SETUP_DIR}/${agent}.md`;
      ensureFile(
        snippetRelative,
        buildAgentSnippet(agent),
        p,
        createdFiles,
        existingFiles
      );
      agentInstructions.push(
        `${agent}: ${snippetRelative} references ${CONTRACTS_GUIDE_FILE}`
      );
    }
  }

  // Generate status index so lint doesn't immediately warn about missing-index
  if (!p.exists(INDEX_FILE)) {
    const documents = collectWorkspaceDocuments(rootDir, p);
    const lint = lintWorkspace(rootDir, p);
    const index = buildStatusIndex(rootDir, documents, lint);
    writeStatusIndex(rootDir, index, INDEX_FILE, p);
    createdFiles.push(INDEX_FILE);
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

export function planWorkspaceInitialization(
  rootDir: string,
  options: InitWorkspaceOptions = {},
  provider?: WorkspaceProvider
): InitWorkspacePlanResult {
  const p = provider ?? createProvider(rootDir);

  const isNonEmpty = hasExistingContent(p);
  const conventions = isNonEmpty
    ? scanExistingConventions(p)
    : defaultConventions();

  const topics = resolveSuggestedTopics(options.topics, conventions);
  const agents = normalizeAgents(options.agents);

  const suggestedDirectories = dedupe([
    ...topics,
    ...(agents.length > 0 ? [AGENT_SETUP_DIR] : []),
  ]);

  const workspaceDocFile = conventions.documentation.root_file;
  const agentSnippetFiles = agents.map((agent) => `${AGENT_SETUP_DIR}/${agent}.md`);

  const suggestedFiles = dedupe([
    conventionsPath(),
    CONTRACTS_GUIDE_FILE,
    CATALOG_FILE,
    workspaceDocFile,
    ...agentSnippetFiles,
    INDEX_FILE,
  ]);

  const existingDirectories = suggestedDirectories.filter((path) => p.exists(path));
  const missingDirectories = suggestedDirectories.filter((path) => !p.exists(path));
  const existingFiles = suggestedFiles.filter((path) => p.exists(path));
  const missingFiles = suggestedFiles.filter((path) => !p.exists(path));

  const agentInstructions = agents.map(
    (agent) => `${agent}: ${AGENT_SETUP_DIR}/${agent}.md references ${CONTRACTS_GUIDE_FILE}`
  );

  const suggestedCommands = dedupe([
    ...(missingDirectories.length > 0 ? ['mkdir -p <missing-directory-paths>'] : []),
    ...(missingFiles.length > 0 ? ['Create missing workspace files from templates'] : []),
    ...(missingFiles.includes(INDEX_FILE) ? ['open-agreements-workspace status generate'] : []),
    'open-agreements-workspace status lint',
  ]);

  const lint = withoutLifecycleRootMissingWarnings(lintWorkspace(rootDir, p));

  return {
    rootDir,
    suggestedDirectories,
    existingDirectories,
    missingDirectories,
    suggestedFiles,
    existingFiles,
    missingFiles,
    agentInstructions,
    suggestedCommands,
    lint,
  };
}

function hasExistingContent(provider: WorkspaceProvider): boolean {
  try {
    const entries = provider.readdir('.');
    return entries.some((e) => !e.name.startsWith('.'));
  } catch {
    return false;
  }
}

function ensureDirectory(
  relativePath: string,
  provider: WorkspaceProvider,
  createdDirectories: string[],
  existingDirectories: string[]
): void {
  if (provider.exists(relativePath)) {
    existingDirectories.push(relativePath);
    return;
  }

  provider.mkdir(relativePath, { recursive: true });
  createdDirectories.push(relativePath);
}

function ensureFile(
  relativePath: string,
  content: string,
  provider: WorkspaceProvider,
  createdFiles: string[],
  existingFiles: string[]
): void {
  if (provider.exists(relativePath)) {
    existingFiles.push(relativePath);
    return;
  }

  provider.writeFile(relativePath, content);
  createdFiles.push(relativePath);
}

function normalizeAgents(agents: AgentName[] | undefined): AgentName[] {
  if (!agents || agents.length === 0) {
    return [];
  }

  return [...new Set(agents.filter((agent) => agent === 'claude' || agent === 'gemini'))];
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function resolveSuggestedTopics(
  requestedTopics: string[] | undefined,
  conventions: ConventionConfig
): string[] {
  if (requestedTopics && requestedTopics.length > 0) {
    return dedupe(requestedTopics);
  }

  const conventionTopics = conventions.lifecycle.applicable_domains.filter(
    (domain) => !LIFECYCLE_DIRS.includes(domain as LifecycleDir)
  );
  if (conventionTopics.length > 0) {
    return dedupe(conventionTopics);
  }

  return [];
}

function withoutLifecycleRootMissingWarnings(lint: InitWorkspacePlanResult['lint']): InitWorkspacePlanResult['lint'] {
  const findings = lint.findings.filter((finding) => finding.code !== 'missing-directory');
  return {
    findings,
    errorCount: findings.filter((finding) => finding.severity === 'error').length,
    warningCount: findings.filter((finding) => finding.severity === 'warning').length,
  };
}

export function buildWorkspaceMd(config: ConventionConfig, domains: string[]): string {
  const folderList = domains.map((d) => `- \`${d}/\` — see \`${d}/${config.documentation.folder_file}\``).join('\n');
  const marker = config.executed_marker.pattern;
  const style = config.naming.style;

  return `# Workspace Overview

This workspace is managed by contracts-workspace.

## Conventions

- **Naming style**: ${style}
- **Executed marker**: \`${marker}\` (${config.executed_marker.location})
- **Date format**: ${config.naming.date_format}

## Domain Folders

${folderList}

## Quick Reference

- Run \`open-agreements-workspace status lint\` to check workspace structure.
- Run \`open-agreements-workspace status generate\` to rebuild the index.
- Convention config: \`.contracts-workspace/conventions.yaml\`
`;
}

export function buildFolderMd(folderName: string, config: ConventionConfig, isLifecycle: boolean): string {
  const marker = config.executed_marker.pattern;

  if (isLifecycle) {
    return `# ${folderName}/

Lifecycle folder managed by contracts-workspace.

## Purpose

${lifecyclePurpose(folderName)}

## Conventions

- Naming style: ${config.naming.style}
- Executed marker: \`${marker}\`
- Files here should follow the workspace naming conventions.

## See Also

- [\`${config.documentation.root_file}\`](../${config.documentation.root_file}) — workspace overview
`;
  }

  return `# ${folderName}/

Domain folder in this workspace.

## Conventions

- Naming style: ${config.naming.style}
- Executed marker: \`${marker}\`

## See Also

- [\`${config.documentation.root_file}\`](../${config.documentation.root_file}) — workspace overview
`;
}

function lifecyclePurpose(folder: string): string {
  switch (folder) {
    case 'forms':
      return 'Source templates and form libraries, organized by topic.';
    case 'drafts':
      return 'Work-in-progress documents not yet finalized.';
    case 'incoming':
      return 'Documents received from counterparties pending review.';
    case 'executed':
      return 'Fully signed/executed agreements. Files should include the executed marker in their filename.';
    case 'archive':
      return 'Superseded or expired documents retained for reference.';
    default:
      return 'Documents in this folder.';
  }
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

import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { INDEX_FILE } from '../../../contracts-workspace/src/core/constants.js';
import { catalogPath, fetchCatalogEntries, validateCatalog } from '../../../contracts-workspace/src/core/catalog.js';
import { buildStatusIndex, collectWorkspaceDocuments, writeStatusIndex } from '../../../contracts-workspace/src/core/indexer.js';
import { lintWorkspace } from '../../../contracts-workspace/src/core/lint.js';
import { initializeWorkspace } from '../../../contracts-workspace/src/core/workspace-structure.js';

type JsonSchema = Record<string, unknown>;

export interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  structuredContent?: unknown;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  invoke: (args: unknown) => Promise<ToolCallResult>;
}

const WorkspaceInitSchema = z.object({
  root_dir: z.string().min(1).optional(),
  agents: z.array(z.enum(['claude', 'gemini'])).optional(),
  topics: z.array(z.string().min(1)).optional(),
});

const CatalogValidateSchema = z.object({
  root_dir: z.string().min(1).optional(),
  catalog_path: z.string().min(1).optional(),
});

const CatalogFetchSchema = z.object({
  root_dir: z.string().min(1).optional(),
  catalog_path: z.string().min(1).optional(),
  ids: z.array(z.string().min(1)).optional(),
});

const StatusGenerateSchema = z.object({
  root_dir: z.string().min(1).optional(),
  output_path: z.string().min(1).optional(),
});

const StatusLintSchema = z.object({
  root_dir: z.string().min(1).optional(),
});

const tools: ToolDefinition[] = [
  {
    name: 'workspace_init',
    description: 'Initialize lifecycle-first contract workspace folders and CONTRACTS.md.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Root directory to initialize. Defaults to current working directory.' },
        agents: {
          type: 'array',
          items: { type: 'string', enum: ['claude', 'gemini'] },
          description: 'Optional AI agent snippets to generate.',
        },
        topics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of forms topic folders.',
        },
      },
      additionalProperties: false,
    },
    invoke: async (args) => {
      const input = WorkspaceInitSchema.parse(args ?? {});
      const rootDir = resolveRootDir(input.root_dir);
      const result = initializeWorkspace(rootDir, {
        agents: input.agents,
        topics: input.topics,
      });
      return successResult({
        root_dir: rootDir,
        ...result,
      });
    },
  },
  {
    name: 'catalog_validate',
    description: 'Validate forms-catalog.yaml schema and entry integrity fields.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
        catalog_path: { type: 'string', description: 'Optional custom catalog path.' },
      },
      additionalProperties: false,
    },
    invoke: async (args) => {
      const input = CatalogValidateSchema.parse(args ?? {});
      const rootDir = resolveRootDir(input.root_dir);
      const filePath = resolveCatalogFilePath(rootDir, input.catalog_path);
      const validation = validateCatalog(filePath);
      if (!validation.valid) {
        return successResult({
          root_dir: rootDir,
          catalog_path: filePath,
          valid: false,
          errors: validation.errors,
        });
      }

      return successResult({
        root_dir: rootDir,
        catalog_path: filePath,
        valid: true,
        entries: validation.catalog.entries.length,
      });
    },
  },
  {
    name: 'catalog_fetch',
    description: 'Download redistributable catalog entries and verify SHA-256 checksums.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
        catalog_path: { type: 'string', description: 'Optional custom catalog path.' },
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional catalog entry IDs to fetch. Omit to fetch all entries.',
        },
      },
      additionalProperties: false,
    },
    invoke: async (args) => {
      const input = CatalogFetchSchema.parse(args ?? {});
      const rootDir = resolveRootDir(input.root_dir);
      const filePath = resolveCatalogFilePath(rootDir, input.catalog_path);
      const summary = await fetchCatalogEntries({
        rootDir,
        catalogFilePath: filePath,
        ids: input.ids,
      });

      return successResult({
        root_dir: rootDir,
        catalog_path: filePath,
        downloaded_count: summary.downloadedCount,
        pointer_only_count: summary.pointerOnlyCount,
        failed_count: summary.failedCount,
        results: summary.results,
      });
    },
  },
  {
    name: 'status_generate',
    description: 'Generate contracts-index.yaml and return lint/index summary.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
        output_path: {
          type: 'string',
          description: `Relative output path (default: ${INDEX_FILE}). Absolute paths are rejected.`,
        },
      },
      additionalProperties: false,
    },
    invoke: async (args) => {
      const input = StatusGenerateSchema.parse(args ?? {});
      const rootDir = resolveRootDir(input.root_dir);
      const outputPath = input.output_path ?? INDEX_FILE;
      if (isAbsolute(outputPath)) {
        throw new Error('status_generate output_path must be relative to root_dir.');
      }

      const documents = collectWorkspaceDocuments(rootDir);
      const firstLint = lintWorkspace(rootDir);
      const firstIndex = buildStatusIndex(rootDir, documents, firstLint);
      writeStatusIndex(rootDir, firstIndex, outputPath);

      const finalLint = lintWorkspace(rootDir);
      const finalIndex = buildStatusIndex(rootDir, documents, finalLint);
      const indexPath = writeStatusIndex(rootDir, finalIndex, outputPath);

      return successResult({
        root_dir: rootDir,
        index_path: resolve(indexPath),
        summary: finalIndex.summary,
        lint: finalIndex.lint,
      });
    },
  },
  {
    name: 'status_lint',
    description: 'Lint workspace structure and naming/index freshness rules.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
      },
      additionalProperties: false,
    },
    invoke: async (args) => {
      const input = StatusLintSchema.parse(args ?? {});
      const rootDir = resolveRootDir(input.root_dir);
      const lint = lintWorkspace(rootDir);
      return successResult({
        root_dir: rootDir,
        findings: lint.findings,
        error_count: lint.errorCount,
        warning_count: lint.warningCount,
      });
    },
  },
];

export function listToolDescriptors(): Array<{ name: string; description: string; inputSchema: JsonSchema }> {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export async function callTool(name: string, args: unknown): Promise<ToolCallResult> {
  const tool = tools.find((item) => item.name === name);
  if (!tool) {
    return errorResult(`Unknown tool: ${name}`);
  }

  try {
    return await tool.invoke(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(message);
  }
}

function resolveRootDir(rootDir: string | undefined): string {
  return resolve(rootDir ?? process.cwd());
}

function resolveCatalogFilePath(rootDir: string, catalogPathArg: string | undefined): string {
  if (!catalogPathArg) {
    return catalogPath(rootDir);
  }
  return isAbsolute(catalogPathArg) ? catalogPathArg : resolve(rootDir, catalogPathArg);
}

function successResult(payload: unknown): ToolCallResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

function errorResult(message: string): ToolCallResult {
  const payload = { error: message };
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: true,
  };
}

import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { INDEX_FILE } from '../../../contracts-workspace/src/core/constants.js';
import { catalogPath, fetchCatalogEntries, validateCatalog } from '../../../contracts-workspace/src/core/catalog.js';
import { buildStatusIndex, collectWorkspaceDocuments, writeStatusIndex } from '../../../contracts-workspace/src/core/indexer.js';
import { lintWorkspace } from '../../../contracts-workspace/src/core/lint.js';
import { planWorkspaceInitialization } from '../../../contracts-workspace/src/core/workspace-structure.js';
import { indexContract, loadSidecar, isSidecarStale, listUnindexedDocuments, detectOrphanedSidecars } from '../../../contracts-workspace/src/core/analysis-store.js';
import { enrichStatusIndex, buildAnalysisSummary } from '../../../contracts-workspace/src/core/analysis-indexer.js';
import { searchContracts, formatResultsAsMarkdown } from '../../../contracts-workspace/src/core/search-index.js';

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
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  invoke: (args: unknown) => Promise<ToolCallResult>;
}

// --- Zod schemas ---

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

const IndexContractSchema = z.object({
  root_dir: z.string().min(1).optional(),
  document_path: z.string().min(1),
  classification: z.object({
    document_type: z.string().min(1),
    raw_type: z.string().optional(),
    confidence: z.enum(['high', 'medium', 'low']),
    parties: z.array(z.string()),
    effective_date: z.string().optional(),
    expiration_date: z.string().optional(),
    governing_law: z.string().optional(),
    summary: z.string().min(1),
  }).optional(),
  extractions: z.array(z.object({
    clause: z.string().min(1),
    found: z.boolean(),
    text: z.string().optional(),
    section_reference: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
  indexed_by: z.string().min(1).optional(),
});

const GetContractIndexSchema = z.object({
  root_dir: z.string().min(1).optional(),
  document_path: z.string().min(1).optional(),
});

const ListUnindexedContractsSchema = z.object({
  root_dir: z.string().min(1).optional(),
});

const SearchContractsSchema = z.object({
  root_dir: z.string().min(1).optional(),
  query: z.string().optional(),
  document_type: z.string().optional(),
  party: z.string().optional(),
  expiring_before: z.string().optional(),
  stale: z.boolean().optional(),
  indexed: z.boolean().optional(),
  format: z.enum(['json', 'markdown']).optional(),
});

// --- Tool definitions ---

const tools: ToolDefinition[] = [
  // ========== Existing workspace tools ==========
  {
    name: 'workspace_init',
    description: 'Preview topic-first workspace setup and return missing folders/files without creating them.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Root directory to initialize. Defaults to current working directory.' },
        agents: {
          type: 'array',
          items: { type: 'string', enum: ['claude', 'gemini'] },
          description: 'Optional AI agent snippets to suggest.',
        },
        topics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of top-level topic folders to suggest.',
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = WorkspaceInitSchema.parse(args ?? {});
      const rootDir = resolveRootDir(input.root_dir);
      const result = planWorkspaceInitialization(rootDir, {
        agents: input.agents,
        topics: input.topics,
      });
      return successResult({
        root_dir: rootDir,
        mode: 'suggest-only',
        suggested_directories: result.suggestedDirectories,
        existing_directories: result.existingDirectories,
        missing_directories: result.missingDirectories,
        suggested_files: result.suggestedFiles,
        existing_files: result.existingFiles,
        missing_files: result.missingFiles,
        agent_instructions: result.agentInstructions,
        suggested_commands: result.suggestedCommands,
        lint: {
          findings: result.lint.findings,
          error_count: result.lint.errorCount,
          warning_count: result.lint.warningCount,
        },
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
    annotations: { readOnlyHint: true, destructiveHint: false },
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
    annotations: { readOnlyHint: false, destructiveHint: false },
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
    description: 'Generate contracts-index.yaml with document inventory, lint findings, and contract analysis summary.',
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
    annotations: { readOnlyHint: false, destructiveHint: false },
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
      const enrichedIndex = enrichStatusIndex(rootDir, finalIndex);
      const indexPath = writeStatusIndex(rootDir, enrichedIndex, outputPath);

      return successResult({
        root_dir: rootDir,
        index_path: resolve(indexPath),
        summary: enrichedIndex.summary,
        lint: enrichedIndex.lint,
        analysis: enrichedIndex.analysis,
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
    annotations: { readOnlyHint: true, destructiveHint: false },
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

  // ========== Contract indexing tools ==========
  {
    name: 'index_contract',
    description: 'Index a contract — store classification (type, parties, dates, summary) and/or clause extractions. Validates document_type against canonical types + custom config. Supports partial updates.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
        document_path: { type: 'string', description: 'Relative path to the document, e.g. "vendor/acme_msa.docx".' },
        classification: {
          type: 'object',
          properties: {
            document_type: { type: 'string', description: 'Contract type: nda, msa, sow, lpa, ppm, etc.' },
            raw_type: { type: 'string', description: 'Raw detected type if not in canonical list.' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            parties: { type: 'array', items: { type: 'string' } },
            effective_date: { type: 'string', description: 'ISO 8601 date.' },
            expiration_date: { type: 'string', description: 'ISO 8601 date.' },
            governing_law: { type: 'string' },
            summary: { type: 'string' },
          },
          required: ['document_type', 'confidence', 'parties', 'summary'],
        },
        extractions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              clause: { type: 'string' },
              found: { type: 'boolean' },
              text: { type: 'string' },
              section_reference: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['clause', 'found'],
          },
        },
        indexed_by: { type: 'string', description: 'Agent identifier, e.g. "claude" or "gemini".' },
      },
      required: ['document_path'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = IndexContractSchema.parse(args);
      const rootDir = resolveRootDir(input.root_dir);
      const result = indexContract(rootDir, {
        documentPath: input.document_path,
        classification: input.classification,
        extractions: input.extractions,
        indexedBy: input.indexed_by,
      });
      return successResult({
        root_dir: rootDir,
        document_path: input.document_path,
        content_hash: result.analysis.content_hash,
        indexed_at: result.analysis.indexed_at,
        ...(result.warning ? { warning: result.warning } : {}),
      });
    },
  },
  {
    name: 'get_contract_index',
    description: 'Get contract index data. With document_path: returns that document\'s sidecar + staleness. Without: returns portfolio overview (indexed/unindexed/stale/orphan counts, type distribution, expiring-soon).',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
        document_path: { type: 'string', description: 'Relative path. Omit for portfolio overview.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = GetContractIndexSchema.parse(args ?? {});
      const rootDir = resolveRootDir(input.root_dir);

      if (input.document_path) {
        // Single document mode
        const sidecar = loadSidecar(rootDir, input.document_path);
        const staleness = isSidecarStale(rootDir, input.document_path);
        return successResult({
          root_dir: rootDir,
          document_path: input.document_path,
          contract: sidecar,
          stale: staleness.stale,
          stale_reason: staleness.reason ?? null,
        });
      }

      // Portfolio overview mode
      const documents = collectWorkspaceDocuments(rootDir);
      const enrichedDocs = documents.map((doc) => ({
        ...doc,
        analyzed: false,
        stale: false,
      }));
      const summary = buildAnalysisSummary(rootDir, enrichedDocs);

      return successResult({
        root_dir: rootDir,
        indexed_count: summary.analyzed_documents,
        unindexed_count: summary.unanalyzed_documents,
        stale_count: summary.stale_documents,
        orphaned_sidecar_count: summary.orphaned_sidecars,
        by_document_type: summary.by_document_type,
        expiring_soon: summary.expiring_soon,
      });
    },
  },
  {
    name: 'list_unindexed_contracts',
    description: 'List documents needing indexing (new, content changed, or incomplete). Returns reason codes and prior metadata for subagent dispatch.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = ListUnindexedContractsSchema.parse(args ?? {});
      const rootDir = resolveRootDir(input.root_dir);
      const documents = collectWorkspaceDocuments(rootDir);
      const pending = listUnindexedDocuments(rootDir, documents);
      return successResult({
        root_dir: rootDir,
        unindexed_count: pending.length,
        total_documents: documents.length,
        documents: pending,
      });
    },
  },
  {
    name: 'search_contracts',
    description: 'Search indexed contract metadata and extracted clauses by BM25 query and/or filters. Searches summaries, parties, clause text, and governing law — not the full document text. Use format:"markdown" for copy-paste tables.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
        query: { type: 'string', description: 'BM25 full-text search query.' },
        document_type: { type: 'string', description: 'Filter by document type (nda, msa, sow, etc.).' },
        party: { type: 'string', description: 'Filter by party name (substring match).' },
        expiring_before: { type: 'string', description: 'ISO date. Return documents expiring before this date.' },
        stale: { type: 'boolean', description: 'Filter by stale status.' },
        indexed: { type: 'boolean', description: 'Filter by indexed status.' },
        format: { type: 'string', enum: ['json', 'markdown'], description: 'Output format. Default: json.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = SearchContractsSchema.parse(args ?? {});
      const rootDir = resolveRootDir(input.root_dir);

      const documents = collectWorkspaceDocuments(rootDir);
      // Only compute staleness if the caller is filtering by stale status
      const needsStale = input.stale !== undefined;
      const enrichedDocs = documents.map((doc) => {
        const sidecar = loadSidecar(rootDir, doc.path);
        const stale = needsStale && sidecar ? isSidecarStale(rootDir, doc.path).stale : false;
        return { ...doc, analyzed: !!sidecar, stale };
      });

      const results = searchContracts(rootDir, {
        query: input.query,
        document_type: input.document_type,
        party: input.party,
        expiring_before: input.expiring_before,
        stale: input.stale,
        indexed: input.indexed,
      }, enrichedDocs);

      if (input.format === 'markdown') {
        return successResult({
          root_dir: rootDir,
          match_count: results.length,
          markdown: formatResultsAsMarkdown(results),
        });
      }

      return successResult({
        root_dir: rootDir,
        match_count: results.length,
        documents: results,
      });
    },
  },
];

// --- Helpers ---

export function listToolDescriptors(): Array<{ name: string; description: string; inputSchema: JsonSchema; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean } }> {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
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

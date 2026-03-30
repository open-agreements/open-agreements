import { isAbsolute, resolve } from 'node:path';
import { load } from 'js-yaml';
import { z } from 'zod';
import { INDEX_FILE } from '../../../contracts-workspace/src/core/constants.js';
import { catalogPath, fetchCatalogEntries, validateCatalog } from '../../../contracts-workspace/src/core/catalog.js';
import { buildStatusIndex, collectWorkspaceDocuments, writeStatusIndex } from '../../../contracts-workspace/src/core/indexer.js';
import { lintWorkspace } from '../../../contracts-workspace/src/core/lint.js';
import { planWorkspaceInitialization } from '../../../contracts-workspace/src/core/workspace-structure.js';
import { saveAnalysis, loadAnalysis, isAnalysisStale, listPendingDocuments } from '../../../contracts-workspace/src/core/analysis-store.js';
import { enrichStatusIndex } from '../../../contracts-workspace/src/core/analysis-indexer.js';
import { loadConventions } from '../../../contracts-workspace/src/core/convention-config.js';
import type { StatusIndex } from '../../../contracts-workspace/src/core/types.js';

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

const SaveContractAnalysisSchema = z.object({
  root_dir: z.string().min(1).optional(),
  document_path: z.string().min(1),
  classification: z.object({
    document_type: z.string().min(1),
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
  analyzed_by: z.string().min(1).optional(),
});

const ReadContractAnalysisSchema = z.object({
  root_dir: z.string().min(1).optional(),
  document_path: z.string().min(1),
});

const ListPendingContractsSchema = z.object({
  root_dir: z.string().min(1).optional(),
});

const SearchContractsSchema = z.object({
  root_dir: z.string().min(1).optional(),
  document_type: z.string().optional(),
  party: z.string().optional(),
  expiring_before: z.string().optional(),
  stale: z.boolean().optional(),
  analyzed: z.boolean().optional(),
});

const SuggestContractRenameSchema = z.object({
  root_dir: z.string().min(1).optional(),
  document_path: z.string().min(1),
});

const tools: ToolDefinition[] = [
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
  {
    name: 'save_contract_analysis',
    description: 'Store document classification and/or clause extractions. Supports partial updates — provide only classification or only extractions to update one without overwriting the other.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
        document_path: { type: 'string', description: 'Relative path to the document, e.g. "vendor/acme_msa.docx".' },
        classification: {
          type: 'object',
          description: 'Document classification metadata.',
          properties: {
            document_type: { type: 'string', description: 'Contract type: nda, msa, sow, employment-agreement, etc.' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            parties: { type: 'array', items: { type: 'string' }, description: 'Parties to the agreement.' },
            effective_date: { type: 'string', description: 'ISO 8601 date.' },
            expiration_date: { type: 'string', description: 'ISO 8601 date.' },
            governing_law: { type: 'string', description: 'Governing law jurisdiction.' },
            summary: { type: 'string', description: 'Brief summary of the document.' },
          },
          required: ['document_type', 'confidence', 'parties', 'summary'],
        },
        extractions: {
          type: 'array',
          description: 'Extracted clause provisions.',
          items: {
            type: 'object',
            properties: {
              clause: { type: 'string', description: 'Clause identifier, e.g. "limitation-of-liability".' },
              found: { type: 'boolean' },
              text: { type: 'string', description: 'Extracted clause text.' },
              section_reference: { type: 'string', description: 'Section reference, e.g. "Section 8.2".' },
              notes: { type: 'string', description: 'Additional notes.' },
            },
            required: ['clause', 'found'],
          },
        },
        analyzed_by: { type: 'string', description: 'Agent identifier, e.g. "claude" or "gemini".' },
      },
      required: ['document_path'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = SaveContractAnalysisSchema.parse(args);
      const rootDir = resolveRootDir(input.root_dir);
      const analysis = saveAnalysis(rootDir, {
        documentPath: input.document_path,
        classification: input.classification as Parameters<typeof saveAnalysis>[1]['classification'],
        extractions: input.extractions as Parameters<typeof saveAnalysis>[1]['extractions'],
        analyzedBy: input.analyzed_by,
      });
      return successResult({
        root_dir: rootDir,
        document_path: input.document_path,
        document_id: analysis.document_id,
        content_hash: analysis.content_hash,
        analyzed_at: analysis.analyzed_at,
      });
    },
  },
  {
    name: 'read_contract_analysis',
    description: 'Retrieve stored analysis for a document, including classification, clause extractions, and staleness status.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
        document_path: { type: 'string', description: 'Relative path to the document.' },
      },
      required: ['document_path'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = ReadContractAnalysisSchema.parse(args);
      const rootDir = resolveRootDir(input.root_dir);
      const analysis = loadAnalysis(rootDir, input.document_path);
      const staleness = isAnalysisStale(rootDir, input.document_path);
      return successResult({
        root_dir: rootDir,
        document_path: input.document_path,
        analysis,
        stale: staleness.stale,
        stale_reason: staleness.reason ?? null,
      });
    },
  },
  {
    name: 'list_pending_contracts',
    description: 'List documents needing analysis (new, content changed, or incomplete classification). Returns reason codes and prior metadata for subagent dispatch.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = ListPendingContractsSchema.parse(args ?? {});
      const rootDir = resolveRootDir(input.root_dir);
      const documents = collectWorkspaceDocuments(rootDir);
      const pending = listPendingDocuments(rootDir, documents);
      return successResult({
        root_dir: rootDir,
        pending_count: pending.length,
        total_documents: documents.length,
        documents: pending,
      });
    },
  },
  {
    name: 'search_contracts',
    description: 'Search the contract portfolio with filters. Reads from contracts-index.yaml for fast retrieval. Run status_generate first to ensure the index is current.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
        document_type: { type: 'string', description: 'Filter by document type (nda, msa, sow, etc.).' },
        party: { type: 'string', description: 'Filter by party name (substring match).' },
        expiring_before: { type: 'string', description: 'ISO date. Return only documents expiring before this date.' },
        stale: { type: 'boolean', description: 'If true, return only documents with stale analyses.' },
        analyzed: { type: 'boolean', description: 'If true, only analyzed; if false, only unanalyzed.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = SearchContractsSchema.parse(args ?? {});
      const rootDir = resolveRootDir(input.root_dir);

      // Read the enriched index
      const documents = collectWorkspaceDocuments(rootDir);
      const lint = lintWorkspace(rootDir);
      const baseIndex = buildStatusIndex(rootDir, documents, lint);
      const index = enrichStatusIndex(rootDir, baseIndex);

      let results = index.documents;

      if (input.document_type) {
        results = results.filter((doc) =>
          doc.classification?.document_type === input.document_type,
        );
      }

      if (input.party) {
        const partyLower = input.party.toLowerCase();
        results = results.filter((doc) =>
          doc.classification?.parties.some((p) => p.toLowerCase().includes(partyLower)),
        );
      }

      if (input.expiring_before) {
        const cutoff = input.expiring_before;
        results = results.filter((doc) => {
          if (!doc.classification) return false;
          const analysis = loadAnalysis(rootDir, doc.path);
          return analysis?.classification?.expiration_date
            && analysis.classification.expiration_date <= cutoff;
        });
      }

      if (input.stale !== undefined) {
        results = results.filter((doc) => doc.stale === input.stale);
      }

      if (input.analyzed !== undefined) {
        results = results.filter((doc) => doc.analyzed === input.analyzed);
      }

      return successResult({
        root_dir: rootDir,
        match_count: results.length,
        documents: results,
      });
    },
  },
  {
    name: 'suggest_contract_rename',
    description: 'Suggest a standardized filename for a classified document based on its metadata and workspace naming conventions.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Workspace root. Defaults to current working directory.' },
        document_path: { type: 'string', description: 'Relative path to the document.' },
      },
      required: ['document_path'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = SuggestContractRenameSchema.parse(args);
      const rootDir = resolveRootDir(input.root_dir);
      const analysis = loadAnalysis(rootDir, input.document_path);

      if (!analysis?.classification) {
        return successResult({
          root_dir: rootDir,
          current_path: input.document_path,
          suggested_name: null,
          reason: 'Document has not been classified yet. Run save_contract_analysis first.',
        });
      }

      const classification = analysis.classification;
      const ext = input.document_path.includes('.')
        ? input.document_path.slice(input.document_path.lastIndexOf('.'))
        : '';

      // Build standardized name: {date}_{party}_{type}.{ext}
      const parts: string[] = [];
      if (classification.effective_date) {
        parts.push(classification.effective_date);
      }
      if (classification.parties.length > 0) {
        // Use first party, sanitized for filename
        const party = classification.parties[0]
          .toLowerCase()
          .replace(/[^a-z0-9]+/gu, '_')
          .replace(/_+$/u, '');
        parts.push(party);
      }
      parts.push(classification.document_type);

      const suggestedName = parts.join('_') + ext;

      return successResult({
        root_dir: rootDir,
        current_path: input.document_path,
        suggested_name: suggestedName,
        pattern_used: '{date}_{party}_{document_type}{ext}',
        reason: `Based on classification: ${classification.document_type} with ${classification.parties.join(', ')}`,
      });
    },
  },
];

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

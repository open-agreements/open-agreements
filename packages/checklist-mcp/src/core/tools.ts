import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

type JsonSchema = Record<string, unknown>;

const SCHEMA_VERSION = '2026-03-11';

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

// ---------------------------------------------------------------------------
// Module loading (same dual strategy as contract-templates-mcp)
// ---------------------------------------------------------------------------

interface RepoModules {
  createChecklist: (dealName: string, initialData?: unknown) => unknown;
  listChecklists: () => unknown;
  resolveChecklist: (id: string) => unknown;
  getChecklistState: (id: string) => unknown;
  saveChecklistState: (id: string, state: unknown) => void;
  appendHistory: (id: string, record: unknown) => void;
  validateChecklistPatch: (input: unknown) => unknown;
  applyChecklistPatch: (input: unknown) => unknown;
  buildChecklistTemplateContext: (data: unknown) => unknown;
  fillTemplate: (opts: { templateDir: string; values: Record<string, unknown>; outputPath: string }) => Promise<unknown>;
  formatChecklistDocx: (path: string) => Promise<void>;
  findTemplateDir: (id: string) => string | undefined;
  importChecklistFromDocx: (opts: unknown) => unknown;
}

let _modules: RepoModules | null = null;
let _moduleOverride: RepoModules | null | undefined = undefined;

async function importRepoModules(): Promise<RepoModules | null> {
  if (_moduleOverride !== undefined) return _moduleOverride;
  if (_modules) return _modules;

  const root = findLocalRepoRoot();
  if (root) {
    try {
      const checklistUrl = pathToFileURL(resolve(root, 'dist', 'core', 'checklist', 'index.js')).href;
      const engineUrl = pathToFileURL(resolve(root, 'dist', 'core', 'engine.js')).href;
      const pathsUrl = pathToFileURL(resolve(root, 'dist', 'utils', 'paths.js')).href;

      const [checklist, engine, paths] = await Promise.all([
        import(checklistUrl),
        import(engineUrl),
        import(pathsUrl),
      ]);

      _modules = {
        createChecklist: checklist.createChecklist,
        listChecklists: checklist.listChecklists,
        resolveChecklist: checklist.resolveChecklist,
        getChecklistState: checklist.getChecklistState,
        saveChecklistState: checklist.saveChecklistState,
        appendHistory: checklist.appendHistory,
        validateChecklistPatch: checklist.validateChecklistPatch,
        applyChecklistPatch: checklist.applyChecklistPatch,
        buildChecklistTemplateContext: checklist.buildChecklistTemplateContext,
        fillTemplate: engine.fillTemplate,
        formatChecklistDocx: checklist.formatChecklistDocx,
        findTemplateDir: paths.findTemplateDir,
        importChecklistFromDocx: checklist.importChecklistFromDocx,
      };
      return _modules;
    } catch { /* fall through */ }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('open-agreements');
    if (typeof mod.createChecklist === 'function') {
      _modules = {
        createChecklist: mod.createChecklist,
        listChecklists: mod.listChecklists,
        resolveChecklist: mod.resolveChecklist,
        getChecklistState: mod.getChecklistState,
        saveChecklistState: mod.saveChecklistState,
        appendHistory: mod.appendHistory,
        validateChecklistPatch: mod.validateChecklistPatch,
        applyChecklistPatch: mod.applyChecklistPatch,
        buildChecklistTemplateContext: mod.buildChecklistTemplateContext,
        fillTemplate: mod.fillTemplate,
        formatChecklistDocx: mod.formatChecklistDocx,
        findTemplateDir: mod.findTemplateDir,
        importChecklistFromDocx: mod.importChecklistFromDocx,
      };
      return _modules;
    }
  } catch { /* fall through */ }

  return null;
}

/** Reset cached modules — for testing only. */
export function _resetModuleCache(): void {
  _modules = null;
  _moduleOverride = undefined;
}

/** Inject module override — for testing only. */
export function _setModuleOverride(modules: RepoModules | null | undefined): void {
  _moduleOverride = modules;
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const ChecklistCreateSchema = z.object({
  deal_name: z.string().min(1),
  initial_data: z.record(z.string(), z.unknown()).optional(),
});

const ChecklistReadSchema = z.object({
  checklist_id: z.string().min(1),
});

const ChecklistPatchValidateSchema = z.object({
  checklist_id: z.string().min(1),
  patch: z.record(z.string(), z.unknown()),
});

const ChecklistPatchApplySchema = z.object({
  checklist_id: z.string().min(1),
  validation_id: z.string().min(1),
  patch: z.record(z.string(), z.unknown()),
});

const ChecklistRenderDocxSchema = z.object({
  checklist_id: z.string().min(1),
  output_path: z.string().min(1).optional(),
  return_mode: z.enum(['local_path', 'inline_base64']).optional().default('local_path'),
});

const ChecklistImportDocxSchema = z.object({
  checklist_id: z.string().min(1),
  docx_path: z.string().min(1).optional(),
  docx_base64: z.string().min(1).optional(),
  auto_apply: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const tools: ToolDefinition[] = [
  {
    name: 'checklist_create',
    description: 'Create a new closing checklist for a deal.',
    inputSchema: {
      type: 'object',
      properties: {
        deal_name: { type: 'string', description: 'Name of the deal.' },
        initial_data: { type: 'object', description: 'Optional initial checklist data.' },
      },
      required: ['deal_name'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = ChecklistCreateSchema.parse(args ?? {});
      const mod = await requireModules();
      const result = mod.createChecklist(input.deal_name, input.initial_data);
      return successResult('checklist_create', { checklist: result });
    },
  },
  {
    name: 'checklist_list',
    description: 'List all checklists.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async () => {
      const mod = await requireModules();
      const result = mod.listChecklists();
      return successResult('checklist_list', { checklists: result });
    },
  },
  {
    name: 'checklist_read',
    description: 'Read a checklist by ID, returning its full current state.',
    inputSchema: {
      type: 'object',
      properties: {
        checklist_id: { type: 'string', description: 'Checklist ID.' },
      },
      required: ['checklist_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = ChecklistReadSchema.parse(args ?? {});
      const mod = await requireModules();
      const resolved = mod.resolveChecklist(input.checklist_id);
      const state = mod.getChecklistState(input.checklist_id);
      return successResult('checklist_read', { checklist_id: input.checklist_id, resolved, state });
    },
  },
  {
    name: 'checklist_patch_validate',
    description: 'Validate a patch against a checklist without applying it.',
    inputSchema: {
      type: 'object',
      properties: {
        checklist_id: { type: 'string', description: 'Checklist ID.' },
        patch: { type: 'object', description: 'Patch envelope to validate.' },
      },
      required: ['checklist_id', 'patch'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = ChecklistPatchValidateSchema.parse(args ?? {});
      const mod = await requireModules();
      const result = mod.validateChecklistPatch({
        checklistId: input.checklist_id,
        patch: input.patch,
      });
      return successResult('checklist_patch_validate', { validation: result });
    },
  },
  {
    name: 'checklist_patch_apply',
    description: 'Apply a validated patch to a checklist.',
    inputSchema: {
      type: 'object',
      properties: {
        checklist_id: { type: 'string', description: 'Checklist ID.' },
        validation_id: { type: 'string', description: 'Validation ID from checklist_patch_validate.' },
        patch: { type: 'object', description: 'Patch envelope to apply.' },
      },
      required: ['checklist_id', 'validation_id', 'patch'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
    invoke: async (args) => {
      const input = ChecklistPatchApplySchema.parse(args ?? {});
      const mod = await requireModules();
      const result = mod.applyChecklistPatch({
        checklistId: input.checklist_id,
        validationId: input.validation_id,
        patch: input.patch,
      });
      return successResult('checklist_patch_apply', { result });
    },
  },
  {
    name: 'checklist_render_docx',
    description: 'Render a checklist as a DOCX file.',
    inputSchema: {
      type: 'object',
      properties: {
        checklist_id: { type: 'string', description: 'Checklist ID.' },
        output_path: { type: 'string', description: 'Optional output file path.' },
        return_mode: {
          type: 'string',
          enum: ['local_path', 'inline_base64'],
          description: 'Return local file path or inline base64.',
        },
      },
      required: ['checklist_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = ChecklistRenderDocxSchema.parse(args ?? {});
      const mod = await requireModules();

      const fullState = mod.getChecklistState(input.checklist_id) as Record<string, unknown> | null;
      if (!fullState) {
        return toolError('checklist_render_docx', 'CHECKLIST_NOT_FOUND', `Checklist not found: "${input.checklist_id}"`);
      }

      // getChecklistState returns { checklist_id, revision, checklist: ClosingChecklist }
      const checklist = (fullState as Record<string, unknown>).checklist as Record<string, unknown>;

      const templateDir = mod.findTemplateDir('closing-checklist');
      if (!templateDir) {
        return toolError('checklist_render_docx', 'TEMPLATE_NOT_FOUND', 'closing-checklist template not found');
      }

      const workingDir = mkdtempSync(join(tmpdir(), 'oa-checklist-mcp-'));
      const outputPath = input.output_path
        ? resolve(input.output_path)
        : resolve(workingDir, `checklist-${input.checklist_id}-${Date.now()}.docx`);

      const context = mod.buildChecklistTemplateContext(checklist);
      await mod.fillTemplate({ templateDir, values: context as Record<string, unknown>, outputPath });
      await mod.formatChecklistDocx(outputPath);

      const basePayload = {
        checklist_id: input.checklist_id,
        output_path: outputPath,
        content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        return_mode: input.return_mode,
      };

      if (input.return_mode === 'inline_base64') {
        const base64 = readFileSync(outputPath).toString('base64');
        return successResult('checklist_render_docx', { ...basePayload, inline_base64: base64 });
      }

      return successResult('checklist_render_docx', basePayload);
    },
  },
  {
    name: 'checklist_import_docx',
    description: 'Import a DOCX file and produce a patch representing changes from the canonical checklist.',
    inputSchema: {
      type: 'object',
      properties: {
        checklist_id: { type: 'string', description: 'Checklist ID.' },
        docx_path: { type: 'string', description: 'Path to DOCX file to import.' },
        docx_base64: { type: 'string', description: 'Base64-encoded DOCX content.' },
        auto_apply: { type: 'boolean', description: 'Automatically validate and apply the patch.' },
      },
      required: ['checklist_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = ChecklistImportDocxSchema.parse(args ?? {});
      const mod = await requireModules();

      if (!input.docx_path && !input.docx_base64) {
        return toolError('checklist_import_docx', 'INVALID_ARGUMENT', 'Either docx_path or docx_base64 is required');
      }

      let docxBuffer: Buffer;
      if (input.docx_path) {
        docxBuffer = readFileSync(resolve(input.docx_path));
      } else {
        docxBuffer = Buffer.from(input.docx_base64!, 'base64');
      }

      const fullState = mod.getChecklistState(input.checklist_id) as Record<string, unknown> | null;
      if (!fullState) {
        return toolError('checklist_import_docx', 'CHECKLIST_NOT_FOUND', `Checklist not found: "${input.checklist_id}"`);
      }

      // getChecklistState returns { checklist_id, revision, checklist: ClosingChecklist }
      const checklist = (fullState as Record<string, unknown>).checklist as Record<string, unknown>;
      const revision = (fullState as Record<string, unknown>).revision as number ?? 0;

      const result = mod.importChecklistFromDocx({
        docxBuffer,
        canonicalChecklist: checklist,
        checklistId: input.checklist_id,
        currentRevision: revision,
      });

      return successResult('checklist_import_docx', { import_result: result });
    },
  },
];

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

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
    return toolError(name, 'INVALID_ARGUMENT', `Unknown tool: ${name}`);
  }

  try {
    return await tool.invoke(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(name, 'INTERNAL_ERROR', message);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireModules(): Promise<RepoModules> {
  const mod = await importRepoModules();
  if (!mod) {
    throw new Error('Could not load open-agreements modules. Ensure the package is built or installed.');
  }
  return mod;
}

function findLocalRepoRoot(): string | null {
  let cursor = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 12; depth += 1) {
    if (existsSync(resolve(cursor, 'bin', 'open-agreements.js'))) {
      return cursor;
    }

    const parent = resolve(cursor, '..');
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  const cwd = process.cwd();
  if (existsSync(resolve(cwd, 'bin', 'open-agreements.js'))) {
    return cwd;
  }

  return null;
}

function successResult(tool: string, data: Record<string, unknown>): ToolCallResult {
  const payload = {
    ok: true,
    tool,
    schema_version: SCHEMA_VERSION,
    data,
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

function toolError(tool: string, code: string, message: string): ToolCallResult {
  const payload = {
    ok: false,
    tool,
    schema_version: SCHEMA_VERSION,
    error: {
      code,
      message,
      retriable: false,
    },
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
    isError: true,
  };
}

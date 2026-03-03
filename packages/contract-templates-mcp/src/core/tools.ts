import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';

type JsonSchema = Record<string, unknown>;

const execFileAsync = promisify(execFile);
const SCHEMA_VERSION = '2026-02-26';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const ListTemplatesArgsSchema = z.object({
  mode: z.enum(['compact', 'full']).optional().default('full'),
});

const GetTemplateArgsSchema = z.object({
  template_id: z.string().min(1),
});

const FillTemplateArgsSchema = z.object({
  template: z.string().min(1),
  values: z.record(z.string(), z.unknown()).optional().default({}),
  output_path: z.string().min(1).optional(),
  return_mode: z.enum(['local_path', 'inline_base64']).optional().default('local_path'),
});

interface TemplateField {
  name: string;
  type: string;
  required: boolean;
  section: string | null;
  description: string;
  default: string | null;
}

interface TemplateRecord {
  name: string;
  category: string;
  description: string;
  license: string | null;
  source_url: string;
  source: string | null;
  attribution_text?: string;
  fields: TemplateField[];
}

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

// ---------------------------------------------------------------------------
// Cached module loader — resolves all needed functions once
// ---------------------------------------------------------------------------

interface RepoModules {
  listTemplateItems: (opts: { templatesOnly: boolean }) => TemplateRecord[];
  findTemplateDir: (id: string) => string | undefined;
  loadMetadata: (dir: string) => Record<string, unknown>;
  fillTemplate: (opts: { templateDir: string; values: Record<string, unknown>; outputPath: string }) => Promise<unknown>;
  categoryFromId: (id: string) => string;
  sourceName: (url: string) => string | null;
  mapFields: (fields: Record<string, unknown>[], required: string[]) => TemplateField[];
}

let _modules: RepoModules | null = null;
let _moduleOverride: RepoModules | null | undefined = undefined;

async function importRepoModules(): Promise<RepoModules | null> {
  if (_moduleOverride !== undefined) return _moduleOverride;
  if (_modules) return _modules;

  // Strategy 1: local repo dist (monorepo dev/CI)
  const root = findLocalRepoRoot();
  if (root) {
    try {
      const listingUrl = pathToFileURL(resolve(root, 'dist', 'core', 'template-listing.js')).href;
      const pathsUrl = pathToFileURL(resolve(root, 'dist', 'utils', 'paths.js')).href;
      const metadataUrl = pathToFileURL(resolve(root, 'dist', 'core', 'metadata.js')).href;
      const engineUrl = pathToFileURL(resolve(root, 'dist', 'core', 'engine.js')).href;

      const [listing, paths, metadata, engine] = await Promise.all([
        import(listingUrl),
        import(pathsUrl),
        import(metadataUrl),
        import(engineUrl),
      ]);

      _modules = {
        listTemplateItems: listing.listTemplateItems,
        findTemplateDir: paths.findTemplateDir,
        loadMetadata: metadata.loadMetadata,
        fillTemplate: engine.fillTemplate,
        categoryFromId: listing.categoryFromId,
        sourceName: listing.sourceName,
        mapFields: listing.mapFields,
      };
      return _modules;
    } catch { /* fall through */ }
  }

  // Strategy 2: npm dependency (installed package with v0.2.2+)
  /* c8 ignore start — unreachable in monorepo; covered by isolated-runtime-smoke CI */
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime guard handles older versions
    const mod: any = await import('open-agreements');
    if (typeof mod.listTemplateItems === 'function' && typeof mod.findTemplateDir === 'function') {
      _modules = {
        listTemplateItems: mod.listTemplateItems,
        findTemplateDir: mod.findTemplateDir,
        loadMetadata: mod.loadMetadata,
        fillTemplate: mod.fillTemplate,
        categoryFromId: mod.categoryFromId ?? ((id: string) => id.includes('employment') ? 'employment' : 'general'),
        sourceName: mod.sourceName ?? (() => null),
        mapFields: mod.mapFields ?? ((f: TemplateField[]) => f),
      };
      return _modules;
    }
  } catch { /* fall through */ }
  /* c8 ignore end */

  return null; // caller uses child process fallback
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

const tools: ToolDefinition[] = [
  {
    name: 'list_templates',
    description: 'List OpenAgreements templates with compact or full metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['compact', 'full'],
          description: 'Response detail mode. Defaults to "full".',
        },
      },
      additionalProperties: false,
    },
    invoke: async (args) => {
      const input = ListTemplatesArgsSchema.parse(args ?? {});
      const items = await loadTemplates();
      if (input.mode === 'compact') {
        return successResult('list_templates', {
          mode: 'compact',
          templates: items.map((item) => compactTemplate(item)),
        });
      }

      return successResult('list_templates', {
        mode: 'full',
        templates: items.map((item) => normalizeTemplate(item)),
      });
    },
  },
  {
    name: 'get_template',
    description: 'Fetch a single template definition with field metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: {
          type: 'string',
          description: 'Template ID, e.g. "common-paper-mutual-nda".',
        },
      },
      required: ['template_id'],
      additionalProperties: false,
    },
    invoke: async (args) => {
      const input = GetTemplateArgsSchema.parse(args ?? {});
      const mod = await importRepoModules();

      if (mod) {
        // O(1) direct lookup via findTemplateDir + loadMetadata
        const dir = mod.findTemplateDir(input.template_id);
        if (!dir) {
          return toolError('get_template', 'TEMPLATE_NOT_FOUND', `Template not found: "${input.template_id}"`);
        }
        try {
          const meta = mod.loadMetadata(dir);
          const template: TemplateRecord = {
            name: input.template_id,
            category: mod.categoryFromId(input.template_id),
            description: (meta.description ?? meta.name) as string,
            license: (meta.license as string) ?? null,
            source_url: meta.source_url as string,
            source: mod.sourceName(meta.source_url as string),
            attribution_text: meta.attribution_text as string | undefined,
            fields: mod.mapFields(meta.fields as Record<string, unknown>[], meta.required_fields as string[]),
          };
          return successResult('get_template', { template: normalizeTemplate(template) });
        } catch {
          return toolError('get_template', 'TEMPLATE_NOT_FOUND', `Template not found: "${input.template_id}"`);
        }
      }

      // Child process fallback — load all and filter
      const items = await loadTemplates();
      const template = items.find((item) => item.name === input.template_id);
      if (!template) {
        return toolError('get_template', 'TEMPLATE_NOT_FOUND', `Template not found: "${input.template_id}"`);
      }
      return successResult('get_template', { template: normalizeTemplate(template) });
    },
  },
  {
    name: 'fill_template',
    description: 'Fill a template using local OpenAgreements CLI and return local path or inline base64.',
    inputSchema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          description: 'Template ID, e.g. "common-paper-mutual-nda".',
        },
        values: {
          type: 'object',
          description: 'Template field values passed to the fill command.',
          additionalProperties: true,
        },
        output_path: {
          type: 'string',
          description: 'Optional output DOCX path. Defaults to a temporary location.',
        },
        return_mode: {
          type: 'string',
          enum: ['local_path', 'inline_base64'],
          description: 'Return local file path or inline base64 document data.',
        },
      },
      required: ['template'],
      additionalProperties: false,
    },
    invoke: async (args) => {
      const input = FillTemplateArgsSchema.parse(args ?? {});
      const workingDir = mkdtempSync(join(tmpdir(), 'oa-templates-mcp-'));
      const outputPath = input.output_path
        ? resolve(input.output_path)
        : resolve(workingDir, `${input.template}-${Date.now()}.docx`);

      try {
        const mod = await importRepoModules();

        if (mod) {
          // In-process fill via findTemplateDir + fillTemplate
          const dir = mod.findTemplateDir(input.template);
          if (!dir) {
            return toolError('fill_template', 'TEMPLATE_NOT_FOUND', `Unknown template: "${input.template}"`);
          }
          await mod.fillTemplate({ templateDir: dir, values: input.values, outputPath });
        } else {
          // Child process fallback
          const dataPath = join(workingDir, 'values.json');
          writeFileSync(dataPath, `${JSON.stringify(input.values, null, 2)}\n`, 'utf8');
          await runOpenAgreements(['fill', input.template, '--data', dataPath, '--output', outputPath]);
        }

        const basePayload = {
          template: input.template,
          output_path: outputPath,
          content_type: DOCX_MIME,
          return_mode: input.return_mode,
        };

        if (input.return_mode === 'inline_base64') {
          const base64 = readFileSync(outputPath).toString('base64');
          return successResult('fill_template', { ...basePayload, inline_base64: base64 });
        }

        return successResult('fill_template', basePayload);
      } catch (error) {
        const message = extractErrorMessage(error);
        const code = message.toLowerCase().includes('unknown template')
          ? 'TEMPLATE_NOT_FOUND'
          : 'FILL_FAILED';
        return toolError('fill_template', code, message);
      } finally {
        // Always clean workingDir; if output_path was provided, the output file
        // lives outside workingDir so it's safe to remove.
        rmSync(workingDir, { recursive: true, force: true });
      }
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
    return toolError(name, 'INVALID_ARGUMENT', `Unknown tool: ${name}`);
  }

  try {
    return await tool.invoke(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(name, 'INVALID_ARGUMENT', message);
  }
}

async function loadTemplates(): Promise<TemplateRecord[]> {
  const mod = await importRepoModules();
  if (mod) return mod.listTemplateItems({ templatesOnly: true });

  // Child process fallback
  const { stdout } = await runOpenAgreements(['list', '--json', '--templates-only']);
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed.items)) {
    throw new Error('Invalid list output from open-agreements command.');
  }
  return parsed.items;
}

function normalizeTemplate(template: TemplateRecord): Record<string, unknown> {
  return {
    template_id: template.name,
    name: template.name,
    category: template.category,
    description: template.description,
    license: template.license,
    source_url: template.source_url,
    source: template.source,
    attribution_text: template.attribution_text ?? null,
    fields: template.fields,
  };
}

function compactTemplate(template: TemplateRecord): Record<string, unknown> {
  return {
    template_id: template.name,
    name: template.name,
    field_count: template.fields.length,
  };
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

function resolveOpenAgreementsCommand(): { command: string; argsPrefix: string[] } {
  const localBinPath = findLocalRepoBin();
  if (localBinPath) {
    return { command: process.execPath, argsPrefix: [localBinPath] };
  }

  // In installed package usage, rely on npm/npx PATH wiring for dependency bins.
  return { command: 'open-agreements', argsPrefix: [] };
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

function findLocalRepoBin(): string | null {
  const root = findLocalRepoRoot();
  return root ? resolve(root, 'bin', 'open-agreements.js') : null;
}

async function runOpenAgreements(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const resolved = resolveOpenAgreementsCommand();
  return execFileAsync(
    resolved.command,
    [...resolved.argsPrefix, ...args],
    {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    },
  );
}

function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error);
  }

  const candidate = error as { stderr?: string; stdout?: string; message?: string };
  const stderr = candidate.stderr?.trim();
  if (stderr) return stderr;
  const stdout = candidate.stdout?.trim();
  if (stdout) return stdout;
  return candidate.message ?? String(error);
}

import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';
import { fetchSurveyEvidence, isValidTopic, surveyEvidenceUrl, SurveyFetchError } from './surveys.js';

type JsonSchema = Record<string, unknown>;

const execFileAsync = promisify(execFile);
const SCHEMA_VERSION = '2026-05-06';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const LIST_TEMPLATES_DEFAULT_LIMIT = 25;
const LIST_TEMPLATES_MAX_LIMIT = 100;

const LIST_TEMPLATES_CURSOR_MAX_LENGTH = 512;

/**
 * Unified content catalog (open-agreements#635). `template` is served from the
 * template catalog; the markdown types are served from the repository's local
 * content bundles (practice-guides/, checklists/, surveys/) via
 * src/core/content-listing.ts.
 */
const CONTENT_TYPES = ['template', 'practice_guide', 'checklist', 'survey'] as const;
type ContentType = (typeof CONTENT_TYPES)[number];
type DocContentType = Exclude<ContentType, 'template'>;
const DOC_CONTENT_TYPES: DocContentType[] = ['practice_guide', 'checklist', 'survey'];

const CONTENT_QUERY_MAX_LENGTH = 200;
const CONTENT_ID_MAX_LENGTH = 512;

const DOC_CONTENT_UNAVAILABLE_REASON =
  'Practice guides, checklists, and surveys are served from a full open-agreements repository ' +
  'checkout; they are not shipped in the npm package. Clone ' +
  'https://github.com/open-agreements/open-agreements or browse https://openagreements.org.';

const ListTemplatesArgsSchema = z
  .object({
    cursor: z.string().min(1).max(LIST_TEMPLATES_CURSOR_MAX_LENGTH).optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(LIST_TEMPLATES_MAX_LIMIT)
      .optional()
      .default(LIST_TEMPLATES_DEFAULT_LIMIT),
  })
  .strict();

class InvalidCursorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

function encodeCursor(templateId: string): string {
  return Buffer.from(`after:${templateId}`, 'utf8').toString('base64');
}

function decodeCursor(cursor: string): string {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64').toString('utf8');
  } catch {
    throw new InvalidCursorError('Invalid cursor: not base64-encoded');
  }
  const match = /^after:(.+)$/.exec(decoded);
  if (!match) {
    throw new InvalidCursorError('Invalid cursor: malformed payload');
  }
  return match[1];
}

const GetTemplateArgsSchema = z.object({
  template_id: z.string().min(1),
});

/**
 * list_content cursors bind the pagination position to the filter they were
 * issued under (type/query fingerprint). Replaying a cursor with a different
 * filter would otherwise silently skip or duplicate records, because the
 * position is lexical over the *filtered* catalog.
 */
function encodeContentCursor(contentId: string, type?: string, query?: string): string {
  return Buffer.from(
    JSON.stringify({ after: contentId, type: type ?? null, query: query ?? null }),
    'utf8',
  ).toString('base64');
}

function decodeContentCursor(cursor: string, type?: string, query?: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    throw new InvalidCursorError('Invalid cursor: malformed payload');
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new InvalidCursorError('Invalid cursor: malformed payload');
  }
  const record = parsed as { after?: unknown; type?: unknown; query?: unknown };
  if (typeof record.after !== 'string' || record.after.length === 0) {
    throw new InvalidCursorError('Invalid cursor: malformed payload');
  }
  if ((record.type ?? null) !== (type ?? null) || (record.query ?? null) !== (query ?? null)) {
    throw new InvalidCursorError(
      'Invalid cursor: issued under a different type/query filter. Restart from the first page.',
    );
  }
  return record.after;
}

// Same strict validation conventions as ListTemplatesArgsSchema.
const ListContentArgsSchema = z
  .object({
    type: z.enum(CONTENT_TYPES).optional(),
    query: z.string().min(1).max(CONTENT_QUERY_MAX_LENGTH).optional(),
    cursor: z.string().min(1).max(LIST_TEMPLATES_CURSOR_MAX_LENGTH).optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(LIST_TEMPLATES_MAX_LIMIT)
      .optional()
      .default(LIST_TEMPLATES_DEFAULT_LIMIT),
  })
  .strict();

const GetContentArgsSchema = z
  .object({
    content_id: z.string().min(1).max(CONTENT_ID_MAX_LENGTH),
  })
  .strict();

const FillTemplateArgsSchema = z.object({
  template: z.string().min(1),
  values: z.record(z.string(), z.unknown()).optional().default({}),
  output_path: z.string().min(1).optional(),
  return_mode: z.enum(['local_path', 'inline_base64']).optional().default('local_path'),
});

const GetApapTemplateArgsSchema = z.object({
  template_id: z.string().min(1),
});

const GetFormsSurveyEvidenceArgsSchema = z
  .object({
    topic: z.string().min(1).max(128),
    requirement_id: z.string().min(1).max(256).optional(),
  })
  .strict();

// Lightweight shape check on the fields this tool consumes, so upstream schema
// drift surfaces as SURVEY_FETCH_FAILED instead of a misleading tool error or
// silently empty output. resources/read still returns the raw JSON verbatim.
const SurveyEvidencePayloadSchema = z.object({
  asOf: z.string().optional(),
  sample: z.unknown().optional(),
  evidenceCellCount: z.number().int().optional(),
  requirements: z.array(z.object({ id: z.string(), label: z.string(), valueType: z.string().optional() })),
  forms: z.array(z.object({ id: z.string(), name: z.string(), sourceUrl: z.string() })),
  cells: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

const CreateApapAgreementDocxArgsSchema = z.object({
  template_id: z.string().min(1),
  agreement_data: z.record(z.string(), z.unknown()),
  output_path: z.string().min(1).optional(),
});

interface TemplateField {
  name: string;
  type: string;
  required: boolean;
  section: string | null;
  description: string;
  display_label?: string;
  default: string | null;
  default_value_rationale?: string | null;
  options?: string[];
  items?: TemplateField[];
}

/** Structured contributor provenance entry (open-agreements#533). Role set
 * mirrors the closed TemplateCreditRoleEnum in src/core/metadata.ts. */
interface TemplateCredit {
  name: string;
  role: 'drafter' | 'drafting_editor' | 'reviewer' | 'maintainer';
  profile_url?: string;
}

interface TemplateRecord {
  name: string;
  display_name?: string;
  category: string;
  description: string;
  license: string | null;
  source_url: string;
  source: string | null;
  attribution_text?: string;
  /** Maturity signal (open-agreements#243); null for templates that don't declare it. */
  stability?: string | null;
  /** Expository provenance text (open-agreements#533); null/undefined when not declared. */
  derived_from?: string | null;
  /** Structured contributor provenance (open-agreements#533); empty when not declared. */
  credits?: TemplateCredit[];
  fields: TemplateField[];
}

/** Compact doc-content entry, mirroring DocContentItem in src/core/content-listing.ts. */
interface DocContentRecord {
  content_id: string;
  type: DocContentType;
  title: string;
  description: string | null;
  topic: string;
  jurisdiction: string | null;
  format: 'markdown';
  source_url: string | null;
  updated_at: string | null;
  tags: string[];
  repo_path: string;
}

interface DocContentDetailRecord extends DocContentRecord {
  markdown: string;
}

/** Uniform compact entry returned by list_content across all content types. */
interface ContentListEntry {
  content_id: string;
  type: ContentType;
  title: string;
  description: string | null;
  topic: string;
  jurisdiction: string | null;
  format: string;
  updated_at: string | null;
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
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  invoke: (args: unknown) => Promise<ToolCallResult>;
}

// ---------------------------------------------------------------------------
// Cached module loader — resolves all needed functions once
// ---------------------------------------------------------------------------

interface RepoModules {
  listTemplateItems: () => TemplateRecord[];
  findTemplateDir: (id: string) => string | undefined;
  loadMetadata: (dir: string) => Record<string, unknown>;
  fillTemplate: (opts: { templateDir: string; values: Record<string, unknown>; outputPath: string }) => Promise<unknown>;
  categoryFromId: (id: string) => string;
  sourceName: (url: string) => string | null;
  mapFields: (fields: Record<string, unknown>[], required: string[]) => TemplateField[];
  exportTemplateToApap: (opts: {
    templateDir: string;
    concertoModelPath: string;
    concertoDependencyPaths: string[];
  }) => Record<string, unknown>;
  fillApapAgreementToDocx: (opts: {
    templateDir: string;
    agreementData: Record<string, unknown>;
    outputPath: string;
  }) => Promise<unknown>;
  // Optional — absent when the underlying open-agreements version predates
  // the unified content catalog (open-agreements#635).
  listDocContentItems?: () => DocContentRecord[];
  listDocContentTypesAvailable?: () => DocContentType[];
  findDocContentItem?: (contentId: string) => DocContentDetailRecord | undefined;
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
      const apapUrl = pathToFileURL(resolve(root, 'dist', 'core', 'apap.js')).href;
      const contentUrl = pathToFileURL(resolve(root, 'dist', 'core', 'content-listing.js')).href;

      const [listing, paths, metadata, engine, apap, content] = await Promise.all([
        import(listingUrl),
        import(pathsUrl),
        import(metadataUrl),
        import(engineUrl),
        import(apapUrl),
        // Tolerate a stale local dist built before content-listing existed.
        import(contentUrl).catch(() => null),
      ]);

      _modules = {
        listTemplateItems: listing.listTemplateItems,
        findTemplateDir: paths.findTemplateDir,
        loadMetadata: metadata.loadMetadata,
        fillTemplate: engine.fillTemplate,
        categoryFromId: listing.categoryFromId,
        sourceName: listing.sourceName,
        mapFields: listing.mapFields,
        exportTemplateToApap: apap.exportTemplateToApap,
        fillApapAgreementToDocx: apap.fillApapAgreementToDocx,
        ...(content &&
        typeof content.listDocContentItems === 'function' &&
        typeof content.listDocContentTypesAvailable === 'function' &&
        typeof content.findDocContentItem === 'function'
          ? {
              listDocContentItems: content.listDocContentItems,
              listDocContentTypesAvailable: content.listDocContentTypesAvailable,
              findDocContentItem: content.findDocContentItem,
            }
          : {}),
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
        exportTemplateToApap: mod.exportTemplateToApap,
        fillApapAgreementToDocx: mod.fillApapAgreementToDocx,
        ...(typeof mod.listDocContentItems === 'function' &&
        typeof mod.listDocContentTypesAvailable === 'function' &&
        typeof mod.findDocContentItem === 'function'
          ? {
              listDocContentItems: mod.listDocContentItems,
              listDocContentTypesAvailable: mod.listDocContentTypesAvailable,
              findDocContentItem: mod.findDocContentItem,
            }
          : {}),
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
    description:
      'List OpenAgreements templates as a paginated compact catalog. ' +
      'Returns lightweight metadata for discovery — call get_template for full per-field detail. ' +
      'Templates are returned in stable lexicographic order by template_id.',
    inputSchema: {
      type: 'object',
      properties: {
        cursor: {
          type: 'string',
          description: 'Opaque pagination cursor returned by a prior call. Omit on the first page.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: LIST_TEMPLATES_MAX_LIMIT,
          description: `Page size (default ${LIST_TEMPLATES_DEFAULT_LIMIT}, max ${LIST_TEMPLATES_MAX_LIMIT}).`,
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = ListTemplatesArgsSchema.parse(args ?? {});
      const items = await loadTemplates();

      let startIndex = 0;
      if (input.cursor !== undefined) {
        const afterId = decodeCursor(input.cursor);
        const found = items.findIndex((t) => t.name.localeCompare(afterId) > 0);
        if (found === -1) {
          throw new InvalidCursorError('Invalid cursor: points beyond catalog tail');
        }
        startIndex = found;
      }

      const page = items.slice(startIndex, startIndex + input.limit);
      const consumed = startIndex + page.length;
      const nextCursor =
        page.length > 0 && consumed < items.length ? encodeCursor(page[page.length - 1].name) : null;

      return successResult('list_templates', {
        templates: page.map((item) => compactTemplate(item)),
        total_count: items.length,
        next_cursor: nextCursor,
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
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = GetTemplateArgsSchema.parse(args ?? {});
      const template = await getTemplateRecord(input.template_id);
      if (!template) {
        return toolError('get_template', 'TEMPLATE_NOT_FOUND', `Template not found: "${input.template_id}"`);
      }
      return successResult('get_template', { template: normalizeTemplate(template) });
    },
  },
  {
    name: 'list_content',
    description:
      'List all first-class OpenAgreements content — fillable templates, practice guides, RFC 2119-style ' +
      'reviewer checklists, and law surveys — as one paginated compact catalog with stable content IDs in ' +
      'deterministic lexicographic order. Returns lightweight metadata for discovery; call get_content ' +
      '(or get_template) for the full item. Non-template content is served from a local ' +
      'open-agreements repository checkout; when it is not available in this runtime, the affected types ' +
      'are reported under unavailable_types with a reason instead of appearing as silently empty.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [...CONTENT_TYPES],
          description:
            'Optional content-type filter: "template" (fillable DOCX templates), "practice_guide" ' +
            '(source-cited legal practice guides), "checklist" (clause-by-clause reviewer checklists), ' +
            'or "survey" (state-by-state / worldwide comparison matrices). Omit for all types.',
        },
        query: {
          type: 'string',
          maxLength: CONTENT_QUERY_MAX_LENGTH,
          description:
            'Optional case-insensitive substring filter matched against content ID, title, description, and topic.',
        },
        cursor: {
          type: 'string',
          description: 'Opaque pagination cursor returned by a prior call. Omit on the first page.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: LIST_TEMPLATES_MAX_LIMIT,
          description: `Page size (default ${LIST_TEMPLATES_DEFAULT_LIMIT}, max ${LIST_TEMPLATES_MAX_LIMIT}).`,
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = ListContentArgsSchema.parse(args ?? {});
      const mod = await importRepoModules();

      const docTypesInScope: DocContentType[] =
        input.type === undefined
          ? DOC_CONTENT_TYPES
          : input.type === 'template'
            ? []
            : [input.type];

      const entries: ContentListEntry[] = [];
      if (input.type === undefined || input.type === 'template') {
        for (const template of await loadTemplates()) {
          entries.push(templateContentEntry(template));
        }
      }

      const unavailable: Array<{ type: DocContentType; reason: string }> = [];
      if (docTypesInScope.length > 0) {
        if (mod?.listDocContentItems && mod.listDocContentTypesAvailable) {
          const available = new Set(mod.listDocContentTypesAvailable());
          for (const type of docTypesInScope) {
            if (!available.has(type)) {
              unavailable.push({ type, reason: DOC_CONTENT_UNAVAILABLE_REASON });
            }
          }
          const inScope = new Set<string>(docTypesInScope);
          for (const item of mod.listDocContentItems()) {
            if (inScope.has(item.type)) {
              entries.push(docContentEntry(item));
            }
          }
        } else {
          for (const type of docTypesInScope) {
            unavailable.push({ type, reason: DOC_CONTENT_UNAVAILABLE_REASON });
          }
        }
      }

      const filtered =
        input.query === undefined ? entries : entries.filter(contentQueryMatcher(input.query));
      filtered.sort((a, b) => a.content_id.localeCompare(b.content_id));

      let startIndex = 0;
      if (input.cursor !== undefined) {
        const afterId = decodeContentCursor(input.cursor, input.type, input.query);
        const found = filtered.findIndex((entry) => entry.content_id.localeCompare(afterId) > 0);
        if (found === -1) {
          throw new InvalidCursorError('Invalid cursor: points beyond catalog tail');
        }
        startIndex = found;
      }

      const page = filtered.slice(startIndex, startIndex + input.limit);
      const consumed = startIndex + page.length;
      const nextCursor =
        page.length > 0 && consumed < filtered.length
          ? encodeContentCursor(page[page.length - 1].content_id, input.type, input.query)
          : null;

      return successResult('list_content', {
        items: page,
        total_count: filtered.length,
        next_cursor: nextCursor,
        ...(unavailable.length > 0 ? { unavailable_types: unavailable } : {}),
      });
    },
  },
  {
    name: 'get_content',
    description:
      'Fetch one OpenAgreements content item by its stable content_id (from list_content). Markdown ' +
      'content (practice guides, checklists, surveys) returns the full canonical document plus ' +
      'source/provenance metadata; template content returns the same full definition as get_template ' +
      'under a "template" key.',
    inputSchema: {
      type: 'object',
      properties: {
        content_id: {
          type: 'string',
          description:
            'Stable content ID, e.g. "template/common-paper-mutual-nda", ' +
            '"practice_guide/wage-and-hour/us", "checklist/safes/yc-post-money-safe-valuation-cap", ' +
            'or "survey/non-compete/us".',
        },
      },
      required: ['content_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = GetContentArgsSchema.parse(args ?? {});
      const slashIndex = input.content_id.indexOf('/');
      const typeToken = slashIndex === -1 ? '' : input.content_id.slice(0, slashIndex);
      const rest = slashIndex === -1 ? '' : input.content_id.slice(slashIndex + 1);

      if (!(CONTENT_TYPES as readonly string[]).includes(typeToken) || rest.length === 0) {
        return toolError(
          'get_content',
          'CONTENT_NOT_FOUND',
          `Unknown content ID: "${input.content_id}". Content IDs look like "template/<template_id>", ` +
            '"practice_guide/<topic>/<doc>", "checklist/<topic>/<doc>", or "survey/<topic>/<doc>" — ' +
            'discover them via list_content.',
        );
      }

      if (typeToken === 'template') {
        const template = await getTemplateRecord(rest);
        if (!template) {
          return toolError('get_content', 'CONTENT_NOT_FOUND', `Content not found: "${input.content_id}"`);
        }
        const compact = templateContentEntry(template);
        return successResult('get_content', {
          content: {
            ...compact,
            content_id: input.content_id,
            source_url: template.source_url ?? null,
            template: normalizeTemplate(template),
          },
        });
      }

      const mod = await importRepoModules();
      if (!mod?.findDocContentItem || !mod.listDocContentTypesAvailable) {
        return toolError('get_content', 'CONTENT_UNAVAILABLE', DOC_CONTENT_UNAVAILABLE_REASON);
      }
      // A type whose local bundle is absent in this runtime is unavailable, not
      // "not found" — mirrors list_content's unavailable_types reporting.
      if (!mod.listDocContentTypesAvailable().includes(typeToken as DocContentType)) {
        return toolError('get_content', 'CONTENT_UNAVAILABLE', DOC_CONTENT_UNAVAILABLE_REASON);
      }
      const item = mod.findDocContentItem(input.content_id);
      if (!item) {
        return toolError('get_content', 'CONTENT_NOT_FOUND', `Content not found: "${input.content_id}"`);
      }
      return successResult('get_content', {
        content: {
          content_id: item.content_id,
          type: item.type,
          title: item.title,
          description: item.description,
          topic: item.topic,
          jurisdiction: item.jurisdiction,
          format: item.format,
          updated_at: item.updated_at,
          source_url: item.source_url,
          tags: item.tags,
          repo_path: item.repo_path,
          markdown: item.markdown,
        },
      });
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
    annotations: { readOnlyHint: false, destructiveHint: false },
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
  {
    name: 'get_apap_template',
    description:
      'Export an eligible OpenAgreements-authored template as an APAP Template payload, preserving canonical source, version, license, and attribution.',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'Eligible OpenAgreements template ID.' },
      },
      required: ['template_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = GetApapTemplateArgsSchema.parse(args ?? {});
      const mod = await importRepoModules();
      if (!mod) return toolError('get_apap_template', 'APAP_UNAVAILABLE', 'APAP export requires the in-process OpenAgreements package.');
      const dir = mod.findTemplateDir(input.template_id);
      if (!dir) return toolError('get_apap_template', 'TEMPLATE_NOT_FOUND', `Template not found: "${input.template_id}"`);
      try {
        return successResult('get_apap_template', {
          template: mod.exportTemplateToApap(apapExportOptions(input.template_id, dir)),
        });
      } catch (error) {
        return toolError('get_apap_template', 'APAP_TEMPLATE_UNAVAILABLE', extractErrorMessage(error));
      }
    },
  },
  {
    name: 'create_apap_agreement_docx',
    description:
      'Render APAP Concerto agreement data for an eligible OpenAgreements template as a local DOCX. Returns a path, never inline base64.',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'Eligible OpenAgreements template ID.' },
        agreement_data: {
          type: 'object',
          description: 'APAP agreement data carrying the template Concerto $class and field values.',
          additionalProperties: true,
        },
        output_path: { type: 'string', description: 'Optional local DOCX output path.' },
      },
      required: ['template_id', 'agreement_data'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = CreateApapAgreementDocxArgsSchema.parse(args ?? {});
      const mod = await importRepoModules();
      if (!mod) return toolError('create_apap_agreement_docx', 'APAP_UNAVAILABLE', 'APAP rendering requires the in-process OpenAgreements package.');
      const dir = mod.findTemplateDir(input.template_id);
      if (!dir) return toolError('create_apap_agreement_docx', 'TEMPLATE_NOT_FOUND', `Template not found: "${input.template_id}"`);
      try {
        const template = mod.exportTemplateToApap(apapExportOptions(input.template_id, dir));
        const templateModel = template.templateModel as { typeName?: string } | undefined;
        if (input.agreement_data.$class !== templateModel?.typeName) {
          return toolError(
            'create_apap_agreement_docx',
            'INVALID_AGREEMENT_DATA',
            `agreement_data.$class must be "${templateModel?.typeName}"`,
          );
        }
        const workingDir = mkdtempSync(join(tmpdir(), 'oa-apap-mcp-'));
        const outputPath = input.output_path
          ? resolve(input.output_path)
          : resolve(workingDir, `${input.template_id}-${Date.now()}.docx`);
        await mod.fillApapAgreementToDocx({
          templateDir: dir,
          agreementData: input.agreement_data,
          outputPath,
        });
        return successResult('create_apap_agreement_docx', {
          template_id: input.template_id,
          apap_template_uri: template.uri,
          agreement_id: input.agreement_data.$identifier ?? input.agreement_data.contractId ?? null,
          output_path: outputPath,
          content_type: DOCX_MIME,
        });
      } catch (error) {
        return toolError('create_apap_agreement_docx', 'DOCX_RENDER_FAILED', extractErrorMessage(error));
      }
    },
  },
  {
    name: 'get_forms_survey_evidence',
    description:
      'Fetch evidence from a published OpenAgreements forms-provider survey (clause-by-clause market ' +
      'benchmarks of real-world forms). Without requirement_id, returns a summary: survey metadata ' +
      '(including as_of freshness), the compared requirements, and the surveyed forms — but no evidence ' +
      'cells. With requirement_id, additionally returns that one requirement\'s evidence cells across all ' +
      'surveyed forms (verbatim sentence, operative phrase, section, clause id). The complete dataset for ' +
      'each survey is also available as an MCP resource (see resources/list); large surveys approach 1 MB, ' +
      'so prefer this tool when only part of the evidence is needed. Only currently published surveys are ' +
      'reachable; the live listing is discovered from openagreements.org and never hardcoded.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Survey topic slug, e.g. "employment-offer-letter". Discover slugs via resources/list.',
        },
        requirement_id: {
          type: 'string',
          description:
            'Optional requirement id (from the summary\'s requirements list) to return that requirement\'s evidence cells.',
        },
      },
      required: ['topic'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    invoke: async (args) => {
      const input = GetFormsSurveyEvidenceArgsSchema.parse(args ?? {});

      if (!isValidTopic(input.topic)) {
        return toolError(
          'get_forms_survey_evidence',
          'SURVEY_NOT_FOUND',
          `Invalid survey topic: "${input.topic}". Topics are lowercase slugs like "employment-offer-letter".`,
        );
      }

      let result;
      try {
        result = await fetchSurveyEvidence(input.topic);
      } catch (error) {
        const message = error instanceof SurveyFetchError ? error.message : extractErrorMessage(error);
        return toolError('get_forms_survey_evidence', 'SURVEY_FETCH_FAILED', message);
      }

      if (!result.found || !result.payload) {
        return toolError(
          'get_forms_survey_evidence',
          'SURVEY_NOT_FOUND',
          `No published forms survey found for topic "${input.topic}". ` +
            'Use resources/list to discover currently published surveys.',
        );
      }

      const parsedPayload = SurveyEvidencePayloadSchema.safeParse(result.payload);
      if (!parsedPayload.success) {
        return toolError(
          'get_forms_survey_evidence',
          'SURVEY_FETCH_FAILED',
          `Survey evidence for "${input.topic}" has an unexpected shape: ${formatZodError(parsedPayload.error)}`,
        );
      }

      const payload = parsedPayload.data;
      const base = {
        topic: input.topic,
        as_of: payload.asOf ?? null,
        sample: payload.sample ?? null,
        evidence_cell_count: payload.evidenceCellCount ?? null,
        forms: payload.forms,
        resource_uri: surveyEvidenceUrl(input.topic),
      };

      if (input.requirement_id === undefined) {
        return successResult('get_forms_survey_evidence', {
          ...base,
          requirements: payload.requirements,
        });
      }

      const requirement = payload.requirements.find((item) => item.id === input.requirement_id);
      if (!requirement) {
        const available = payload.requirements.map((item) => item.id);
        return toolError(
          'get_forms_survey_evidence',
          'REQUIREMENT_NOT_FOUND',
          `Requirement "${input.requirement_id}" not found in survey "${input.topic}". ` +
            `Available requirement ids: ${available.join(', ')}`,
        );
      }

      return successResult('get_forms_survey_evidence', {
        ...base,
        requirement,
        cells: payload.cells?.[input.requirement_id] ?? {},
      });
    },
  },
];

function apapExportOptions(templateId: string, templateDir: string): {
  templateDir: string;
  concertoModelPath: string;
  concertoDependencyPaths: string[];
} {
  const modelByTemplate: Record<string, string> = {
    'openagreements-confidentiality-invention-assignment-agreement':
      'openagreements-employee-ip-inventions-assignment.cto',
  };
  const model = modelByTemplate[templateId];
  if (!model) throw new Error(`Template is not yet enabled for APAP export: ${templateId}`);
  const root = resolve(templateDir, '../../..');
  return {
    templateDir,
    concertoModelPath: join(root, 'concerto', model),
    concertoDependencyPaths: [join(root, 'concerto/deps/@models.accordproject.org.accordproject.contract.cto')],
  };
}

// ── Template-only exports (signing feature removed) ──

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
    if (error instanceof z.ZodError) {
      return toolError(name, 'INVALID_ARGUMENT', formatZodError(error));
    }
    if (error instanceof InvalidCursorError) {
      return toolError(name, 'INVALID_ARGUMENT', error.message);
    }
    const message = error instanceof Error ? error.message : String(error);
    return toolError(name, 'INVALID_ARGUMENT', message);
  }
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

async function loadTemplates(): Promise<TemplateRecord[]> {
  const mod = await importRepoModules();
  if (mod) return mod.listTemplateItems();

  // Child process fallback
  const { stdout } = await runOpenAgreements(['list', '--json']);
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed.items)) {
    throw new Error('Invalid list output from open-agreements command.');
  }
  return parsed.items;
}

/**
 * Load one template's full record — O(1) direct lookup in-process, full-list
 * filter in the child-process fallback. Shared by get_template and get_content.
 */
async function getTemplateRecord(templateId: string): Promise<TemplateRecord | undefined> {
  const mod = await importRepoModules();

  if (mod) {
    // O(1) direct lookup via findTemplateDir + loadMetadata
    const dir = mod.findTemplateDir(templateId);
    if (!dir) {
      return undefined;
    }
    try {
      const meta = mod.loadMetadata(dir);
      return {
        name: templateId,
        display_name: meta.name as string | undefined,
        category: mod.categoryFromId(templateId),
        description: (meta.description ?? meta.name) as string,
        license: (meta.license as string) ?? null,
        source_url: meta.source_url as string,
        source: mod.sourceName(meta.source_url as string),
        attribution_text: meta.attribution_text as string | undefined,
        stability: (meta.stability as string | undefined) ?? null,
        derived_from: (meta.derived_from as string | undefined) ?? null,
        credits: (meta.credits as TemplateCredit[] | undefined) ?? [],
        fields: mod.mapFields(meta.fields as Record<string, unknown>[], meta.priority_fields as string[]),
      };
    } catch {
      return undefined;
    }
  }

  // Child process fallback — load all and filter
  const items = await loadTemplates();
  return items.find((item) => item.name === templateId);
}

/** Map one template record into the uniform compact content-catalog entry. */
function templateContentEntry(template: TemplateRecord): ContentListEntry {
  const trimmedDisplayName = template.display_name?.trim();
  return {
    content_id: `template/${template.name}`,
    type: 'template',
    title: trimmedDisplayName && trimmedDisplayName.length > 0 ? trimmedDisplayName : template.name,
    description: template.description ?? null,
    topic: template.category,
    jurisdiction: null,
    format: 'docx_template',
    updated_at: null,
  };
}

/** Map one markdown doc item into the uniform compact content-catalog entry. */
function docContentEntry(item: DocContentRecord): ContentListEntry {
  return {
    content_id: item.content_id,
    type: item.type,
    title: item.title,
    description: item.description,
    topic: item.topic,
    jurisdiction: item.jurisdiction,
    format: item.format,
    updated_at: item.updated_at,
  };
}

/** Case-insensitive substring match on the compact discovery fields. */
function contentQueryMatcher(query: string): (entry: ContentListEntry) => boolean {
  const needle = query.toLowerCase();
  return (entry) =>
    entry.content_id.toLowerCase().includes(needle) ||
    entry.title.toLowerCase().includes(needle) ||
    (entry.description ?? '').toLowerCase().includes(needle) ||
    entry.topic.toLowerCase().includes(needle);
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
    stability: template.stability ?? null,
    // Provenance surface (open-agreements#533): expository derived_from text and
    // structured credits (role/name/profile_url) pass through un-flattened.
    derived_from: template.derived_from ?? null,
    credits: template.credits ?? [],
    fields: stripDisplayLabels(template.fields),
  };
}

function stripDisplayLabels(fields: TemplateField[]): TemplateField[] {
  return fields.map((field) => {
    const { display_label: _label, items, ...rest } = field;
    return items ? { ...rest, items: stripDisplayLabels(items) } : rest;
  });
}

// Compact list entries deliberately omit provenance (derived_from/credits) —
// they are full-detail surfaces served by get_template (open-agreements#533).
function compactTemplate(template: TemplateRecord): Record<string, unknown> {
  const trimmedDisplayName = template.display_name?.trim();
  return {
    template_id: template.name,
    display_name: trimmedDisplayName && trimmedDisplayName.length > 0 ? trimmedDisplayName : template.name,
    category: template.category,
    description: template.description,
    stability: template.stability ?? null,
    field_count: template.fields.length,
    priority_field_count: template.fields.filter((field) => field.required).length,
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

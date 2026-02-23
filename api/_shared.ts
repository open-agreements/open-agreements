/**
 * Shared business logic for A2A and MCP endpoints.
 * File starts with _ so Vercel does not create a route for it.
 */

import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Path resolution — must run before any dist/ function calls
// ---------------------------------------------------------------------------

const __shared_dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = join(__shared_dirname, '..');

process.env['OPEN_AGREEMENTS_CONTENT_ROOTS'] = PROJECT_ROOT;

// ---------------------------------------------------------------------------
// Core imports from compiled dist/
// ---------------------------------------------------------------------------

import { fillTemplate } from '../dist/core/engine.js';
import { runExternalFill } from '../dist/core/external/index.js';
import {
  ClosingChecklistSchema,
  buildChecklistTemplateContext,
} from '../dist/core/checklist/index.js';
import {
  loadMetadata,
  loadExternalMetadata,
} from '../dist/core/metadata.js';
import {
  findTemplateDir,
  findExternalDir,
  listTemplateEntries,
  listExternalEntries,
} from '../dist/utils/paths.js';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface FillResultMeta {
  template: string;
  filledFieldCount: number;
  totalFieldCount: number;
  missingFields: string[];
  license: string | null;
  attribution: string | null;
}

export interface FillSuccess {
  ok: true;
  base64: string;
  metadata: FillResultMeta;
}

export interface FillFailure {
  ok: false;
  error: string;
}

export type FillOutcome = FillSuccess | FillFailure;

export interface TemplateItem {
  name: string;
  category: string;
  description: string;
  license?: string;
  source_url: string;
  source: string | null;
  attribution_text?: string;
  fields: {
    name: string;
    type: string;
    required: boolean;
    section: string | null;
    description: string;
    default: string | null;
  }[];
}

export interface ListOutcome {
  cliVersion: string;
  items: TemplateItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryFromId(id: string): string {
  if (id.includes('employment') || id.includes('employee-ip-inventions')) {
    return 'employment';
  }
  return 'general';
}

function sourceName(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathname = parsed.pathname;
    if (host === 'github.com' && pathname.startsWith('/open-agreements/')) return 'OpenAgreements';
    const map: Record<string, string> = {
      'commonpaper.com': 'Common Paper',
      'bonterms.com': 'Bonterms',
      'ycombinator.com': 'Y Combinator',
      'bookface-static.ycombinator.com': 'Y Combinator',
      'openagreements.ai': 'OpenAgreements',
    };
    return map[host] ?? host;
  } catch {
    return null;
  }
}

function mapFields(
  fields: { name: string; type: string; section?: string; description: string; default?: string }[],
  requiredFields: string[],
) {
  const required = new Set(requiredFields);
  return fields.map((f) => ({
    name: f.name,
    type: f.type,
    required: required.has(f.name),
    section: f.section ?? null,
    description: f.description,
    default: f.default ?? null,
  }));
}

interface RawTemplateMetadata {
  name: string;
  description?: string;
  license?: string;
  source_url: string;
  attribution_text?: string;
  fields: {
    name: string;
    type: string;
    section?: string;
    description: string;
    default?: string;
  }[];
  required_fields: string[];
}

function toTemplateItem(templateId: string, meta: RawTemplateMetadata): TemplateItem {
  return {
    name: templateId,
    category: categoryFromId(templateId),
    description: meta.description ?? meta.name,
    license: meta.license,
    source_url: meta.source_url,
    source: sourceName(meta.source_url),
    attribution_text: meta.attribution_text,
    fields: mapFields(meta.fields, meta.required_fields),
  };
}

// ---------------------------------------------------------------------------
// Fill handler — protocol-agnostic
// ---------------------------------------------------------------------------

export async function handleFill(
  template: string,
  values: Record<string, unknown>,
): Promise<FillOutcome> {
  const internalDir = findTemplateDir(template);
  const externalDir = !internalDir ? findExternalDir(template) : undefined;

  if (!internalDir && !externalDir) {
    return { ok: false, error: `Unknown template: "${template}"` };
  }

  const outputPath = join('/tmp', `${template}-${randomUUID()}.docx`);

  let meta: { license?: string; attribution_text?: string; fields: { name: string }[] };
  let fieldsUsed: string[];

  if (internalDir) {
    const result = await fillTemplate({ templateDir: internalDir, values, outputPath });
    meta = result.metadata;
    fieldsUsed = result.fieldsUsed;
  } else {
    const result = await runExternalFill({ externalId: template, values, outputPath });
    meta = result.metadata;
    fieldsUsed = result.fieldsUsed;
  }

  const base64 = readFileSync(outputPath).toString('base64');
  const allFieldNames = meta.fields.map((f) => f.name);
  const providedSet = new Set(Object.keys(values));

  return {
    ok: true,
    base64,
    metadata: {
      template,
      filledFieldCount: fieldsUsed.length,
      totalFieldCount: allFieldNames.length,
      missingFields: allFieldNames.filter((n) => !providedSet.has(n)),
      license: (meta as Record<string, unknown>).license as string ?? null,
      attribution: (meta as Record<string, unknown>).attribution_text as string ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Create checklist handler — protocol-agnostic
// ---------------------------------------------------------------------------

export async function handleCreateChecklist(
  data: Record<string, unknown>,
): Promise<FillOutcome> {
  const parsed = ClosingChecklistSchema.safeParse(data);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    return { ok: false, error: `Invalid closing checklist payload: ${message}` };
  }
  return handleFill('closing-checklist', buildChecklistTemplateContext(parsed.data));
}

// ---------------------------------------------------------------------------
// List handler — protocol-agnostic
// ---------------------------------------------------------------------------

export function handleGetTemplate(templateId: string): TemplateItem | null {
  const internalDir = findTemplateDir(templateId);
  if (internalDir) {
    try {
      const meta = loadMetadata(internalDir) as RawTemplateMetadata;
      return toTemplateItem(templateId, meta);
    } catch {
      return null;
    }
  }

  const externalDir = findExternalDir(templateId);
  if (externalDir) {
    try {
      const meta = loadExternalMetadata(externalDir) as RawTemplateMetadata;
      return toTemplateItem(templateId, meta);
    } catch {
      return null;
    }
  }

  return null;
}

export function handleListTemplates(): ListOutcome {
  const items: TemplateItem[] = [];

  for (const entry of listTemplateEntries()) {
    try {
      const meta = loadMetadata(entry.dir) as RawTemplateMetadata;
      items.push(toTemplateItem(entry.id, meta));
    } catch { /* skip */ }
  }

  for (const entry of listExternalEntries()) {
    try {
      const meta = loadExternalMetadata(entry.dir) as RawTemplateMetadata;
      items.push(toTemplateItem(entry.id, meta));
    } catch { /* skip */ }
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  let cliVersion = '0.0.0';
  try {
    cliVersion = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8')).version;
  } catch { /* fallback */ }

  return { cliVersion, items };
}

// ---------------------------------------------------------------------------
// Download links — opaque signed IDs with TTL-backed artifact store
// ---------------------------------------------------------------------------

const DOWNLOAD_ID_SECRET =
  process.env['DOWNLOAD_ID_SECRET'] ??
  process.env['DOWNLOAD_TOKEN_SECRET'] ??
  process.env['VERCEL_DEPLOYMENT_ID'] ??
  'open-agreements-dev-fallback';

const DOWNLOAD_STORE_PREFIX = process.env['DOWNLOAD_STORE_PREFIX'] ?? 'oa:download:';

export const DOWNLOAD_TTL_MS = 60 * 60 * 1000; // 1 hour

function hmacSignDownloadId(rawId: string): string {
  return createHmac('sha256', DOWNLOAD_ID_SECRET).update(rawId).digest('base64url');
}

function encodeSignedDownloadId(rawId: string): string {
  return `${rawId}.${hmacSignDownloadId(rawId)}`;
}

type DownloadIdParseResult =
  | { ok: true; rawId: string }
  | { ok: false; code: 'DOWNLOAD_ID_MALFORMED' | 'DOWNLOAD_SIGNATURE_INVALID' };

function decodeSignedDownloadId(downloadId: string): DownloadIdParseResult {
  const firstDot = downloadId.indexOf('.');
  const lastDot = downloadId.lastIndexOf('.');
  if (firstDot <= 0 || firstDot !== lastDot) {
    return { ok: false, code: 'DOWNLOAD_ID_MALFORMED' };
  }

  const rawId = downloadId.slice(0, firstDot);
  const sig = downloadId.slice(firstDot + 1);

  if (!/^[a-f0-9]{32}$/.test(rawId)) {
    return { ok: false, code: 'DOWNLOAD_ID_MALFORMED' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(sig)) {
    return { ok: false, code: 'DOWNLOAD_ID_MALFORMED' };
  }

  const expected = hmacSignDownloadId(rawId);
  if (sig.length !== expected.length) {
    return { ok: false, code: 'DOWNLOAD_SIGNATURE_INVALID' };
  }
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { ok: false, code: 'DOWNLOAD_SIGNATURE_INVALID' };
    }
  } catch {
    return { ok: false, code: 'DOWNLOAD_SIGNATURE_INVALID' };
  }

  return { ok: true, rawId };
}

export interface DownloadArtifact {
  template: string;
  values: Record<string, unknown>;
  created_at_ms: number;
  expires_at_ms: number;
}

function isDownloadArtifact(value: unknown): value is DownloadArtifact {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const artifact = value as Record<string, unknown>;
  return (
    typeof artifact['template'] === 'string'
    && typeof artifact['values'] === 'object'
    && artifact['values'] !== null
    && typeof artifact['created_at_ms'] === 'number'
    && typeof artifact['expires_at_ms'] === 'number'
  );
}

export interface DownloadArtifactStore {
  set(rawId: string, artifact: DownloadArtifact): Promise<void>;
  get(rawId: string): Promise<DownloadArtifact | null>;
  delete(rawId: string): Promise<void>;
}

class InMemoryDownloadArtifactStore implements DownloadArtifactStore {
  private readonly map = new Map<string, DownloadArtifact>();

  async set(rawId: string, artifact: DownloadArtifact): Promise<void> {
    this.map.set(rawId, artifact);
  }

  async get(rawId: string): Promise<DownloadArtifact | null> {
    return this.map.get(rawId) ?? null;
  }

  async delete(rawId: string): Promise<void> {
    this.map.delete(rawId);
  }
}

class UpstashRestDownloadArtifactStore implements DownloadArtifactStore {
  constructor(
    private readonly restUrl: string,
    private readonly restToken: string,
    private readonly keyPrefix: string,
  ) {}

  private key(rawId: string): string {
    return `${this.keyPrefix}${rawId}`;
  }

  private async command<T>(argv: string[]): Promise<T | null> {
    const response = await fetch(this.restUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.restToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(argv),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Upstash command failed: HTTP ${response.status}`);
    }

    const payload = await response.json() as { result?: T | null; error?: string };
    if (payload.error) {
      throw new Error(`Upstash command failed: ${payload.error}`);
    }
    return payload.result ?? null;
  }

  async set(rawId: string, artifact: DownloadArtifact): Promise<void> {
    const ttlMs = Math.max(1, artifact.expires_at_ms - Date.now());
    await this.command<string>([
      'SET',
      this.key(rawId),
      JSON.stringify(artifact),
      'PX',
      String(ttlMs),
    ]);
  }

  async get(rawId: string): Promise<DownloadArtifact | null> {
    const encoded = await this.command<string>(['GET', this.key(rawId)]);
    if (typeof encoded !== 'string') {
      return null;
    }

    try {
      const parsed = JSON.parse(encoded) as unknown;
      return isDownloadArtifact(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async delete(rawId: string): Promise<void> {
    await this.command<number>(['DEL', this.key(rawId)]);
  }
}

let downloadArtifactStore: DownloadArtifactStore | null = null;

function configuredUpstashStore(): DownloadArtifactStore | null {
  const restUrl = process.env['KV_REST_API_URL'] ?? process.env['UPSTASH_REDIS_REST_URL'];
  const restToken = process.env['KV_REST_API_TOKEN'] ?? process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!restUrl || !restToken) {
    return null;
  }
  return new UpstashRestDownloadArtifactStore(restUrl, restToken, DOWNLOAD_STORE_PREFIX);
}

function getDownloadArtifactStore(): DownloadArtifactStore {
  if (downloadArtifactStore) {
    return downloadArtifactStore;
  }

  // Keep tests deterministic and offline even if local env has KV vars.
  if (process.env['NODE_ENV'] === 'test') {
    downloadArtifactStore = new InMemoryDownloadArtifactStore();
    return downloadArtifactStore;
  }

  downloadArtifactStore = configuredUpstashStore() ?? new InMemoryDownloadArtifactStore();
  return downloadArtifactStore;
}

export interface CreatedDownloadArtifact {
  download_id: string;
  expires_at: string;
  expires_at_ms: number;
}

export async function createDownloadArtifact(
  template: string,
  values: Record<string, unknown>,
  opts?: { ttl_ms?: number; now_ms?: number },
): Promise<CreatedDownloadArtifact> {
  const nowMs = opts?.now_ms ?? Date.now();
  const ttlMs = opts?.ttl_ms ?? DOWNLOAD_TTL_MS;
  const rawId = randomUUID().replace(/-/g, '');
  const expiresAtMs = nowMs + ttlMs;

  const artifact: DownloadArtifact = {
    template,
    values,
    created_at_ms: nowMs,
    expires_at_ms: expiresAtMs,
  };

  await getDownloadArtifactStore().set(rawId, artifact);

  return {
    download_id: encodeSignedDownloadId(rawId),
    expires_at_ms: expiresAtMs,
    expires_at: new Date(expiresAtMs).toISOString(),
  };
}

export type ResolveDownloadArtifactErrorCode =
  | 'DOWNLOAD_ID_MALFORMED'
  | 'DOWNLOAD_SIGNATURE_INVALID'
  | 'DOWNLOAD_EXPIRED'
  | 'DOWNLOAD_NOT_FOUND';

export type ResolveDownloadArtifactResult =
  | { ok: true; artifact: DownloadArtifact }
  | { ok: false; code: ResolveDownloadArtifactErrorCode };

export async function resolveDownloadArtifact(downloadId: string): Promise<ResolveDownloadArtifactResult> {
  const parsed = decodeSignedDownloadId(downloadId);
  if (!parsed.ok) {
    return { ok: false, code: parsed.code };
  }

  const store = getDownloadArtifactStore();
  const artifact = await store.get(parsed.rawId);
  if (!artifact) {
    return { ok: false, code: 'DOWNLOAD_NOT_FOUND' };
  }

  if (Date.now() > artifact.expires_at_ms) {
    try {
      await store.delete(parsed.rawId);
    } catch {
      // Best-effort cleanup; expiry check already failed.
    }
    return { ok: false, code: 'DOWNLOAD_EXPIRED' };
  }

  return { ok: true, artifact };
}

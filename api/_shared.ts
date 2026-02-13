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

// ---------------------------------------------------------------------------
// Fill handler — protocol-agnostic
// ---------------------------------------------------------------------------

export async function handleFill(
  template: string,
  values: Record<string, string>,
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
// List handler — protocol-agnostic
// ---------------------------------------------------------------------------

export function handleListTemplates(): ListOutcome {
  const items: TemplateItem[] = [];

  for (const entry of listTemplateEntries()) {
    try {
      const meta = loadMetadata(entry.dir);
      items.push({
        name: entry.id,
        category: categoryFromId(entry.id),
        description: meta.description ?? meta.name,
        license: meta.license,
        source_url: meta.source_url,
        source: sourceName(meta.source_url),
        attribution_text: meta.attribution_text,
        fields: mapFields(meta.fields, meta.required_fields),
      });
    } catch { /* skip */ }
  }

  for (const entry of listExternalEntries()) {
    try {
      const meta = loadExternalMetadata(entry.dir);
      items.push({
        name: entry.id,
        category: categoryFromId(entry.id),
        description: meta.description ?? meta.name,
        license: meta.license,
        source_url: meta.source_url,
        source: sourceName(meta.source_url),
        attribution_text: meta.attribution_text,
        fields: mapFields(meta.fields, meta.required_fields),
      });
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
// Download token — signed, stateless, expiring URLs
// ---------------------------------------------------------------------------

const TOKEN_SECRET =
  process.env['DOWNLOAD_TOKEN_SECRET'] ??
  process.env['VERCEL_DEPLOYMENT_ID'] ??
  'open-agreements-dev-fallback';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hmacSign(data: string): string {
  return createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
}

export interface DownloadPayload {
  /** template ID */
  t: string;
  /** field values */
  v: Record<string, string>;
  /** expiry (epoch ms) */
  e: number;
}

/** Create a signed download token encoding template + values + expiry. */
export function createDownloadToken(
  template: string,
  values: Record<string, string>,
): string {
  const payload: DownloadPayload = {
    t: template,
    v: values,
    e: Date.now() + TOKEN_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = hmacSign(data);
  return `${data}.${sig}`;
}

/** Parse and verify a download token. Returns null if invalid or expired. */
export function parseDownloadToken(
  token: string,
): DownloadPayload | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx < 1) return null;

  const data = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  // Verify signature
  const expected = hmacSign(data);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  // Decode payload
  let payload: DownloadPayload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }

  // Check expiry
  if (typeof payload.e !== 'number' || Date.now() > payload.e) return null;
  if (typeof payload.t !== 'string') return null;

  return payload;
}

import { createHash } from 'node:crypto';
import { basename, dirname, extname } from 'node:path';
import { dump, load } from 'js-yaml';
import { z } from 'zod';
import { CATALOG_FILE, LIFECYCLE_DIRS, type LifecycleDir } from './constants.js';
import { createProvider } from './filesystem-provider.js';
import type { WorkspaceProvider } from './provider.js';
import type { CatalogEntry, FetchSummary, FormsCatalog } from './types.js';

const LifecycleEnum = z.enum(LIFECYCLE_DIRS);

export const CatalogEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source_url: z.string().url(),
  checksum: z.object({
    sha256: z
      .string()
      .regex(/^[a-fA-F0-9]{64}$/u, 'checksum.sha256 must be a 64-character hex value'),
  }),
  license: z.object({
    type: z.string().min(1),
    redistribution: z.enum(['allowed-unmodified', 'pointer-only']),
  }),
  destination_lifecycle: LifecycleEnum.optional(),
  destination_topic: z.string().min(1).optional(),
  destination_filename: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export const FormsCatalogSchema = z.object({
  schema_version: z.literal(1),
  generated_at: z.iso.datetime().optional(),
  entries: z.array(CatalogEntrySchema),
});

export function catalogPath(rootDir: string): string {
  return `${rootDir}/${CATALOG_FILE}`;
}

export function loadCatalog(catalogRelativePath: string, provider?: WorkspaceProvider): FormsCatalog {
  if (provider) {
    const raw = provider.readTextFile(catalogRelativePath);
    const parsed = load(raw);
    return FormsCatalogSchema.parse(parsed);
  }
  // Fallback: treat as absolute path via a provider rooted at its dirname
  const p = createProvider(dirname(catalogRelativePath));
  const fileName = basename(catalogRelativePath);
  const raw = p.readTextFile(fileName);
  const parsed = load(raw);
  return FormsCatalogSchema.parse(parsed);
}

export function validateCatalog(
  catalogFilePath: string,
  provider?: WorkspaceProvider
): { valid: true; catalog: FormsCatalog } | { valid: false; errors: string[] } {
  try {
    let raw: string;
    if (provider) {
      raw = provider.readTextFile(catalogFilePath);
    } else {
      const p = createProvider(dirname(catalogFilePath));
      raw = p.readTextFile(basename(catalogFilePath));
    }
    const parsed = load(raw);
    const result = FormsCatalogSchema.safeParse(parsed);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      return { valid: false, errors };
    }

    const duplicateIds = findDuplicateEntryIds(result.data.entries);
    if (duplicateIds.length > 0) {
      return {
        valid: false,
        errors: duplicateIds.map((id) => `entries.id: duplicate id '${id}'`),
      };
    }

    return { valid: true, catalog: result.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, errors: [message] };
  }
}

export function writeCatalog(catalogFilePath: string, catalog: FormsCatalog, provider?: WorkspaceProvider): void {
  const yaml = dump(catalog, {
    noRefs: true,
    lineWidth: 120,
    sortKeys: false,
  });
  if (provider) {
    provider.writeFile(catalogFilePath, yaml);
  } else {
    const p = createProvider(dirname(catalogFilePath));
    p.writeFile(basename(catalogFilePath), yaml);
  }
}

export function checksumSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function findDuplicateEntryIds(entries: CatalogEntry[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      duplicates.add(entry.id);
    }
    seen.add(entry.id);
  }

  return [...duplicates];
}

export async function fetchCatalogEntries(options: {
  rootDir: string;
  catalogFilePath?: string;
  ids?: string[];
  downloader?: (url: string) => Promise<Buffer>;
  provider?: WorkspaceProvider;
}): Promise<FetchSummary> {
  const p = options.provider ?? createProvider(options.rootDir);
  const filePath = options.catalogFilePath ?? catalogPath(options.rootDir);

  // validateCatalog needs the absolute path when no provider is given,
  // or the relative path when a provider is given.
  const validation = options.provider
    ? validateCatalog(CATALOG_FILE, p)
    : validateCatalog(filePath);
  if (!validation.valid) {
    throw new Error(`Catalog validation failed:\n- ${validation.errors.join('\n- ')}`);
  }

  const catalog = validation.catalog;
  const filterIds = new Set((options.ids ?? []).map((id) => id.trim()).filter(Boolean));
  const entries = filterIds.size === 0
    ? catalog.entries
    : catalog.entries.filter((entry) => filterIds.has(entry.id));

  if (filterIds.size > 0) {
    const foundIds = new Set(entries.map((entry) => entry.id));
    const missing = [...filterIds].filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new Error(`Catalog entries not found: ${missing.join(', ')}`);
    }
  }

  const results: FetchSummary['results'] = [];
  for (const entry of entries) {
    if (entry.license.redistribution === 'pointer-only') {
      results.push({
        id: entry.id,
        status: 'pointer-only',
        message: `Pointer-only entry. Retrieve manually from ${entry.source_url}.`,
      });
      continue;
    }

    try {
      const buffer = options.downloader
        ? await options.downloader(entry.source_url)
        : await downloadBinary(entry.source_url);
      const digest = checksumSha256(buffer);
      if (digest.toLowerCase() !== entry.checksum.sha256.toLowerCase()) {
        throw new Error(
          `Checksum mismatch for ${entry.id}. Expected ${entry.checksum.sha256}, got ${digest}`
        );
      }

      const destination = destinationRelativePath(entry);
      const destDir = dirname(destination);
      p.mkdir(destDir, { recursive: true });
      p.writeFile(destination, buffer);

      results.push({
        id: entry.id,
        status: 'downloaded',
        path: `${options.rootDir}/${destination}`,
        message: 'Downloaded and checksum-verified.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        id: entry.id,
        status: 'failed',
        message,
      });
    }
  }

  return {
    results,
    downloadedCount: results.filter((result) => result.status === 'downloaded').length,
    pointerOnlyCount: results.filter((result) => result.status === 'pointer-only').length,
    failedCount: results.filter((result) => result.status === 'failed').length,
  };
}

async function downloadBinary(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed for ${url}: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function destinationRelativePath(entry: CatalogEntry): string {
  const lifecycle: LifecycleDir = entry.destination_lifecycle ?? 'forms';
  let directory = lifecycle as string;

  if (lifecycle === 'forms') {
    const topic = entry.destination_topic ?? 'uncategorized';
    directory = `${directory}/${topic}`;
  }

  const fileName = entry.destination_filename
    ?? sanitizeFileNameFromUrl(entry.source_url)
    ?? `${entry.id}.docx`;

  return `${directory}/${fileName}`;
}

function sanitizeFileNameFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const name = basename(parsed.pathname);
    if (!name) {
      return undefined;
    }

    const decoded = decodeURIComponent(name);
    const ext = extname(decoded);
    if (!ext) {
      return `${decoded}.docx`;
    }
    return decoded;
  } catch {
    return undefined;
  }
}

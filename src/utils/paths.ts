import { join, dirname, resolve, relative, sep, delimiter } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONTENT_ROOTS_ENV = 'OPEN_AGREEMENTS_CONTENT_ROOTS';

export interface ContentEntry {
  id: string;
  dir: string;
  baseDir: string;
}

/**
 * The three logical kinds a slug can carry. Since the S3 source/rights
 * restructure (#1249) every managed slug lives under a single
 * `templates/<source>-<rights>/<slug>/` tree — the old `external/` and
 * `field-selectors/` top-level dirs are gone. The kind is now DERIVED from each
 * slug's `metadata.yaml` instead of from which directory it lived in:
 *
 *   - `field-selector`  — `artifact_type: field-selector` (linked, non-redistributable
 *                         source; ships transformation instructions, no `template.docx`).
 *   - `external`        — a redistributable-but-no-derivatives vendored form
 *                         (`allow_derivatives: false`, e.g. the CC BY-ND YC SAFEs):
 *                         the original DOCX is stored as-is and bracket-to-tag
 *                         normalized at fill time.
 *   - `template`        — a first-party / derivable template with pre-baked `{tag}`
 *                         placeholders (the default).
 */
export type ContentKind = 'template' | 'external' | 'field-selector';

interface IndexedEntry extends ContentEntry {
  kind: ContentKind;
}

/** Root of the open-agreements package */
export function getPackageRoot(): string {
  // From dist/utils/paths.js → go up to package root
  return join(__dirname, '..', '..');
}

/** Optional additional content roots. Format is path-delimited, e.g. /a:/b on macOS/Linux. */
export function getContentRoots(): string[] {
  const envRoots = (process.env[CONTENT_ROOTS_ENV] ?? '')
    .split(delimiter)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => resolve(value));

  const roots = [...envRoots, resolve(getPackageRoot())];
  return uniqueOrdered(roots);
}

/** Resolve a child directory, rejecting path traversal (e.g. "../../etc") */
function resolveChildDir(parentDir: string, childId: string, label: string): string {
  const resolved = resolve(join(parentDir, childId));
  const rel = relative(resolve(parentDir), resolved);
  if (rel.startsWith('..') || rel.startsWith(sep + sep)) {
    throw new Error(`Invalid ${label} ID: ${childId}`);
  }
  return resolved;
}

/**
 * The single top-level content directory. Every managed slug lives two levels
 * deep as `templates/<source>-<rights>/<slug>/`.
 */
function templatesRootIn(root: string): string {
  return join(root, 'templates');
}

/** Top-level `templates/` directory in the package root. */
export function getTemplatesDir(): string {
  return templatesRootIn(getPackageRoot());
}

/** All `templates/` roots in precedence order (env roots first, package root last). */
export function getAllTemplatesDirs(): string[] {
  return getContentRoots().map(templatesRootIn);
}

/**
 * Derive the logical kind of a slug from its `metadata.yaml`. Reads only the two
 * discriminating keys (`artifact_type`, `allow_derivatives`); a missing or
 * unreadable metadata file falls back to `template`.
 */
function deriveKind(slugDir: string): ContentKind {
  const metaPath = join(slugDir, 'metadata.yaml');
  let artifactType: unknown;
  let allowDerivatives: unknown;
  try {
    const parsed = yaml.load(readFileSync(metaPath, 'utf-8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      artifactType = record.artifact_type;
      allowDerivatives = record.allow_derivatives;
    }
  } catch {
    // Missing/unreadable metadata → treat as an ordinary template.
  }
  if (artifactType === 'field-selector') return 'field-selector';
  if (allowDerivatives === false) return 'external';
  return 'template';
}

/**
 * Build the unified slug index across every configured `templates/` root. Walks
 * `templates/<segment>/<slug>/`, keying by the globally-unique slug (first
 * content root wins on collisions, matching the previous first-match precedence).
 */
function buildIndex(): Map<string, IndexedEntry> {
  const index = new Map<string, IndexedEntry>();

  for (const baseDir of getAllTemplatesDirs()) {
    if (!existsSync(baseDir)) continue;

    const segments = readdirSync(baseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    for (const segment of segments) {
      const segmentDir = join(baseDir, segment);
      const slugs = readdirSync(segmentDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

      for (const slug of slugs) {
        if (index.has(slug)) continue; // first content root wins
        const dir = resolveChildDir(segmentDir, slug, 'template');
        index.set(slug, { id: slug, dir, baseDir, kind: deriveKind(dir) });
      }
    }
  }

  return index;
}

/** Look up a slug's directory, requiring it to carry the given kind. */
function findOfKind(id: string, kind: ContentKind): string | undefined {
  const entry = buildIndex().get(id);
  return entry && entry.kind === kind ? entry.dir : undefined;
}

/** List entries of a single kind, sorted by id, as plain ContentEntry records. */
function listOfKind(kind: ContentKind): ContentEntry[] {
  return [...buildIndex().values()]
    .filter((entry) => entry.kind === kind)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, dir, baseDir }) => ({ id, dir, baseDir }));
}

// --- Templates (first-party, pre-baked `{tag}` placeholders) ---

/** Resolve a specific template directory by ID */
export function resolveTemplateDir(templateId: string): string {
  return findTemplateDir(templateId) ?? resolveChildDir(getTemplatesDir(), templateId, 'template');
}

/** Find a specific template directory by ID across all configured content roots. */
export function findTemplateDir(templateId: string): string | undefined {
  return findOfKind(templateId, 'template');
}

/** List template IDs across all content roots (first match wins for duplicates). */
export function listTemplateEntries(): ContentEntry[] {
  return listOfKind('template');
}

export function listTemplateIds(): string[] {
  return listTemplateEntries().map((entry) => entry.id);
}

// --- External templates (vendored, no-derivatives, original DOCX stored as-is) ---

/** Resolve a specific external template directory by ID */
export function resolveExternalDir(externalId: string): string {
  return findExternalDir(externalId) ?? resolveChildDir(getTemplatesDir(), externalId, 'external');
}

/** Find a specific external directory by ID across all configured content roots. */
export function findExternalDir(externalId: string): string | undefined {
  return findOfKind(externalId, 'external');
}

/** List external template IDs across all content roots (first match wins for duplicates). */
export function listExternalEntries(): ContentEntry[] {
  return listOfKind('external');
}

export function listExternalIds(): string[] {
  return listExternalEntries().map((entry) => entry.id);
}

// --- FieldSelectors (linked, non-redistributable; transformation instructions only) ---

/** Resolve a specific fieldSelector directory by ID */
export function resolveFieldSelectorDir(fieldSelectorId: string): string {
  return findFieldSelectorDir(fieldSelectorId) ?? resolveChildDir(getTemplatesDir(), fieldSelectorId, 'field-selector');
}

/** Find a specific fieldSelector directory by ID across all configured content roots. */
export function findFieldSelectorDir(fieldSelectorId: string): string | undefined {
  return findOfKind(fieldSelectorId, 'field-selector');
}

/** List fieldSelector IDs across all content roots (first match wins for duplicates). */
export function listFieldSelectorEntries(): ContentEntry[] {
  return listOfKind('field-selector');
}

export function listFieldSelectorIds(): string[] {
  return listFieldSelectorEntries().map((entry) => entry.id);
}

function uniqueOrdered(paths: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of paths) {
    if (!seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }
  return unique;
}

/**
 * Shared content-listing module (open-agreements#635).
 *
 * Canonical helpers for enumerating the repository's non-template first-class
 * legal content — practice guides, reviewer checklists, and law surveys — as a
 * flat, deterministic catalog with stable IDs. Used by:
 * - MCP `tools.ts` (`list_content` / `get_content`, via dynamic import or npm
 *   dependency), alongside `template-listing.ts` for templates
 * - future hosted-MCP parity in the openagreements.org deploy (which already
 *   consumes `template-listing.ts` the same way)
 *
 * The content lives as markdown bundles at the repository root
 * (`practice-guides/`, `checklists/`, `surveys/` — the product-line-first
 * views; the topic-first `legal-practice-library/` duplicates the same
 * documents and is intentionally NOT indexed to keep IDs unique). These
 * directories are part of the git repository but are NOT shipped in the npm
 * package (`files` in package.json), so callers must treat "no content roots
 * present" as a valid runtime state, reported by
 * `listDocContentTypesAvailable()`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import yaml from 'js-yaml';
import { getPackageRoot } from '../utils/paths.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Non-template content types served from local markdown bundles. */
export type DocContentType = 'practice_guide' | 'checklist' | 'survey';

/** Every content type addressable through the unified content catalog. */
export type ContentType = 'template' | DocContentType;

/** Repository directory backing each markdown-bundle content type. */
export const DOC_CONTENT_DIRS: Record<DocContentType, string> = {
  practice_guide: 'practice-guides',
  checklist: 'checklists',
  survey: 'surveys',
};

export const DOC_CONTENT_TYPES = Object.keys(DOC_CONTENT_DIRS) as DocContentType[];

export interface DocContentItem {
  /** Stable ID: `<type>/<topic>/<doc path>`, e.g. `practice_guide/wage-and-hour/us`. */
  content_id: string;
  type: DocContentType;
  title: string;
  description: string | null;
  /** First path segment under the content root, e.g. `wage-and-hour`. */
  topic: string;
  /**
   * Jurisdiction path derived from the document location (`us`,
   * `us/california`, `worldwide`, …), or null for non-jurisdictional docs.
   */
  jurisdiction: string | null;
  format: 'markdown';
  /** Canonical public URL from frontmatter `resource`, when declared. */
  source_url: string | null;
  /** Frontmatter `timestamp` (review/update date), when declared. */
  updated_at: string | null;
  tags: string[];
  /** Repository-relative markdown file path (provenance). */
  repo_path: string;
}

export interface DocContentDetail extends DocContentItem {
  /** Full canonical markdown file content, frontmatter included. */
  markdown: string;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * One path segment of a doc slug. Deliberately strict (lowercase kebab, no
 * dots) so IDs can never traverse outside the content roots.
 */
const SLUG_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Files that are navigation/changelog scaffolding, not content documents. */
const NON_DOCUMENT_BASENAMES = new Set(['index.md', 'log.md']);

const JURISDICTION_ROOTS = new Set(['us', 'worldwide']);

function isValidSlugPath(segments: string[]): boolean {
  return segments.length >= 2 && segments.every((segment) => SLUG_SEGMENT_PATTERN.test(segment));
}

interface Frontmatter {
  title?: unknown;
  description?: unknown;
  resource?: unknown;
  timestamp?: unknown;
  tags?: unknown;
}

function parseFrontmatter(text: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return {};
  try {
    const parsed = yaml.load(match[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Frontmatter;
    }
  } catch {
    // Unparseable frontmatter → fall back to heading-derived metadata.
  }
  return {};
}

function firstHeading(text: string): string | null {
  const match = /^# +(.+)$/m.exec(text);
  if (!match) return null;
  // Strip footnote markers like `[^about]` that decorate projected headings.
  return match[1].replace(/\[\^[^\]]*\]/g, '').trim() || null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === 'string');
}

/** Recursively collect document files under `dir`, as root-relative segment arrays. */
function walkDocuments(dir: string, prefix: string[] = []): string[][] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: string[][] = [];
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      if (!SLUG_SEGMENT_PATTERN.test(entry.name)) continue;
      results.push(...walkDocuments(join(dir, entry.name), [...prefix, entry.name]));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md') || NON_DOCUMENT_BASENAMES.has(entry.name)) continue;
    const slug = entry.name.slice(0, -'.md'.length);
    if (!SLUG_SEGMENT_PATTERN.test(slug)) continue;
    results.push([...prefix, slug]);
  }
  return results;
}

function deriveJurisdiction(segments: string[]): string | null {
  // segments are the path parts after the topic, e.g. ['us', 'california'].
  if (segments.length === 0 || !JURISDICTION_ROOTS.has(segments[0])) return null;
  return segments.join('/');
}

function buildItem(
  type: DocContentType,
  segments: string[],
  contentRoot: string,
): DocContentItem | null {
  // Every document lives at least one level under a topic directory.
  if (!isValidSlugPath(segments)) return null;

  const repoPath = `${DOC_CONTENT_DIRS[type]}/${segments.join('/')}.md`;
  const absolutePath = join(contentRoot, repoPath);
  let text: string;
  try {
    text = readFileSync(absolutePath, 'utf-8');
  } catch {
    return null;
  }

  const frontmatter = parseFrontmatter(text);
  const title = asString(frontmatter.title) ?? firstHeading(text) ?? segments[segments.length - 1];

  return {
    content_id: `${type}/${segments.join('/')}`,
    type,
    title,
    description: asString(frontmatter.description),
    topic: segments[0],
    jurisdiction: deriveJurisdiction(segments.slice(1)),
    format: 'markdown',
    source_url: asString(frontmatter.resource),
    updated_at: asString(frontmatter.timestamp),
    tags: asTags(frontmatter.tags),
    repo_path: repoPath,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Which markdown-bundle content types are servable from `contentRoot` (the
 * package root by default). The npm package does not ship these directories,
 * so an installed-package runtime typically returns `[]` — callers should
 * surface that as "content unavailable in this runtime", not as empty content.
 */
export function listDocContentTypesAvailable(contentRoot?: string): DocContentType[] {
  const root = resolve(contentRoot ?? getPackageRoot());
  return DOC_CONTENT_TYPES.filter((type) => existsSync(join(root, DOC_CONTENT_DIRS[type])));
}

/**
 * List every practice guide, checklist, and survey document as a flat catalog,
 * sorted lexicographically by `content_id` (deterministic order). Missing
 * content directories contribute zero items.
 */
export function listDocContentItems(contentRoot?: string): DocContentItem[] {
  const root = resolve(contentRoot ?? getPackageRoot());
  const items: DocContentItem[] = [];

  for (const type of DOC_CONTENT_TYPES) {
    const typeRoot = join(root, DOC_CONTENT_DIRS[type]);
    if (!existsSync(typeRoot)) continue;
    for (const segments of walkDocuments(typeRoot)) {
      const item = buildItem(type, segments, root);
      if (item) items.push(item);
    }
  }

  items.sort((a, b) => a.content_id.localeCompare(b.content_id));
  return items;
}

/**
 * Resolve one content ID (e.g. `checklist/safes/yc-post-money-safe-valuation-cap`)
 * to its full canonical document. Returns undefined for unknown IDs, IDs of the
 * wrong shape, and anything that would escape the content roots.
 */
export function findDocContentItem(
  contentId: string,
  contentRoot?: string,
): DocContentDetail | undefined {
  const root = resolve(contentRoot ?? getPackageRoot());
  const [type, ...segments] = contentId.split('/');
  if (!DOC_CONTENT_TYPES.includes(type as DocContentType)) return undefined;
  if (!isValidSlugPath(segments)) return undefined;

  const typeRoot = resolve(join(root, DOC_CONTENT_DIRS[type as DocContentType]));
  const filePath = resolve(join(typeRoot, `${segments.join('/')}.md`));
  const rel = relative(typeRoot, filePath);
  if (rel.startsWith('..') || rel.startsWith(sep)) return undefined;
  if (NON_DOCUMENT_BASENAMES.has(`${segments[segments.length - 1]}.md`)) return undefined;
  if (!existsSync(filePath)) return undefined;

  const item = buildItem(type as DocContentType, segments, root);
  if (!item) return undefined;

  return { ...item, markdown: readFileSync(filePath, 'utf-8') };
}

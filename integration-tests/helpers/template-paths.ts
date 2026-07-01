import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Test helper for the S3 source/rights layout (#1249): every slug lives two
 * levels deep as `templates/<source>-<rights>/<slug>/`. These helpers resolve a
 * slug to its directory without hard-coding the `<source>-<rights>` segment, so
 * tests stay robust if a slug's license (and therefore its segment) changes.
 */

/** Resolve the directory of `slug` under `<root>/templates/<segment>/<slug>`, or undefined. */
export function resolveSlugDir(root: string, slug: string): string | undefined {
  const templatesRoot = join(root, 'templates');
  if (!existsSync(templatesRoot)) return undefined;
  for (const segment of readdirSync(templatesRoot, { withFileTypes: true })) {
    if (!segment.isDirectory()) continue;
    const candidate = join(templatesRoot, segment.name, slug);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Like resolveSlugDir but throws with a clear message when the slug is absent. */
export function slugDir(root: string, slug: string): string {
  const dir = resolveSlugDir(root, slug);
  if (!dir) throw new Error(`template slug "${slug}" not found under ${root}/templates/*/`);
  return dir;
}

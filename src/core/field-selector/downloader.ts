import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import type { FieldSelectorMetadata } from '../metadata.js';

// Lazy — must be a function so ESM import hoisting doesn't evaluate before
// the hosting deployment sets OPEN_AGREEMENTS_CACHE_ROOT (e.g. Vercel
// functions set this at request-handler entry to relocate the cache off
// the read-only function bundle).
function getCacheRoot(): string {
  return process.env['OPEN_AGREEMENTS_CACHE_ROOT']
    ?? join(homedir(), '.open-agreements', 'cache');
}

function getCachePath(fieldSelectorId: string): string {
  return join(getCacheRoot(), fieldSelectorId, 'source.docx');
}

function verifyHash(buf: Buffer, expected: string): boolean {
  const actual = createHash('sha256').update(buf).digest('hex');
  return actual === expected;
}

/**
 * Ensure the source DOCX for a fieldSelector is available locally.
 * Downloads from source_url on first use, caches in ~/.open-agreements/cache/<field-selector-id>/source.docx.
 * Verifies SHA-256 integrity when source_sha256 is set in metadata.
 */
export async function ensureSourceDocx(fieldSelectorId: string, metadata: FieldSelectorMetadata): Promise<string> {
  const cachePath = getCachePath(fieldSelectorId);

  // Check cached file
  if (existsSync(cachePath)) {
    if (metadata.source_sha256) {
      const buf = readFileSync(cachePath);
      if (verifyHash(buf, metadata.source_sha256)) {
        return cachePath;
      }
      console.log(`Cached file for ${fieldSelectorId} failed integrity check, re-downloading...`);
    } else {
      return cachePath;
    }
  }

  // Download
  console.log(`Downloading ${metadata.name} from ${metadata.source_url}...`);
  const response = await fetch(metadata.source_url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${fieldSelectorId}: HTTP ${response.status} ${response.statusText}\n` +
      `  URL: ${metadata.source_url}`
    );
  }

  const buf = Buffer.from(await response.arrayBuffer());

  // Verify hash if available
  if (metadata.source_sha256) {
    if (!verifyHash(buf, metadata.source_sha256)) {
      const actual = createHash('sha256').update(buf).digest('hex');
      throw new Error(
        `Integrity check failed for ${fieldSelectorId}: downloaded file hash does not match.\n` +
        `  Expected SHA-256: ${metadata.source_sha256}\n` +
        `  Actual SHA-256:   ${actual}\n` +
        `  URL: ${metadata.source_url}`
      );
    }
  }

  // Write to cache
  const cacheDir = join(getCacheRoot(), fieldSelectorId);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath, buf);
  console.log(`Cached: ${cachePath}`);

  return cachePath;
}

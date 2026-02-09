import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import type { RecipeMetadata } from '../metadata.js';

const CACHE_ROOT = join(homedir(), '.open-agreements', 'cache');

function getCachePath(recipeId: string): string {
  return join(CACHE_ROOT, recipeId, 'source.docx');
}

function verifyHash(buf: Buffer, expected: string): boolean {
  const actual = createHash('sha256').update(buf).digest('hex');
  return actual === expected;
}

/**
 * Ensure the source DOCX for a recipe is available locally.
 * Downloads from source_url on first use, caches in ~/.open-agreements/cache/<recipe-id>/source.docx.
 * Verifies SHA-256 integrity when source_sha256 is set in metadata.
 */
export async function ensureSourceDocx(recipeId: string, metadata: RecipeMetadata): Promise<string> {
  const cachePath = getCachePath(recipeId);

  // Check cached file
  if (existsSync(cachePath)) {
    if (metadata.source_sha256) {
      const buf = readFileSync(cachePath);
      if (verifyHash(buf, metadata.source_sha256)) {
        return cachePath;
      }
      console.log(`Cached file for ${recipeId} failed integrity check, re-downloading...`);
    } else {
      return cachePath;
    }
  }

  // Download
  console.log(`Downloading ${metadata.name} from ${metadata.source_url}...`);
  const response = await fetch(metadata.source_url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${recipeId}: HTTP ${response.status} ${response.statusText}\n` +
      `  URL: ${metadata.source_url}`
    );
  }

  const buf = Buffer.from(await response.arrayBuffer());

  // Verify hash if available
  if (metadata.source_sha256) {
    if (!verifyHash(buf, metadata.source_sha256)) {
      const actual = createHash('sha256').update(buf).digest('hex');
      throw new Error(
        `Integrity check failed for ${recipeId}: downloaded file hash does not match.\n` +
        `  Expected SHA-256: ${metadata.source_sha256}\n` +
        `  Actual SHA-256:   ${actual}\n` +
        `  URL: ${metadata.source_url}`
      );
    }
  }

  // Write to cache
  const cacheDir = join(CACHE_ROOT, recipeId);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath, buf);
  console.log(`Cached: ${cachePath}`);

  return cachePath;
}

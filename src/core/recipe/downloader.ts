import { writeFileSync } from 'node:fs';

/**
 * Download a file from a URL and write it to destPath.
 * Uses Node 20+ built-in fetch().
 */
export async function downloadSource(url: string, destPath: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText} from ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(destPath, buffer);
  return destPath;
}

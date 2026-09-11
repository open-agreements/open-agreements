import { createHash, randomUUID } from 'node:crypto';
import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const RETRY_INTERVAL_MS = 50;

export interface PackageArtifactLock {
  path: string;
  release: () => void;
}

/**
 * Serializes integration tests that read or regenerate the repository's shared
 * `dist/` package artifact. Vitest executes test files in parallel workers, so
 * an npm pack can otherwise observe a source map while `tsc` is replacing it.
 */
export async function acquirePackageArtifactLock(
  repoRoot: string,
  timeoutMs = 120_000,
): Promise<PackageArtifactLock> {
  const rootKey = createHash('sha256').update(resolve(repoRoot)).digest('hex').slice(0, 16);
  const path = join(tmpdir(), `open-agreements-package-artifact-${rootKey}.lock`);
  const token = `${process.pid}:${randomUUID()}`;
  const startedAt = Date.now();

  while (true) {
    try {
      const fd = openSync(path, 'wx');
      try {
        writeFileSync(fd, `${token}\n`, 'utf8');
      } finally {
        closeSync(fd);
      }

      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        process.off('exit', release);
        try {
          if (readFileSync(path, 'utf8').trim() === token) unlinkSync(path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      };
      process.once('exit', release);
      return {
        path,
        release,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Timed out waiting for package artifact lock: ${path}`);
      }
      await new Promise((resolveRetry) => setTimeout(resolveRetry, RETRY_INTERVAL_MS));
    }
  }
}

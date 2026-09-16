import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Never certify current TypeScript hashes while executing a stale dist copy.
 * Use the lockfile-installed compiler, not npx/network/global PATH discovery.
 * This local experimental workflow intentionally requires a source checkout.
 */
export function buildOriginalRuntime() {
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc')], { cwd: root, stdio: 'pipe' });
  execFileSync(process.execPath, [join(root, 'scripts/check_runtime_capabilities.mjs')], { cwd: root, stdio: 'pipe' });
}

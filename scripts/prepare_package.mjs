import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// npm 10's directory packer invokes `prepare` even when `npm pack` receives
// `--ignore-scripts`. Honor the caller's explicit lifecycle policy here so a
// read-only package inspection cannot rebuild `dist/` behind another process.
const ignoreScripts =
  process.env.npm_config_ignore_scripts ?? process.env.NPM_CONFIG_IGNORE_SCRIPTS ?? '';
if (['true', '1'].includes(ignoreScripts.toLowerCase())) {
  process.exit(0);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');

if (!existsSync(tsc)) {
  console.log('skip build: typescript not installed (production/omit-dev install)');
  process.exit(0);
}

const npmExecPath = process.env.npm_execpath;
const command = npmExecPath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = npmExecPath ? [npmExecPath, 'run', 'build'] : ['run', 'build'];
const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });

if (result.error) throw result.error;
process.exit(result.status ?? 1);

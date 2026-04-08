#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Backend-only packages that must NEVER be pulled in by a fresh install of
 * `open-agreements` from its published tarball. These are used by the hosted
 * signing backend (packages/signing/, api/auth/) and must stay declared
 * inside packages/signing/package.json, not at the repo root.
 *
 * Guardrail added after 0.7.0–0.7.4 shipped these as root runtime deps,
 * inflating CLI install size 3.5× and introducing 6 new npm audit findings.
 * See plan: wobbly-bouncing-glacier.md
 */
const BANNED_CLI_RUNTIME_DEPS = [
  '@google-cloud/firestore',
  '@google-cloud/storage',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const packTargets = [
  {
    name: 'open-agreements',
    dir: REPO_ROOT,
  },
  {
    name: '@open-agreements/contracts-workspace-mcp',
    dir: resolve(REPO_ROOT, 'packages/contracts-workspace-mcp'),
  },
  {
    name: '@open-agreements/contract-templates-mcp',
    dir: resolve(REPO_ROOT, 'packages/contract-templates-mcp'),
  },
  {
    name: '@open-agreements/checklist-mcp',
    dir: resolve(REPO_ROOT, 'packages/checklist-mcp'),
  },
];

function run(command, args, options = {}) {
  const cacheDir = resolve(REPO_ROOT, '.tmp-smoke', 'npm-cache');
  mkdirSync(cacheDir, { recursive: true });
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      NPM_CONFIG_CACHE: cacheDir,
    },
    ...options,
  });
}

function pack(target) {
  const output = run('npm', ['pack', '--ignore-scripts'], { cwd: target.dir }).trim();
  const tarballName = output.split('\n').at(-1);
  if (!tarballName) {
    throw new Error(`Could not resolve tarball output for ${target.name}`);
  }
  return {
    ...target,
    tarball: resolve(target.dir, tarballName),
  };
}

function assertMcpStartup(commandName, cwd) {
  const initRequest = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}\n';
  const output = run(resolveLocalBin(commandName, cwd), [], {
    cwd,
    input: initRequest,
    timeout: 12000,
  });

  if (!output.includes('"jsonrpc":"2.0"') || !output.includes('"serverInfo"')) {
    throw new Error(`${commandName} did not return initialize response`);
  }
}

function resolveLocalBin(commandName, cwd) {
  const binPath = resolve(cwd, 'node_modules', '.bin', commandName);
  if (!existsSync(binPath)) {
    throw new Error(`Could not resolve local binary for ${commandName}`);
  }
  return binPath;
}

function main() {
  run('npm', ['run', 'build'], { cwd: REPO_ROOT, timeout: 120000 });
  run('npm', ['run', 'build:workspace-mcp'], { cwd: REPO_ROOT, timeout: 120000 });
  run('npm', ['run', 'build:contract-templates-mcp'], { cwd: REPO_ROOT, timeout: 120000 });
  run('npm', ['run', 'build:checklist-mcp'], { cwd: REPO_ROOT, timeout: 120000 });

  const packed = packTargets.map(pack);
  const sandbox = mkdtempSync(join(tmpdir(), 'oa-isolated-runtime-'));

  try {
    run('npm', ['init', '-y'], { cwd: sandbox });
    run(
      'npm',
      ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline', ...packed.map((item) => item.tarball)],
      { cwd: sandbox, timeout: 600000 },
    );

    // Guardrail: backend-only SDKs must not land in the CLI tarball's install tree.
    for (const dep of BANNED_CLI_RUNTIME_DEPS) {
      const depPath = resolve(sandbox, 'node_modules', dep);
      let present = false;
      try {
        statSync(depPath);
        present = true;
      } catch {
        // not present — good
      }
      if (present) {
        throw new Error(
          `Backend-only SDK "${dep}" was pulled into the CLI tarball install at ${depPath}. ` +
            `It must not be a runtime dep of the root \`open-agreements\` package. ` +
            `Move it to packages/signing/package.json or another workspace-internal manifest.`,
        );
      }
    }

    const listOutput = run(resolveLocalBin('open-agreements', sandbox), ['list', '--json'], {
      cwd: sandbox,
      timeout: 30000,
    });
    const parsed = JSON.parse(listOutput);
    if (!parsed || parsed.schema_version !== 1 || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error('open-agreements list --json did not return expected payload in isolated runtime');
    }

    assertMcpStartup('open-agreements-workspace-mcp', sandbox);
    assertMcpStartup('open-agreements-contract-templates-mcp', sandbox);
    assertMcpStartup('open-agreements-checklist-mcp', sandbox);

    console.log('PASS isolated package runtime checks.');
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
    for (const item of packed) {
      rmSync(item.tarball, { force: true });
    }
  }
}

main();

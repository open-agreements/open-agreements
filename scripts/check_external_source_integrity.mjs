#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';

const ADMINISTRATIVE_FILES = new Set(['metadata.yaml', 'README.md', 'anchored-paragraph-bindings.json']);

/** Protect original content at either revision, including removed directories. */
export function checkExternalSourceIntegrity({cwd = process.cwd(), base, head = 'HEAD'}) {
  const git = (...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  for (const ref of [base, head]) git('rev-parse', '--verify', `${ref}^{commit}`);
  const changed = git('diff', '--name-only', '--no-renames', '-z', base, head, '--', 'templates/').split('\0').filter(Boolean);
  const protectedDirs = new Map();
  const violations = [];
  for (const path of changed) {
    const match = /^(templates\/[^/]+\/[^/]+)\/([\s\S]+)$/.exec(path);
    if (!match) continue;
    const [, dir, relative] = match;
    if (!protectedDirs.has(dir)) {
      const restricted = [base, head].some(ref => {
        const metadataPath = `${dir}/metadata.yaml`;
        if (!git('ls-tree', ref, '--', metadataPath).trim()) return false;
        return yaml.load(git('show', `${ref}:${metadataPath}`))?.allow_derivatives === false;
      });
      protectedDirs.set(dir, restricted);
    }
    if (protectedDirs.get(dir) && !ADMINISTRATIVE_FILES.has(relative)) violations.push(path);
  }
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const violations = checkExternalSourceIntegrity({base: process.env.BASE_SHA || 'HEAD~1'});
    if (violations.length) {
      console.error(`Original external content changed:\n${violations.join('\n')}`);
      process.exitCode = 1;
    } else console.log('External original-content integrity check passed.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

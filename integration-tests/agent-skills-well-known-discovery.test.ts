import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect } from 'vitest';

import { loadSkillsCatalog } from '../scripts/lib/skills-data.mjs';
import { itAllure } from './helpers/allure-test.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const GENERATOR = join(REPO_ROOT, 'scripts/generate_site_indexes.mjs');
const DISCOVERY_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

const it = itAllure.epic('Platform & Distribution');

function makeSiteFixture() {
  const root = mkdtempSync(join(tmpdir(), 'oa-site-indexes-'));
  const siteDir = join(root, '_site');
  mkdirSync(siteDir, { recursive: true });
  writeFileSync(
    join(siteDir, 'index.html'),
    [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<title>OpenAgreements</title>',
      '<meta name="description" content="Legal agreement automation">',
      '</head>',
      '<body><a href="/templates">Templates</a></body>',
      '</html>',
    ].join('\n'),
    'utf8',
  );
  return root;
}

function runGenerator(root: string) {
  execFileSync(process.execPath, [GENERATOR], {
    cwd: root,
    env: { ...process.env, SITE_URL: 'https://openagreements.org' },
    stdio: 'pipe',
  });
}

describe('agent skills well-known discovery', () => {
  it.openspec('OA-DST-087')(
    'emits a v0.2.0 well-known archive index for public skills only',
    async () => {
      const root = makeSiteFixture();
      try {
        runGenerator(root);

        const outputDir = join(root, '_site/.well-known/agent-skills');
        const indexPath = join(outputDir, 'index.json');
        const index = JSON.parse(readFileSync(indexPath, 'utf8'));
        const catalogSlugs = loadSkillsCatalog()
          .groups.flatMap((group) => group.skills)
          .map((skill) => skill.slug)
          .sort();

        expect(index.$schema).toBe(DISCOVERY_SCHEMA);
        expect(index.skills.map((skill: { name: string }) => skill.name).sort()).toEqual(
          catalogSlugs,
        );
        expect(index.skills.map((skill: { name: string }) => skill.name)).not.toContain(
          'canonical-markdown-authoring',
        );

        const ndaEntry = index.skills.find((skill: { name: string }) => skill.name === 'nda');
        expect(ndaEntry).toMatchObject({
          type: 'archive',
          url: 'https://openagreements.org/.well-known/agent-skills/nda.zip',
        });
        expect(ndaEntry.digest).toMatch(/^sha256:[a-f0-9]{64}$/);

        const archivePath = join(outputDir, 'nda.zip');
        const archiveBytes = readFileSync(archivePath);
        expect(`sha256:${createHash('sha256').update(archiveBytes).digest('hex')}`).toBe(
          ndaEntry.digest,
        );

        const archive = await JSZip.loadAsync(archiveBytes);
        expect(archive.file('SKILL.md')).toBeTruthy();
        expect(archive.file('CONNECTORS.md')).toBeTruthy();
        expect(archive.file('template-filling-execution.md')).toBeTruthy();
        expect(archive.file('agreements/nda/SKILL.md')).toBeNull();

        const nestedEntry = index.skills.find(
          (skill: { name: string }) => skill.name === 'data-privacy-law-explainer',
        );
        const nestedArchive = await JSZip.loadAsync(
          readFileSync(join(outputDir, 'data-privacy-law-explainer.zip')),
        );
        expect(nestedArchive.file(/^content\//).length).toBeGreaterThan(0);
        const folderEntries = Object.values(nestedArchive.files).filter((entry) => entry.dir);
        expect(folderEntries).toEqual([]);

        runGenerator(root);
        const regeneratedIndex = JSON.parse(readFileSync(indexPath, 'utf8'));
        const regeneratedNda = regeneratedIndex.skills.find(
          (skill: { name: string }) => skill.name === 'nda',
        );
        expect(regeneratedNda.digest).toBe(ndaEntry.digest);
        const regeneratedNested = regeneratedIndex.skills.find(
          (skill: { name: string }) => skill.name === 'data-privacy-law-explainer',
        );
        expect(regeneratedNested.digest).toBe(nestedEntry.digest);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});

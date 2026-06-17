/**
 * Skills directory publish scenario bindings.
 *
 * The skills-directory publish flow is implemented as a manual GitHub Actions
 * workflow plus a repo script (scripts/publish_skills_directories.mjs). These
 * tests exercise the script's pure selection/command-building helpers and lock
 * the workflow/docs policy that the scenarios describe.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import {
  REPO_ROOT,
  buildCommands,
  listSkillDirectories,
  resolveSelectedSkills,
  selectChangedSkills,
} from '../scripts/publish_skills_directories.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const it = itAllure.epic('Platform & Distribution');

function readRepoFile(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

describe('skills directory publish workflow', () => {
  it.openspec('OA-DST-073')(
    'changed scope publishes only the changed skill directories relative to the base ref',
    () => {
      const allSkills = listSkillDirectories();
      const publishable = allSkills.filter((skill) => !skill.internal);
      expect(publishable.length).toBeGreaterThan(0);

      const target = publishable[0];
      const relDir = relative(REPO_ROOT, target.directory);

      // A change inside one skill resolves to that skill only; unrelated paths
      // (e.g. repo-root files) are ignored.
      const changed = selectChangedSkills(allSkills, [
        `${relDir}/SKILL.md`,
        'README.md',
      ]);
      expect(changed.map((skill) => skill.slug)).toEqual([target.slug]);

      // No changed paths -> nothing is published.
      expect(selectChangedSkills(allSkills, [])).toEqual([]);

      // Internal skills are never published even when they change.
      const internal = allSkills.find((skill) => skill.internal);
      if (internal) {
        const relInternal = relative(REPO_ROOT, internal.directory);
        expect(selectChangedSkills(allSkills, [`${relInternal}/SKILL.md`])).toEqual([]);
      }
    },
  );

  it.openspec('OA-DST-074')(
    'selected scope publishes exactly the named subset and fails clearly on an unknown skill',
    () => {
      const allSkills = listSkillDirectories();
      const publishable = allSkills.filter((skill) => !skill.internal);
      const chosen = publishable.slice(0, Math.min(2, publishable.length));
      expect(chosen.length).toBeGreaterThan(0);

      const resolved = resolveSelectedSkills(allSkills, {
        scope: 'selected',
        selectedSkills: chosen.map((skill) => skill.slug).join(','),
      });
      expect(resolved.map((skill) => skill.slug).sort()).toEqual(
        chosen.map((skill) => skill.slug).sort(),
      );

      // A skill directory that does not exist (or exists but lacks a SKILL.md,
      // and so is never discovered as a skill) fails with a clear error.
      expect(() =>
        resolveSelectedSkills(allSkills, {
          scope: 'selected',
          selectedSkills: 'totally-not-a-real-skill',
        }),
      ).toThrow(/Unknown selected skill\(s\): totally-not-a-real-skill/);
    },
  );

  it.openspec('OA-DST-075')(
    'ClawHub publish passes the declared SKILL.md version without inventing one',
    () => {
      const skill = {
        slug: 'demo-skill',
        version: '2.4.6',
        directory: join(REPO_ROOT, 'skills', 'demo-skill'),
      };

      const commands = buildCommands(
        skill,
        { target: 'clawhub', smitheryNamespace: 'open-agreements', clawhubChangelog: '' },
        'abc1234',
      );
      const clawhub = commands.find((command) => command.bin === 'clawhub');
      expect(clawhub).toBeDefined();

      const versionIndex = clawhub!.args.indexOf('--version');
      expect(versionIndex).toBeGreaterThan(-1);
      expect(clawhub!.args[versionIndex + 1]).toBe('2.4.6');

      // The declared version is the only semver-shaped value passed: the script
      // never invents or auto-bumps a separate registry-only version.
      expect(clawhub!.args.filter((arg) => /^\d+\.\d+\.\d+$/.test(arg))).toEqual(['2.4.6']);

      // A skill with no declared version fails rather than fabricating one.
      expect(() =>
        buildCommands(
          { slug: 'no-version', version: null, directory: join(REPO_ROOT, 'skills', 'no-version') },
          { target: 'clawhub', clawhubChangelog: '' },
          'abc1234',
        ),
      ).toThrow(/missing metadata\.version/);
    },
  );

  it.openspec('OA-DST-076')(
    'workflow automates only Smithery and ClawHub; docs mark skills.sh discovery-only',
    () => {
      const workflow = readRepoFile('.github/workflows/publish-skills-directories.yml');
      expect(workflow).toMatch(/@smithery\/cli/);
      expect(workflow).toContain('clawhub');
      // skills.sh is never a publish target in the workflow.
      expect(workflow).not.toMatch(/skills\.sh/);

      const releaseDoc = readRepoFile('docs/changelog-release-process.md');
      expect(releaseDoc).toContain('`skills.sh` is **not** a direct CI publish target');
      expect(releaseDoc.toLowerCase()).toContain('discovery/indexing surface');
    },
  );

  it.openspec('OA-DST-077')(
    'workflow fails before publishing when a requested target secret is missing',
    () => {
      const workflow = readRepoFile('.github/workflows/publish-skills-directories.yml');

      // Each target has a guard step that names the required secret and exits 1.
      expect(workflow).toContain('Require Smithery API key');
      expect(workflow).toContain('Missing required secret: SMITHERY_API_KEY');
      expect(workflow).toContain('Require ClawHub token');
      expect(workflow).toContain('Missing required secret: CLAWHUB_TOKEN');
      expect(workflow).toContain('exit 1');

      // Guards run before the publish step.
      const smitheryGate = workflow.indexOf('Require Smithery API key');
      const clawhubGate = workflow.indexOf('Require ClawHub token');
      const publishStep = workflow.indexOf('Publish requested skills');
      expect(smitheryGate).toBeGreaterThan(-1);
      expect(clawhubGate).toBeGreaterThan(-1);
      expect(publishStep).toBeGreaterThan(smitheryGate);
      expect(publishStep).toBeGreaterThan(clawhubGate);
    },
  );
});

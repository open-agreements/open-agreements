import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT, findSkillDirs, loadSkillsCatalog } from './skills-data.mjs';

const SKILLS_ROOT = join(REPO_ROOT, 'skills');

// Category directory → catalog_group. Keep in sync when adding a category.
const GROUP_BY_CATEGORY = {
  'legal-explainers': ['Legal Explainers'],
  agreements: ['Agreement Drafting And Filling'],
  'client-workflows': ['Editing And Client Workflows'],
  compliance: ['Compliance And Audit'],
  internal: ['Developer Workflows', 'Template Authoring'],
};

function walkSkillMdDirs(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = join(dir, entry.name);
    if (existsSync(join(child, 'SKILL.md'))) found.push(child);
    found.push(...walkSkillMdDirs(child));
  }
  return found;
}

function readFrontmatter(skillDir) {
  const raw = readFileSync(join(skillDir, 'SKILL.md'), 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  expect(match, `${skillDir}/SKILL.md frontmatter`).toBeTruthy();
  return yaml.load(match[1]);
}

describe('skills directory layout', () => {
  const skillDirs = findSkillDirs(SKILLS_ROOT);

  it('discovers every SKILL.md on disk (none hidden below the supported depth)', () => {
    const allOnDisk = walkSkillMdDirs(SKILLS_ROOT).sort();
    expect([...skillDirs].sort()).toEqual(allOnDisk);
  });

  it('keeps every per-skill copy of template-filling-execution.md identical (self-contained bundles)', () => {
    const copies = skillDirs
      .map((dir) => join(dir, 'template-filling-execution.md'))
      .filter((file) => existsSync(file));
    expect(copies.length).toBeGreaterThan(0);
    const canonical = readFileSync(copies[0], 'utf-8');
    for (const file of copies.slice(1)) {
      expect(readFileSync(file, 'utf-8'), `${relative(REPO_ROOT, file)} drifted from ${relative(REPO_ROOT, copies[0])}`).toBe(canonical);
    }
  });

  it('publishes no skill that references files outside its own directory', () => {
    for (const dir of skillDirs) {
      const skillMd = readFileSync(join(dir, 'SKILL.md'), 'utf-8');
      const crossRefs = skillMd.match(/\]\(\.\.\/[^)]+\)/g) ?? [];
      expect(crossRefs, `${relative(REPO_ROOT, dir)} links outside its publish boundary`).toEqual([]);
    }
  });

  it('keeps frontmatter name equal to its directory name (agentskills.io spec)', () => {
    for (const dir of skillDirs) {
      expect(readFrontmatter(dir).name, dir).toBe(basename(dir));
    }
  });

  it('places every skill in a category directory matching its catalog_group', () => {
    for (const dir of skillDirs) {
      const category = basename(dirname(dir));
      const allowedGroups = GROUP_BY_CATEGORY[category];
      expect(allowedGroups, `unknown category "${category}" for ${relative(REPO_ROOT, dir)}`).toBeTruthy();
      const frontmatter = readFrontmatter(dir);
      expect(allowedGroups, relative(REPO_ROOT, dir)).toContain(frontmatter.catalog_group);
    }
  });

  it('hides internal skills from the public catalog and keeps them in internal/', () => {
    const catalogSlugs = loadSkillsCatalog()
      .groups.flatMap((group) => group.skills)
      .map((skill) => skill.slug);

    for (const dir of skillDirs) {
      const frontmatter = readFrontmatter(dir);
      const isInternal = frontmatter.metadata?.internal === true;
      const category = basename(dirname(dir));
      if (isInternal) {
        expect(catalogSlugs, `${frontmatter.name} is internal`).not.toContain(frontmatter.name);
        expect(category, `${frontmatter.name} is internal`).toBe('internal');
      } else {
        expect(catalogSlugs).toContain(frontmatter.name);
        expect(category, `${frontmatter.name} is public`).not.toBe('internal');
      }
    }
  });
});

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(__dirname, "../..");
const GROUP_ORDER = [
  "Agreement Drafting And Filling",
  "Editing And Client Workflows",
  "Legal Explainers",
  "Compliance And Audit",
  "Developer Workflows",
];

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error("SKILL.md is missing YAML frontmatter.");
  }
  return yaml.load(match[1]);
}

function normalizeDescription(frontmatter) {
  const description =
    frontmatter.description || frontmatter.metadata?.["short-description"] || "";
  return String(description).replace(/\s+/g, " ").trim();
}

// Skills live at skills/<category>/<slug>/ (one category level; top-level
// skills/<slug>/ is also tolerated). A directory is a skill iff it contains
// SKILL.md; category directories never do.
const MAX_SKILL_DEPTH = 2;

export function findSkillDirs(dir, depth = 0) {
  if (depth >= MAX_SKILL_DEPTH) {
    return [];
  }
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const child = join(dir, entry.name);
    if (existsSync(join(child, "SKILL.md"))) {
      found.push(child);
    } else {
      found.push(...findSkillDirs(child, depth + 1));
    }
  }
  return found;
}

export function loadSkillsCatalog({ rootDir = REPO_ROOT } = {}) {
  const skillsDir = resolve(rootDir, "skills");
  const skillDirs = findSkillDirs(skillsDir).sort();

  const grouped = new Map();
  for (const group of GROUP_ORDER) {
    grouped.set(group, []);
  }

  for (const skillDir of skillDirs) {
    const slug = basename(skillDir);
    const skillPath = join(skillDir, "SKILL.md");
    const raw = readFileSync(skillPath, "utf-8");
    const frontmatter = parseFrontmatter(raw);
    // Internal skills (repo maintenance, authoring guidance) are hidden from
    // the public catalog; the skills CLI also skips them on default installs.
    if (frontmatter.metadata?.internal === true) {
      continue;
    }
    const group =
      frontmatter.catalog_group || frontmatter.metadata?.catalog_group || null;
    if (!group) {
      throw new Error(`${slug}/SKILL.md is missing catalog_group metadata.`);
    }
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group).push({
      slug,
      path: relative(rootDir, skillDir),
      label: frontmatter.name || slug,
      description: normalizeDescription(frontmatter),
      order:
        Number(frontmatter.catalog_order ?? frontmatter.metadata?.catalog_order) || 100,
    });
  }

  const groups = [...grouped.entries()]
    .filter(([, skills]) => skills.length > 0)
    .sort((a, b) => {
      const leftIndex = GROUP_ORDER.indexOf(a[0]);
      const rightIndex = GROUP_ORDER.indexOf(b[0]);
      const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return normalizedLeft - normalizedRight || a[0].localeCompare(b[0]);
    })
    .map(([title, skills]) => ({
      title,
      skills: skills.sort(
        (left, right) =>
          left.order - right.order || left.label.localeCompare(right.label),
      ),
    }));

  return { groups };
}

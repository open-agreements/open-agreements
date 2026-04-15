import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(__dirname, "../..");
const GROUP_ORDER = [
  "Agreement Drafting And Filling",
  "Editing And Client Workflows",
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

export function loadSkillsCatalog({ rootDir = REPO_ROOT } = {}) {
  const skillsDir = resolve(rootDir, "skills");
  const entries = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const grouped = new Map();
  for (const group of GROUP_ORDER) {
    grouped.set(group, []);
  }

  for (const slug of entries) {
    const skillPath = resolve(skillsDir, slug, "SKILL.md");
    try {
      const raw = readFileSync(skillPath, "utf-8");
      const frontmatter = parseFrontmatter(raw);
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
        label: frontmatter.name || slug,
        description: normalizeDescription(frontmatter),
        order:
          Number(frontmatter.catalog_order ?? frontmatter.metadata?.catalog_order) || 100,
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }
      throw error;
    }
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

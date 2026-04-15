import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(__dirname, "../..");
export const SKILLS_CATALOG_PATH = resolve(REPO_ROOT, "skills", "catalog.yaml");

export function loadSkillsCatalog({ rootDir = REPO_ROOT } = {}) {
  const catalogPath =
    rootDir === REPO_ROOT
      ? SKILLS_CATALOG_PATH
      : resolve(rootDir, "skills", "catalog.yaml");
  const raw = readFileSync(catalogPath, "utf-8");
  const catalog = yaml.load(raw);

  if (!catalog || !Array.isArray(catalog.groups)) {
    throw new Error("skills/catalog.yaml must define a top-level 'groups' array.");
  }

  return catalog;
}

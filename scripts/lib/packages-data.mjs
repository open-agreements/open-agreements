import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(__dirname, "../..");
export const PACKAGES_CATALOG_PATH = resolve(REPO_ROOT, "packages", "catalog.yaml");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function loadPackagesCatalog({ rootDir = REPO_ROOT } = {}) {
  const catalogPath =
    rootDir === REPO_ROOT
      ? PACKAGES_CATALOG_PATH
      : resolve(rootDir, "packages", "catalog.yaml");
  const raw = readFileSync(catalogPath, "utf-8");
  const catalog = yaml.load(raw);

  if (!catalog || !Array.isArray(catalog.entries)) {
    throw new Error("packages/catalog.yaml must define a top-level 'entries' array.");
  }

  return catalog.entries.map((entry) => {
    if (!entry.package_json) {
      throw new Error("packages/catalog.yaml entries must include 'package_json'.");
    }

    const packageJsonPath = resolve(rootDir, entry.package_json);
    if (!existsSync(packageJsonPath)) {
      throw new Error(`packages/catalog.yaml references missing file '${entry.package_json}'.`);
    }

    const packageJson = readJson(packageJsonPath);
    if (!packageJson.name) {
      throw new Error(`Package at '${entry.package_json}' is missing a name.`);
    }

    if (entry.readme_path && !existsSync(resolve(rootDir, entry.readme_path))) {
      throw new Error(`packages/catalog.yaml references missing README '${entry.readme_path}'.`);
    }

    return {
      name: packageJson.name,
      href: entry.href || null,
      readmePath: entry.readme_path || null,
      description: entry.description || packageJson.description || "",
    };
  });
}

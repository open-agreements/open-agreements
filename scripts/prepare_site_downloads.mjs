#!/usr/bin/env node

import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import buildCatalog from "../site/_data/catalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const downloadsDir = resolve(root, "site", "downloads");

const catalog = buildCatalog();
if (!existsSync(downloadsDir)) {
  console.error("Failed to prepare site/downloads: directory was not created.");
  process.exit(1);
}

const files = readdirSync(downloadsDir)
  .filter((name) => name.endsWith(".docx") || name.endsWith(".md"))
  .sort();

if (files.length === 0) {
  console.error("Failed to prepare site/downloads: no download files were generated.");
  process.exit(1);
}

console.log(
  `Prepared ${files.length} download file(s) for ${catalog.previewTemplates.length} template detail page(s).`
);

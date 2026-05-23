#!/usr/bin/env node

import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  PREVIEWS_DIR,
  listOpenAgreementsTemplateIds,
} from "./lib/template-utils.mjs";

function main() {
  const ownedTemplates = listOpenAgreementsTemplateIds();

  const missing = [];
  for (const templateId of ownedTemplates) {
    const previewDir = resolve(PREVIEWS_DIR, templateId);
    const pngCount = existsSync(previewDir)
      ? readdirSync(previewDir).filter((name) => name.endsWith(".png")).length
      : 0;
    if (pngCount === 0) {
      missing.push(templateId);
    }
  }

  if (missing.length > 0) {
    console.error("FAIL template preview gate: missing PNG preview pages for:");
    for (const templateId of missing) {
      console.error(`- ${templateId}`);
    }
    console.error("");
    console.error("Generate previews locally:");
    console.error("npm run generate:template-previews");
    console.error("Or generate just one template:");
    console.error("npm run generate:template-previews -- --template <template-id>");
    process.exit(1);
  }

  console.log(
    `PASS template preview gate: ${ownedTemplates.length} OpenAgreements template(s) have preview PNGs.`
  );
}

main();

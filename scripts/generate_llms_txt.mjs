#!/usr/bin/env node
// Generates root `llms.txt` (concise curated index) and `llms-full.txt` (full
// enumeration) from the live content catalog, following the llmstxt.org
// convention so AI agents can discover the OpenAgreements corpus. Both files are
// generated — run `npm run generate:llms`; `npm run check:llms` fails if they
// drift from the committed copies (wire into CI like check:readme).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCatalog } from "./lib/catalog-data.mjs";
import { buildLibrary } from "./lib/library-data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
const cfg = pkg.readmeConfig || {};

const REPO_BASE_URL = "https://github.com/open-agreements/open-agreements";
const stripSlash = (u) => (u || "").replace(/\/$/, "");
const LPL = stripSlash(cfg.legalPracticeLibraryUrl) || "https://openagreements.org";
const WEBSITE = stripSlash(cfg.websiteUrl) || LPL;

const treeUrl = (repoPath) => `${REPO_BASE_URL}/tree/main/${repoPath}`;
const blobUrl = (repoPath) => `${REPO_BASE_URL}/blob/main/${repoPath}`;
const liveUrl = (item) =>
  item.live ? `${LPL}${item.live}` : treeUrl(item.repoPath);
const surveyUrl = (survey) =>
  survey.resource || treeUrl(survey.repoPath);

const SUMMARY =
  "Open, primary-source-backed U.S. legal content — practice guides, " +
  "50-state surveys, reviewer checklists, and standard agreement templates. " +
  "Built for legal teams and the agents helping them.";
const CONTEXT =
  "Every practice guide cites primary law; templates start from recognized " +
  "standard forms (Common Paper, Bonterms, NVCA, YC SAFE) and keep source, " +
  "license, and validation context with each document. Plain markdown here, " +
  "machine-readable JSON/CSV twins on openagreements.org. This is legal " +
  "information, not legal advice — consult an attorney.";

const library = buildLibrary({ rootDir: root });
const catalog = buildCatalog({ rootDir: root });

function optionalSection() {
  return [
    "## Optional",
    "",
    `- [Using OpenAgreements with AI agents & MCP](${blobUrl("docs/supported-tools.md")}): local + hosted MCP servers, agent skills, and the CLI for programmatic template filling`,
    `- [openagreements.org](${LPL}): machine-readable JSON/CSV twins of every guide, survey, checklist, and template`,
    `- [Contributing](${blobUrl("CONTRIBUTING.md")}): propose a form source, request coverage, or open a pull request`,
  ];
}

// ---- llms.txt : concise curated index -------------------------------------
function buildLlmsTxt() {
  const lines = [`# OpenAgreements`, "", `> ${SUMMARY}`, "", CONTEXT, ""];

  lines.push("## Practice Guides", "");
  for (const g of library.practiceGuides) {
    lines.push(`- [${g.label}](${liveUrl(g)}): ${g.blurb} (${g.coverage})`);
  }
  lines.push("");

  lines.push("## Law Surveys", "");
  for (const s of library.surveys) {
    lines.push(`- [${s.title}](${surveyUrl(s)})`);
  }
  lines.push("");

  lines.push("## Checklists", "");
  for (const c of library.checklists) {
    lines.push(`- [${c.label}](${liveUrl(c)}): ${c.blurb}`);
  }
  lines.push("");

  lines.push("## Templates", "");
  for (const category of catalog.categories) {
    lines.push(
      `- [${category.label}](${treeUrl("templates")}) (${category.count}): ${category.description}`,
    );
  }
  lines.push("");

  lines.push(...optionalSection(), "");
  return lines.join("\n");
}

// ---- llms-full.txt : full enumeration -------------------------------------
function buildLlmsFullTxt() {
  const lines = [`# OpenAgreements`, "", `> ${SUMMARY}`, "", CONTEXT, ""];

  lines.push("## Practice Guides", "");
  for (const g of library.practiceGuides) {
    lines.push(`- [${g.label}](${liveUrl(g)}): ${g.blurb} (${g.coverage})`);
  }
  lines.push("");

  lines.push("## Law Surveys", "");
  for (const s of library.surveys) {
    lines.push(`- [${s.title}](${surveyUrl(s)})`);
  }
  lines.push("");

  lines.push("## Checklists", "");
  for (const c of library.checklists) {
    lines.push(`- [${c.label}](${liveUrl(c)}): ${c.blurb}`);
  }
  lines.push("");

  lines.push("## Templates", "");
  for (const category of catalog.categories) {
    const catTemplates = catalog.templates.filter(
      (t) => t.category === category.slug,
    );
    if (catTemplates.length === 0) continue;
    lines.push(`### ${category.label}`, "");
    for (const t of catTemplates) {
      const kind = t.isFieldSelector ? "field-selector" : t.license;
      lines.push(
        `- [${t.displayName}](${treeUrl(t.repoPath)}): ${t.sourceLabel} · ${kind} — ${t.description}`,
      );
    }
    lines.push("");
  }

  lines.push(...optionalSection(), "");
  return lines.join("\n");
}

const outputs = [
  ["llms.txt", buildLlmsTxt()],
  ["llms-full.txt", buildLlmsFullTxt()],
];

const checkMode = process.argv.includes("--check");
let drift = false;
for (const [name, content] of outputs) {
  const path = resolve(root, name);
  if (checkMode) {
    let current = "";
    try {
      current = readFileSync(path, "utf-8");
    } catch {
      current = "";
    }
    if (current !== content) {
      drift = true;
      console.error(`DRIFT: ${name} is out of sync. Run "npm run generate:llms".`);
    }
  } else {
    writeFileSync(path, content);
    console.log(`Generated ${path}`);
  }
}

if (checkMode) {
  if (drift) process.exit(1);
  console.log("PASS llms.txt / llms-full.txt are in sync.");
}

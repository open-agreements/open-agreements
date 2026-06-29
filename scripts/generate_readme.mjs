#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCatalog } from "./lib/catalog-data.mjs";
import { loadSkillsCatalog } from "./lib/skills-data.mjs";
import { buildLibrary } from "./lib/library-data.mjs";
import docsNav from "../site/_data/docsNav.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const rootPackage = readJson(resolve(root, "package.json"));

const README_TEMPLATE_PATH = resolve(root, "README.template.md");
const README_PATH = resolve(root, "README.md");
const REPO_BASE_URL = "https://github.com/open-agreements/open-agreements";
const README_CONFIG = rootPackage.readmeConfig || {};
const WEBSITE_URL = normalizeUrl(README_CONFIG.websiteUrl, "websiteUrl");
const TEMPLATE_CATALOG_URL = normalizeUrl(
  README_CONFIG.templateCatalogUrl,
  "templateCatalogUrl",
);
const DOCUMENTATION_INDEX_URL = normalizeUrl(
  README_CONFIG.documentationIndexUrl,
  "documentationIndexUrl",
);
const DOCUMENTATION_BASE_URL = normalizeUrl(
  README_CONFIG.documentationBaseUrl,
  "documentationBaseUrl",
);
const TRUST_URL = normalizeUrl(README_CONFIG.trustUrl, "trustUrl");
// Content host for the Legal Practice Library. Deliberately separate from
// websiteUrl/templateCatalogUrl (usejunior.com) — the practice guides, surveys,
// and checklists live on openagreements.org.
const LEGAL_PRACTICE_LIBRARY_URL = normalizeUrl(
  README_CONFIG.legalPracticeLibraryUrl,
  "legalPracticeLibraryUrl",
);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function normalizeUrl(value, key) {
  if (!value || typeof value !== "string") {
    throw new Error(`package.json readmeConfig is missing '${key}'.`);
  }
  return value.replace(/\/$/, "");
}

// UTM-tag links to usejunior.com so README-driven traffic shows up as
// utm_source=github (instead of collapsing into the GA4 Direct bucket).
// Only tags usejunior.com hosts; pass-through for GitHub, Bonterms, CC, etc.
const README_UTM_PARAMS = "utm_source=github&utm_medium=readme&utm_campaign=open-agreements";
function withUtm(url) {
  if (typeof url !== "string" || !/^https?:\/\/usejunior\.com(\/|$|\?|#)/.test(url)) {
    return url;
  }
  const hashIndex = url.indexOf("#");
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${README_UTM_PARAMS}${hash}`;
}

const CONTENTS = [
  ["Legal Practice Library", "#legal-practice-library"],
  ["Templates", "#available-templates"],
  ["Checklists", "#checklists"],
  ["Law Surveys", "#law-surveys"],
  ["For AI Agents", "#for-ai-agents"],
  ["Available Skills", "#available-skills"],
  ["Template Filling via MCP", "#template-filling-via-mcp"],
  ["Packages", "#packages"],
  ["Install", "#install"],
  ["Documentation", "#documentation"],
  ["Privacy", "#privacy"],
  ["See Also", "#see-also"],
  ["Roadmap", "#roadmap"],
  ["Contributing", "#contributing"],
  ["Built With OpenAgreements", "#built-with-openagreements"],
  ["License", "#license"],
];

function githubTreeUrl(repoPath) {
  return `${REPO_BASE_URL}/tree/main/${repoPath}`;
}

function githubBlobUrl(repoPath) {
  return `${REPO_BASE_URL}/blob/main/${repoPath}`;
}

function renderTable(headers, rows) {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `|${headers.map((header) => "-".repeat(Math.max(3, header.length + 2))).join("|")}|`;
  const rowLines = rows.map((row) => `| ${row.join(" | ")} |`);
  return [headerLine, separatorLine, ...rowLines].join("\n");
}

const LICENSE_URLS = {
  "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC-BY-ND-4.0": "https://creativecommons.org/licenses/by-nd/4.0/",
};

function formatLicenseCell(license) {
  if (!license || license === "Recipe") return "Recipe";
  const url = LICENSE_URLS[license];
  return url ? `[${license}](${url})` : license;
}

function formatSourceCell(template) {
  const url = template.sourceDocUrl || template.sourceUrl;
  if (url) return `[${template.sourceLabel}](${url})`;
  return template.sourceLabel;
}

function renderContents() {
  return CONTENTS.map(([label, anchor]) => `- [${label}](${anchor})`).join("\n");
}

function libraryUrl(path) {
  return `${LEGAL_PRACTICE_LIBRARY_URL}${path}`;
}

function renderLegalPracticeLibrary() {
  const library = buildLibrary({ rootDir: root });
  const lines = [];
  lines.push(
    `Primary-source-backed legal practice guides, projected from openagreements.org as plain markdown under [\`legal-practice-library/\`](${githubTreeUrl("legal-practice-library")}). Each guide cites primary law and links to its canonical page (with machine-readable twins — see [For AI Agents](#for-ai-agents)).`,
  );
  lines.push("");
  lines.push(
    renderTable(
      ["Topic", "What it covers", "Coverage", "Browse", "Live"],
      library.practiceGuides.map((section) => [
        section.label,
        section.blurb,
        section.coverage,
        `[Markdown](${githubTreeUrl(section.repoPath)})`,
        `[Web](${libraryUrl(section.live)})`,
      ]),
    ),
  );
  lines.push("");
  lines.push(
    `Backed by ${library.caseExcerptCount} verbatim [case excerpts](${githubTreeUrl("legal-practice-library/case-excerpts")}) — the passages our practice guides rely on, each linked to the full opinion on CourtListener. Supporting evidence, not a case database.`,
  );
  return lines.join("\n").trim();
}

function renderLawSurveys() {
  const library = buildLibrary({ rootDir: root });
  const lines = [];
  lines.push(
    "Side-by-side comparison tables across jurisdictions. The web pages also publish machine-readable `.json` and `.csv` twins (append `.json` / `.csv`, e.g. `/surveys/non-compete/us.csv`).",
  );
  lines.push("");
  lines.push(
    renderTable(
      ["Survey", "Browse", "Live"],
      library.surveys.map((survey) => [
        survey.title,
        `[Markdown](${githubBlobUrl(survey.repoPath)})`,
        survey.resource ? `[Web](${survey.resource})` : "—",
      ]),
    ),
  );
  return lines.join("\n").trim();
}

function renderChecklists() {
  const library = buildLibrary({ rootDir: root });
  const lines = [];
  lines.push(
    "Clause-by-clause reviewer checklists. Each has `.json` and `.docx` twins on the web, and contract checklists also emit a `contract-api.json` for template integrations.",
  );
  lines.push("");
  lines.push(
    renderTable(
      ["Topic", "What it covers", "Browse", "Live"],
      library.checklists.map((section) => [
        section.label,
        section.blurb,
        `[Markdown](${githubTreeUrl(section.repoPath)})`,
        `[Web](${libraryUrl(section.live)})`,
      ]),
    ),
  );
  return lines.join("\n").trim();
}

function renderSkills() {
  const catalog = loadSkillsCatalog({ rootDir: root });
  const lines = [];

  lines.push(
    "Install any skill by name (paths below are for browsing only — installs are name-based and survive reorganization):",
  );
  lines.push("");
  lines.push("```bash");
  lines.push("npx skills add open-agreements/open-agreements --skill <skill-name>");
  lines.push("```");
  lines.push("");

  for (const group of catalog.groups) {
    lines.push(`### ${group.title}`);
    lines.push("");
    lines.push(
      renderTable(
        ["Skill", "Description"],
        group.skills.map((skill) => {
          const skillPath = resolve(root, skill.path, "SKILL.md");
          if (!existsSync(skillPath)) {
            throw new Error(`Skills catalog references missing skill '${skill.slug}'.`);
          }
          return [
            `[${skill.label}](${githubTreeUrl(skill.path)})`,
            skill.description,
          ];
        }),
      ),
    );
    lines.push("");
  }

  lines.push(
    "Internal repo-maintenance skills (marked `internal: true` in their SKILL.md metadata) are excluded from this catalog and from default `npx skills add` installs.",
  );
  lines.push("");

  return lines.join("\n").trim();
}

function makeTemplateLabel(template, duplicateCounts) {
  if ((duplicateCounts.get(template.displayName) || 0) <= 1) {
    return template.displayName;
  }
  return `${template.sourceLabel} ${template.displayName}`;
}

function renderTemplates() {
  const catalog = buildCatalog({ rootDir: root });
  const duplicateCounts = new Map();
  for (const template of catalog.templates) {
    duplicateCounts.set(
      template.displayName,
      (duplicateCounts.get(template.displayName) || 0) + 1,
    );
  }

  const lines = [];
  for (const category of catalog.categories) {
    const templates = catalog.templates.filter(
      (template) => template.category === category.slug,
    );
    if (templates.length === 0) {
      continue;
    }

    lines.push(`### ${category.label}`);
    lines.push("");
    lines.push(
      renderTable(
        ["Template", "Website", "Source", "License", "Repo"],
        templates.map((template) => {
          const websiteUrl = withUtm(`${TEMPLATE_CATALOG_URL}/${template.id}`);
          return [
            makeTemplateLabel(template, duplicateCounts),
            `[Website](${websiteUrl})`,
            formatSourceCell(template),
            formatLicenseCell(template.license),
            `[Repo](${githubTreeUrl(template.repoPath)})`,
          ];
        }),
      ),
    );
    lines.push("");
  }

  return lines.join("\n").trim();
}

function renderPackages() {
  const rows = [
    [
      `[${rootPackage.name}](https://www.npmjs.com/package/${rootPackage.name})`,
      rootPackage.readme_description || rootPackage.description,
    ],
  ];

  for (const workspacePath of rootPackage.workspaces || []) {
    const packageJsonPath = resolve(root, workspacePath, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }
    const packageJson = readJson(packageJsonPath);
    const readmeRepoPath = `${workspacePath}/README.md`;
    if (!existsSync(resolve(root, readmeRepoPath))) {
      continue;
    }
    rows.push([
      `[${packageJson.name}](${githubBlobUrl(readmeRepoPath)})`,
      packageJson.readme_description || packageJson.description,
    ]);
  }

  return renderTable(["Package", "Description"], rows);
}

function renderDocumentation() {
  const groups = docsNav();
  const lines = [];
  for (const group of groups) {
    lines.push(`### ${group.section}`);
    lines.push("");
    for (const item of group.items) {
      lines.push(`- [${item.title}](${DOCUMENTATION_BASE_URL}/${item.slug}.md)`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function renderLinks() {
  return `**Links:** [Website](${withUtm(WEBSITE_URL)}) | [Template Catalog](${withUtm(TEMPLATE_CATALOG_URL)}) | [Docs](${DOCUMENTATION_INDEX_URL}) | [Trust](${withUtm(TRUST_URL)}) | [npm](https://www.npmjs.com/package/${rootPackage.name})`;
}

function renderTemplate(template, replacements) {
  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.replaceAll(`{{${key}}}`, value);
  }

  const unreplaced = output.match(/\{\{[A-Z_]+\}\}/g);
  if (unreplaced) {
    throw new Error(`Unreplaced README template placeholders: ${unreplaced.join(", ")}`);
  }

  return output;
}

// Assemble the full README markdown from the template plus live repo metadata
// and return it as a string. Pure (no file writes) so tests can call it
// repeatedly to assert determinism and compare against the committed README.
export function buildReadme() {
  const template = readFileSync(README_TEMPLATE_PATH, "utf-8").trim();
  const rendered = renderTemplate(template, {
    CONTENTS: renderContents(),
    LEGAL_PRACTICE_LIBRARY: renderLegalPracticeLibrary(),
    LAW_SURVEYS: renderLawSurveys(),
    CHECKLISTS: renderChecklists(),
    AVAILABLE_SKILLS: renderSkills(),
    AVAILABLE_TEMPLATES: renderTemplates(),
    PACKAGES: renderPackages(),
    DOCUMENTATION: renderDocumentation(),
    LINKS: renderLinks(),
  });

  return [
    "<!-- This file is generated from README.template.md by scripts/generate_readme.mjs. Do not edit README.md directly. -->",
    "",
    rendered,
    "",
  ].join("\n");
}

function main() {
  writeFileSync(README_PATH, buildReadme());
  console.log(`Generated ${README_PATH}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

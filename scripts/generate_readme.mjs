#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCatalog } from "./lib/catalog-data.mjs";
import { loadPackagesCatalog } from "./lib/packages-data.mjs";
import { loadSkillsCatalog } from "./lib/skills-data.mjs";
import docsNav from "../site/_data/docsNav.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const README_TEMPLATE_PATH = resolve(root, "README.template.md");
const README_PATH = resolve(root, "README.md");
const SITE_URL = "https://usejunior.com";
const REPO_BASE_URL = "https://github.com/open-agreements/open-agreements";

const CONTENTS = [
  ["Install", "#install"],
  ["Quick Start", "#quick-start"],
  ["Available Skills", "#available-skills"],
  ["Available Templates", "#available-templates"],
  ["Packages", "#packages"],
  ["Documentation", "#documentation"],
  ["Privacy", "#privacy"],
  ["See Also", "#see-also"],
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

function renderContents() {
  return CONTENTS.map(([label, anchor]) => `- [${label}](${anchor})`).join("\n");
}

function renderSkills() {
  const catalog = loadSkillsCatalog({ rootDir: root });
  const lines = [];

  for (const group of catalog.groups) {
    lines.push(`### ${group.title}`);
    lines.push("");
    lines.push(
      renderTable(
        ["Skill", "Description"],
        group.skills.map((skill) => {
          const skillPath = resolve(root, "skills", skill.slug, "SKILL.md");
          if (!existsSync(skillPath)) {
            throw new Error(`skills/catalog.yaml references missing skill '${skill.slug}'.`);
          }
          return [
            `[${skill.label}](${githubTreeUrl(`skills/${skill.slug}`)})`,
            skill.description,
          ];
        }),
      ),
    );
    lines.push("");
  }

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
        ["Template", "Website", "Repo"],
        templates.map((template) => {
          const websiteUrl = template.hasPreview
            ? `${SITE_URL}/templates/${template.id}/`
            : `${SITE_URL}/?template=${template.id}#start`;
          return [
            makeTemplateLabel(template, duplicateCounts),
            `[Website](${websiteUrl})`,
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
  const rows = loadPackagesCatalog({ rootDir: root }).map((entry) => {
    const href = entry.href || githubBlobUrl(entry.readmePath);
    return [`[${entry.name}](${href})`, entry.description];
  });

  return renderTable(["Package", "Description"], rows);
}

function renderDocumentation() {
  const groups = docsNav();
  const lines = [];
  for (const group of groups) {
    lines.push(`### ${group.section}`);
    lines.push("");
    for (const item of group.items) {
      lines.push(`- [${item.title}](${SITE_URL}/docs/${item.slug}/)`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
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

function main() {
  const template = readFileSync(README_TEMPLATE_PATH, "utf-8").trim();
  const rendered = renderTemplate(template, {
    CONTENTS: renderContents(),
    AVAILABLE_SKILLS: renderSkills(),
    AVAILABLE_TEMPLATES: renderTemplates(),
    PACKAGES: renderPackages(),
    DOCUMENTATION: renderDocumentation(),
  });

  const output = [
    "<!-- This file is generated from README.template.md by scripts/generate_readme.mjs. Do not edit README.md directly. -->",
    "",
    rendered,
    "",
  ].join("\n");

  writeFileSync(README_PATH, output);
  console.log(`Generated ${README_PATH}`);
}

main();

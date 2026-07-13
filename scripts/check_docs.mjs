#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import docsNav from "./lib/docs-nav.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkedRoots = ["README.md", "CONTRIBUTING.md", "SECURITY.md", "CODE_OF_CONDUCT.md", "docs"];
const markdownLinkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
const failures = [];

function walk(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return extname(path) === ".md" ? [path] : [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    return walk(join(path, entry.name));
  });
}

function stripHtmlTags(text) {
  let output = "";
  let pendingTag = "";

  for (const character of text) {
    if (pendingTag) {
      pendingTag += character;
      if (character === ">") pendingTag = "";
    } else if (character === "<") {
      pendingTag = character;
    } else {
      output += character;
    }
  }

  return output + pendingTag;
}

function githubSlug(text) {
  const markdownText = text
    .trim()
    .toLowerCase()
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "");

  return stripHtmlTags(markdownText)
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function anchorsFor(path) {
  const counts = new Map();
  const anchors = new Set();
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (!match) continue;
    const base = githubSlug(match[1]);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

function checkLink(source, rawTarget) {
  const target = rawTarget.replace(/^<|>$/g, "");
  if (/^(?:https?:|mailto:|tel:|data:)/i.test(target)) return;

  const [rawPath, fragment] = target.split("#", 2);
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    failures.push(`${relative(root, source)}: invalid URL encoding in ${target}`);
    return;
  }

  const destination = decodedPath
    ? resolve(dirname(source), decodedPath)
    : source;
  if (!existsSync(destination)) {
    failures.push(`${relative(root, source)}: missing target ${target}`);
    return;
  }

  if (fragment && statSync(destination).isFile() && extname(destination) === ".md") {
    const anchor = decodeURIComponent(fragment).toLowerCase();
    if (!anchorsFor(destination).has(anchor)) {
      failures.push(`${relative(root, source)}: missing heading #${fragment} in ${relative(root, destination)}`);
    }
  }
}

const markdownFiles = checkedRoots.flatMap((path) => walk(resolve(root, path)));
for (const source of markdownFiles) {
  const body = readFileSync(source, "utf-8");
  for (const match of body.matchAll(markdownLinkPattern)) {
    checkLink(source, match[1]);
  }
}

for (const group of docsNav()) {
  for (const item of group.items) {
    const target = resolve(root, "docs", `${item.slug}.md`);
    if (!existsSync(target)) {
      failures.push(`docs navigation '${group.section} > ${item.title}' points to missing docs/${item.slug}.md`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Documentation checks failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Documentation checks passed (${markdownFiles.length} Markdown files, local links and navigation verified).`);

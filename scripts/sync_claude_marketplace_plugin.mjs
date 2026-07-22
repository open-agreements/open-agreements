import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const pluginRoot = join(repoRoot, "plugins", "open-agreements");
const pluginSkillsRoot = join(pluginRoot, "skills");

const includedSkills = [
  ["skills/agreements/open-agreements", "open-agreements"],
  ["skills/legal-explainers/non-compete-contract-explainer", "non-compete-contract-explainer"],
  ["skills/legal-explainers/data-privacy-law-explainer", "data-privacy-law-explainer"],
];

const includedRootFiles = ["LICENSE", "NOTICE"];

function listFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const file = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(file));
    } else if (entry.isFile()) {
      files.push(file);
    }
  }
  return files.sort();
}

function expectedFiles() {
  const expected = new Map();
  for (const [sourceRelative, slug] of includedSkills) {
    const sourceRoot = join(repoRoot, sourceRelative);
    for (const sourceFile of listFiles(sourceRoot)) {
      const targetRelative = join(slug, relative(sourceRoot, sourceFile));
      expected.set(targetRelative, sourceFile);
    }
  }
  return expected;
}

function check() {
  const expected = expectedFiles();
  const actual = listFiles(pluginSkillsRoot).map((file) => relative(pluginSkillsRoot, file));
  const expectedPaths = [...expected.keys()].sort();
  const problems = [];

  if (JSON.stringify(actual) !== JSON.stringify(expectedPaths)) {
    const actualSet = new Set(actual);
    const expectedSet = new Set(expectedPaths);
    for (const file of expectedPaths.filter((item) => !actualSet.has(item))) {
      problems.push(`missing ${file}`);
    }
    for (const file of actual.filter((item) => !expectedSet.has(item))) {
      problems.push(`unexpected ${file}`);
    }
  }

  for (const [targetRelative, sourceFile] of expected) {
    const targetFile = join(pluginSkillsRoot, targetRelative);
    if (existsSync(targetFile) && !readFileSync(targetFile).equals(readFileSync(sourceFile))) {
      problems.push(`stale ${targetRelative}`);
    }
  }

  for (const filename of includedRootFiles) {
    const sourceFile = join(repoRoot, filename);
    const targetFile = join(pluginRoot, filename);
    if (!existsSync(targetFile)) {
      problems.push(`missing ${filename}`);
    } else if (!readFileSync(targetFile).equals(readFileSync(sourceFile))) {
      problems.push(`stale ${filename}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Claude marketplace plugin is stale; run npm run generate:claude-plugin:\n${problems.join("\n")}`,
    );
  }
  console.log(`Claude marketplace plugin is current (${expectedPaths.length} files).`);
}

function generate() {
  rmSync(pluginSkillsRoot, { recursive: true, force: true });
  mkdirSync(pluginSkillsRoot, { recursive: true });
  for (const [sourceRelative, slug] of includedSkills) {
    cpSync(join(repoRoot, sourceRelative), join(pluginSkillsRoot, slug), { recursive: true });
  }
  for (const filename of includedRootFiles) {
    cpSync(join(repoRoot, filename), join(pluginRoot, filename));
  }
  check();
}

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--check")) {
  throw new Error(`Unknown argument: ${args.find((arg) => arg !== "--check")}`);
}

if (args.includes("--check")) check();
else generate();

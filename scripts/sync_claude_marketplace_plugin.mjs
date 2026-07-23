import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { load as parseYaml } from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultPluginRoot = join(repoRoot, "plugins", "open-agreements");

const privacySlugs = [
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "district-of-columbia",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new-hampshire",
  "new-jersey",
  "new-mexico",
  "new-york",
  "north-carolina",
  "north-dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode-island",
  "south-carolina",
  "south-dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west-virginia",
  "wisconsin",
  "wyoming",
];

const nonCompeteSlugs = [
  "alabama",
  "alaska",
  "american-samoa",
  "arizona",
  "arkansas",
  "au",
  "australian-capital-territory",
  "california",
  "cnmi",
  "colorado",
  "connecticut",
  "delaware",
  "district-of-columbia",
  "florida",
  "georgia",
  "guam",
  "hawaii",
  "idaho",
  "illinois",
  "in",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new-hampshire",
  "new-jersey",
  "new-mexico",
  "new-south-wales",
  "new-york",
  "north-carolina",
  "north-dakota",
  "northern-territory",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "ph",
  "puerto-rico",
  "queensland",
  "rhode-island",
  "sg",
  "south-australia",
  "south-carolina",
  "south-dakota",
  "tasmania",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "victoria",
  "virgin-islands",
  "virginia",
  "washington",
  "west-virginia",
  "western-australia",
  "wisconsin",
  "wyoming",
];

const skillSpecs = [
  {
    source: "skills/agreements/open-agreements",
    target: "open-agreements",
    files: ["CONNECTORS.md", "SKILL.md", "template-filling-execution.md"],
  },
  {
    source: "skills/legal-explainers/non-compete-contract-explainer",
    target: "non-compete-contract-explainer",
    files: [
      "LICENSE",
      "NOTICE",
      "SKILL.md",
      "manifest.json",
      ...nonCompeteSlugs.map((slug) => `content/${slug}.md`),
    ],
  },
  {
    source: "skills/legal-explainers/data-privacy-law-explainer",
    target: "data-privacy-law-explainer",
    files: [
      "LICENSE",
      "NOTICE",
      "SKILL.md",
      "manifest.json",
      ...privacySlugs.map((slug) => `content/${slug}.md`),
    ],
  },
];

const staticPluginFiles = [
  ".claude-plugin/plugin.json",
  "LICENSE",
  "NOTICE",
  "README.md",
];

const scriptExtensions = new Set([".bash", ".cjs", ".js", ".mjs", ".ps1", ".py", ".sh", ".ts"]);
const credentialPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[opsu]_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][^"']+["']/i,
];
const absoluteFilesystemPath =
  /(?:^|[\s"'`(])\/(?:Users|home|root|private|tmp|var|etc)\/[A-Za-z0-9._/-]+/m;

function portable(path) {
  return path.split(sep).join("/");
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const file = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(file));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      files.push(file);
    }
  }
  return files.sort();
}

function projectedFiles() {
  const projected = new Map();
  for (const spec of skillSpecs) {
    for (const file of spec.files) {
      projected.set(
        portable(join("skills", spec.target, file)),
        join(repoRoot, spec.source, file),
      );
    }
  }
  projected.set("LICENSE", join(repoRoot, "LICENSE"));
  return projected;
}

function expectedPluginFiles() {
  return new Set([
    ...staticPluginFiles,
    ...projectedFiles().keys(),
  ]);
}

function inspectForbiddenContent(pluginRoot, relativePath, problems) {
  const lower = relativePath.toLowerCase();
  const parts = lower.split("/");
  const absolute = join(pluginRoot, relativePath);
  const stat = lstatSync(absolute);

  if (stat.isSymbolicLink()) problems.push(`forbidden symlink ${relativePath}`);
  if (parts.includes("internal")) problems.push(`forbidden internal path ${relativePath}`);
  if (parts[0] === "hooks" || parts[0] === "agents" || parts[0] === "scripts") {
    problems.push(`forbidden component path ${relativePath}`);
  }
  if (parts.at(-1) === ".mcp.json") problems.push(`forbidden MCP configuration ${relativePath}`);
  if (scriptExtensions.has(extname(lower)) || (stat.mode & 0o111) !== 0) {
    problems.push(`forbidden executable or script ${relativePath}`);
  }

  const contents = readFileSync(absolute, "utf8");
  if (absoluteFilesystemPath.test(contents)) {
    problems.push(`forbidden absolute filesystem path in ${relativePath}`);
  }
  if (credentialPatterns.some((pattern) => pattern.test(contents))) {
    problems.push(`possible credential in ${relativePath}`);
  }
}

function checkVersions(problems) {
  const rootManifest = JSON.parse(readFileSync(join(repoRoot, ".claude-plugin", "plugin.json"), "utf8"));
  const pluginManifest = JSON.parse(
    readFileSync(join(defaultPluginRoot, ".claude-plugin", "plugin.json"), "utf8"),
  );
  const semver = /^\d+\.\d+\.\d+$/;
  if (!semver.test(rootManifest.version) || !semver.test(pluginManifest.version)) {
    problems.push("plugin manifests must use semantic versions");
  }
  if (rootManifest.version !== pluginManifest.version) {
    problems.push(
      `plugin manifest versions differ (${rootManifest.version} versus ${pluginManifest.version})`,
    );
  }
}

function parseFrontMatter(file) {
  const contents = readFileSync(file, "utf8");
  const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`missing YAML front matter in ${portable(relative(repoRoot, file))}`);
  return parseYaml(match[1]);
}

function checkExplainerManifest(skillRoot, expectedSlugs, problems) {
  const manifestFile = join(skillRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const entries = manifest.jurisdictions;
  const relativeRoot = portable(relative(repoRoot, skillRoot));

  if (!Array.isArray(entries)) {
    problems.push(`${relativeRoot}/manifest.json must contain a jurisdictions array`);
    return;
  }

  const expected = new Set(expectedSlugs);
  const actual = new Set(entries.map((entry) => entry.slug));
  if (entries.length !== expectedSlugs.length || actual.size !== expectedSlugs.length) {
    problems.push(
      `${relativeRoot}/manifest.json must contain ${expectedSlugs.length} unique jurisdictions`,
    );
  }
  for (const slug of expectedSlugs) {
    if (!actual.has(slug)) problems.push(`${relativeRoot}/manifest.json missing ${slug}`);
  }
  for (const slug of actual) {
    if (!expected.has(slug)) problems.push(`${relativeRoot}/manifest.json has unexpected ${slug}`);
  }

  for (const entry of entries) {
    const expectedFile = `content/${entry.slug}.md`;
    if (entry.file !== expectedFile) {
      problems.push(`${relativeRoot}/manifest.json has invalid file for ${entry.slug}`);
      continue;
    }

    const contentFile = join(skillRoot, expectedFile);
    if (!existsSync(contentFile)) continue;
    let frontMatter;
    try {
      frontMatter = parseFrontMatter(contentFile);
    } catch (error) {
      problems.push(error.message);
      continue;
    }

    for (const field of [
      "slug",
      "jurisdiction",
      "countryCode",
      "canonicalUrl",
      "lawReviewedThrough",
      "stale",
    ]) {
      if (frontMatter[field] !== entry[field]) {
        problems.push(`${relativeRoot}/${expectedFile} disagrees with manifest field ${field}`);
      }
    }
    if (frontMatter.exportedAt !== manifest.exportedAt) {
      problems.push(`${relativeRoot}/${expectedFile} disagrees with manifest exportedAt`);
    }
  }
}

export function checkPlugin(pluginRoot = defaultPluginRoot) {
  const expected = expectedPluginFiles();
  const actual = listFiles(pluginRoot).map((file) => portable(relative(pluginRoot, file)));
  const problems = [];

  for (const file of [...expected].filter((item) => !actual.includes(item)).sort()) {
    problems.push(`missing ${file}`);
  }
  for (const file of actual.filter((item) => !expected.has(item)).sort()) {
    problems.push(`unexpected ${file}`);
  }

  for (const relativePath of actual) {
    inspectForbiddenContent(pluginRoot, relativePath, problems);
  }

  for (const [targetRelative, sourceFile] of projectedFiles()) {
    const targetFile = join(pluginRoot, targetRelative);
    if (existsSync(targetFile) && !readFileSync(targetFile).equals(readFileSync(sourceFile))) {
      problems.push(`stale ${targetRelative}`);
    }
  }

  if (pluginRoot === defaultPluginRoot) {
    checkVersions(problems);
    checkExplainerManifest(
      join(repoRoot, "skills", "legal-explainers", "data-privacy-law-explainer"),
      privacySlugs,
      problems,
    );
    checkExplainerManifest(
      join(repoRoot, "skills", "legal-explainers", "non-compete-contract-explainer"),
      nonCompeteSlugs,
      problems,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Claude marketplace plugin failed its allowlist/security check; run npm run generate:claude-plugin when appropriate:\n${problems.join("\n")}`,
    );
  }

  console.log(`Claude marketplace plugin is current and allowlisted (${actual.length} files).`);
}

export function generatePlugin(pluginRoot = defaultPluginRoot) {
  const pluginSkillsRoot = join(pluginRoot, "skills");
  rmSync(pluginSkillsRoot, { recursive: true, force: true });

  for (const spec of skillSpecs) {
    for (const file of spec.files) {
      const source = join(repoRoot, spec.source, file);
      const target = join(pluginSkillsRoot, spec.target, file);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(source, target);
    }
  }

  cpSync(join(repoRoot, "LICENSE"), join(pluginRoot, "LICENSE"));
  checkPlugin(pluginRoot);
}

function runCli() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check")) {
    throw new Error(`Unknown argument: ${args.find((arg) => arg !== "--check")}`);
  }
  if (args.includes("--check")) checkPlugin();
  else generatePlugin();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runCli();

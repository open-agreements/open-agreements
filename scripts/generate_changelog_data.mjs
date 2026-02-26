#!/usr/bin/env node

/**
 * Generate public changelog data used by the Trust changelog page.
 *
 * Primary source:
 *   - GitHub Releases API (public, optionally authenticated)
 *
 * Fallback source:
 *   - Local git tags plus commit subject summaries
 *
 * Output:
 *   - site/_data/changelog.json
 *
 * Usage:
 *   node scripts/generate_changelog_data.mjs
 *   node scripts/generate_changelog_data.mjs --max-releases 15 --output site/_data/changelog.json
 *   node scripts/generate_changelog_data.mjs --repo open-agreements/open-agreements
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const DEFAULT_REPO = "open-agreements/open-agreements";
const DEFAULT_MAX_RELEASES = 12;
const GITHUB_API_ROOT = "https://api.github.com";

function parseArgs() {
  const args = process.argv.slice(2);
  let outputPath = resolve(REPO_ROOT, "site", "_data", "changelog.json");
  let maxReleases = DEFAULT_MAX_RELEASES;
  let repo = DEFAULT_REPO;
  let includePrereleases = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output") {
      const value = args[i + 1];
      if (!value) throw new Error("--output requires a path value");
      outputPath = resolve(process.cwd(), value);
      i++;
      continue;
    }
    if (args[i] === "--max-releases") {
      maxReleases = parsePositiveInteger(args[i + 1], "--max-releases");
      i++;
      continue;
    }
    if (args[i] === "--repo") {
      const value = args[i + 1];
      if (!value) throw new Error("--repo requires a value in owner/name format");
      if (!/^[^/\s]+\/[^/\s]+$/.test(value)) {
        throw new Error("--repo must use owner/name format");
      }
      repo = value;
      i++;
      continue;
    }
    if (args[i] === "--include-prereleases") {
      includePrereleases = true;
      continue;
    }
    throw new Error(`Unknown argument: ${args[i]}`);
  }

  return { outputPath, maxReleases, repo, includePrereleases };
}

function parsePositiveInteger(rawValue, flagName) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flagName} requires a positive integer`);
  }
  return value;
}

function getGithubToken() {
  return process.env.CHANGELOG_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
}

function toDateOnly(isoUtc) {
  if (!isoUtc) return null;
  const parsed = new Date(isoUtc);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toVersion(tag) {
  if (!tag || typeof tag !== "string") return null;
  return tag.replace(/^v/i, "");
}

function runGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function runGitLines(args) {
  const output = runGit(args);
  if (!output) return [];
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isSemverTag(tag) {
  return /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/.test(tag);
}

function isPrereleaseTag(tag) {
  return tag.includes("-");
}

function buildFallbackNotesForTag(currentTag, previousTag) {
  const range = previousTag ? `${previousTag}..${currentTag}` : currentTag;
  const subjects = runGitLines([
    "log",
    range,
    "--pretty=format:%s",
    "--no-merges",
    "--max-count",
    "20",
  ]);

  if (subjects.length === 0) {
    return "";
  }

  return subjects.map((subject) => `- ${subject}`).join("\n");
}

function buildFallbackReleases({ maxReleases, includePrereleases, repo }) {
  const tags = runGitLines(["tag", "--sort=-creatordate"])
    .filter(isSemverTag)
    .filter((tag) => includePrereleases || !isPrereleaseTag(tag))
    .slice(0, maxReleases);

  return tags.map((tag, index) => {
    const previousTag = tags[index + 1] ?? null;
    const publishedAtUtc = runGit(["log", "-1", "--format=%cI", tag]);
    const notes = buildFallbackNotesForTag(tag, previousTag);

    return {
      tag,
      version: toVersion(tag),
      title: tag,
      published_at_utc: publishedAtUtc ?? null,
      published_on: toDateOnly(publishedAtUtc),
      url: `https://github.com/${repo}/releases/tag/${tag}`,
      notes,
      notes_available: notes.length > 0,
      prerelease: isPrereleaseTag(tag),
      source: "git-tag-fallback",
    };
  });
}

function normalizeGithubRelease(release, repo) {
  const tag = typeof release.tag_name === "string" ? release.tag_name.trim() : "";
  const publishedAtUtc = release.published_at ?? release.created_at ?? null;
  const notes = typeof release.body === "string" ? release.body.trim() : "";
  const title = typeof release.name === "string" && release.name.trim()
    ? release.name.trim()
    : (tag || "Untitled release");

  return {
    tag: tag || null,
    version: toVersion(tag),
    title,
    published_at_utc: publishedAtUtc,
    published_on: toDateOnly(publishedAtUtc),
    url: release.html_url || (tag ? `https://github.com/${repo}/releases/tag/${tag}` : `https://github.com/${repo}/releases`),
    notes,
    notes_available: notes.length > 0,
    prerelease: Boolean(release.prerelease),
    source: "github-release",
  };
}

async function fetchGithubReleases({ repo, maxReleases, includePrereleases }) {
  const perPage = Math.min(maxReleases, 50);
  const token = getGithubToken();
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "open-agreements-changelog-generator",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${GITHUB_API_ROOT}/repos/${repo}/releases?per_page=${perPage}`;
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`GitHub Releases API returned ${response.status} for ${url}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("GitHub Releases API response was not an array");
  }

  return payload
    .filter((release) => release && !release.draft)
    .filter((release) => includePrereleases || !release.prerelease)
    .slice(0, maxReleases)
    .map((release) => normalizeGithubRelease(release, repo));
}

async function main() {
  const { outputPath, maxReleases, repo, includePrereleases } = parseArgs();
  const now = new Date();

  let releases = [];
  let source = "github-api";
  let githubError = null;

  try {
    releases = await fetchGithubReleases({ repo, maxReleases, includePrereleases });
  } catch (error) {
    githubError = error;
  }

  if (githubError || releases.length === 0) {
    const fallbackReleases = buildFallbackReleases({ maxReleases, includePrereleases, repo });
    if (fallbackReleases.length > 0) {
      releases = fallbackReleases;
      source = "git-tags-fallback";
    } else if (githubError) {
      source = "github-api-error";
    } else {
      source = "github-api-empty";
    }
  }

  const output = {
    schema_version: 1,
    generated_at_utc: now.toISOString(),
    generated_at_unix_ms: now.getTime(),
    repository: repo,
    source,
    max_releases: maxReleases,
    include_prereleases: includePrereleases,
    releases,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");

  if (githubError) {
    console.warn(`GitHub release fetch failed, used fallback data: ${githubError.message}`);
  }

  console.log(
    `Generated changelog data: ${relative(REPO_ROOT, outputPath)} (${releases.length} releases, source=${source})`,
  );
}

main();

#!/usr/bin/env node

/**
 * Gate for skill quality cards and the schemas they point at.
 *
 * A quality card is a published artifact: it ships inside the npm tarball and
 * inside the Claude marketplace plugin, and its `$schema` is a public URL that
 * strangers resolve. Four things therefore have to stay true together, and
 * this script fails the build when any of them drifts:
 *
 *   1. Every schema under `schemas/` is laid out as
 *      `schemas/<name>/<name>.schema.json` and declares
 *      `$id: https://openagreements.org/schemas/<name>.schema.json`.
 *      openagreements.org serves `/schemas/:name.schema.json` by proxying that
 *      exact repository path, so the layout *is* the publishing contract — a
 *      renamed directory or a rewritten `$id` silently 404s the public URL.
 *   2. Every card points at its schema by that canonical URL, and the URL
 *      resolves back to a file that exists here. A relative `$schema` dangles
 *      the moment the card is published away from the repository, because
 *      `schemas/` is in neither the npm allowlist nor the plugin projection.
 *   3. Every card validates against the schema it names.
 *   4. Every card actually reaches the artifacts that claim to carry it — the
 *      npm tarball (asked of `npm pack` itself, not modelled) and the
 *      generated plugin bundle.
 *
 * Cards are discovered by walking `skills/` rather than by reading a list, so
 * renaming or dropping one fails the gate instead of quietly shrinking it to
 * nothing. That failure mode — a check that stops checking and still reports
 * success — is one this repository has already shipped once.
 *
 * Usage: node scripts/check_quality_cards.mjs
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { skillSpecs } from "./sync_claude_marketplace_plugin.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const schemaBaseUrl = "https://openagreements.org/schemas";
export const cardFileName = "quality-card.json";
export const skillsRoot = join(repoRoot, "skills");
const schemasRoot = join(repoRoot, "schemas");
const pluginSkillsRoot = join(repoRoot, "plugins", "open-agreements", "skills");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function portable(path) {
  return path.split("\\").join("/");
}

/**
 * The inverse of the openagreements.org rewrite
 * `/schemas/:name.schema.json` -> `schemas/:name/:name.schema.json`.
 * Returns null for any URL that route would not serve.
 */
export function schemaFileForUrl(url) {
  if (typeof url !== "string" || !url.startsWith(`${schemaBaseUrl}/`)) return null;
  const tail = url.slice(schemaBaseUrl.length + 1);
  if (!tail.endsWith(".schema.json")) return null;
  const name = tail.slice(0, -".schema.json".length);
  if (!/^[a-z0-9-]+$/.test(name)) return null;
  return join(schemasRoot, name, `${name}.schema.json`);
}

export function walk(directory, fileName, found = []) {
  if (!existsSync(directory)) return found;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, fileName, found);
    else if (entry.name === fileName) found.push(absolute);
  }
  return found;
}

function packedFiles() {
  const output = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return new Set(JSON.parse(output)[0].files.map((entry) => entry.path));
}

function checkSchemaLayout(problems) {
  if (!existsSync(schemasRoot)) return;
  for (const entry of readdirSync(schemasRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      problems.push(
        `schemas/${entry.name} is not a directory; openagreements.org serves schemas from schemas/<name>/<name>.schema.json`,
      );
      continue;
    }
    const expected = join(schemasRoot, entry.name, `${entry.name}.schema.json`);
    if (!existsSync(expected)) {
      problems.push(`schemas/${entry.name}/${entry.name}.schema.json is missing`);
      continue;
    }
    const id = readJson(expected).$id;
    const canonical = `${schemaBaseUrl}/${entry.name}.schema.json`;
    if (id !== canonical) {
      problems.push(
        `schemas/${entry.name}/${entry.name}.schema.json declares $id ${JSON.stringify(id)}; openagreements.org serves it as ${canonical}`,
      );
    }
  }
}

/**
 * The card's dates must be the ones the bundle beside it actually supports.
 *
 * The card is a static asset; the manifest is generated per publish. When the
 * two drifted, the card claimed law checked through 2026-06-16 and a review due
 * 2026-12-13 while the manifest held a jurisdiction checked only through
 * 2026-04-14 — the card overstated freshness by two months. The aggregate rule
 * is deliberately conservative: one unknown jurisdiction date makes the card's
 * date unknown, because the earliest KNOWN date reads as coverage the bundle
 * does not have.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Date-shaped is not the same as real: `2026-02-30` matches the shape. */
export function isCalendarDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const round = new Date(Date.UTC(y, m - 1, d));
  return (
    round.getUTCFullYear() === y && round.getUTCMonth() === m - 1 && round.getUTCDate() === d
  );
}

export function expectedCardDates(manifest) {
  const entries = manifest.jurisdictions;
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const laws = entries.map((entry) => entry.law_checked_through);

  // A present-but-malformed date is not an unknown date, and it must not reach
  // the sort. These are strings, so the minimum is lexical: "2026-2-01" sorts
  // AFTER "2026-10-01", and a card would then publish October as the floor for
  // a bundle checked only through February. Refusing here is what stops the
  // aggregate from claiming coverage nothing in the manifest supports.
  const malformed = laws.filter(
    (value) => value !== null && value !== undefined && !isCalendarDate(value),
  );

  const lawCheckedThrough = laws.every((value) => typeof value === "string")
    ? laws.slice().sort()[0]
    : null;
  return {
    malformed: [...new Set(malformed.map((value) => JSON.stringify(value)))].sort(),
    content_packaged_at: manifest.content_packaged_at,
    law_checked_through: lawCheckedThrough,
    jurisdictions: entries.length,
  };
}

export function addUtcDays(date, days) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function checkCardDates(card, file, relativePath, problems) {
  const manifestName = card.coverage?.manifest;
  if (typeof manifestName !== "string") return;
  const manifestPath = join(dirname(file), manifestName);
  if (!existsSync(manifestPath)) {
    problems.push(`${relativePath} names coverage.manifest ${JSON.stringify(manifestName)}, which does not exist beside it`);
    return;
  }

  const expected = expectedCardDates(readJson(manifestPath));
  if (!expected) {
    problems.push(`${relativePath}: ${manifestName} lists no jurisdictions, so the card describes an empty bundle`);
    return;
  }

  if (expected.malformed.length > 0) {
    problems.push(
      `${relativePath}: ${manifestName} carries law_checked_through ${expected.malformed.join(", ")}, ` +
        `which is not an ISO YYYY-MM-DD calendar date; the card's floor cannot be derived from it`,
    );
    return;
  }
  if (!isCalendarDate(expected.content_packaged_at)) {
    problems.push(
      `${relativePath}: ${manifestName} content_packaged_at is ${JSON.stringify(expected.content_packaged_at)}, ` +
        `not an ISO YYYY-MM-DD calendar date`,
    );
    return;
  }

  // The schema is the authority on policy_days and reports it better than a
  // derived due date would, so skip THAT comparison when it is unusable — but
  // only that one. Returning here instead would let a bad policy_days suppress
  // the overstated-floor report, which is the failure this check exists for.
  const policyDays = card.freshness?.policy_days;
  const derivable = Number.isInteger(policyDays) && policyDays >= 1;
  const expectedDue =
    expected.law_checked_through === null ? null : derivable ? addUtcDays(expected.law_checked_through, policyDays) : null;
  const mismatches = [
    ["content_packaged_at", card.content_packaged_at, expected.content_packaged_at],
    ["law_checked_through", card.law_checked_through, expected.law_checked_through],
    ...(derivable ? [["next_review_due", card.next_review_due, expectedDue]] : []),
    ["coverage.jurisdictions", card.coverage?.jurisdictions, expected.jurisdictions],
  ].filter(([, actual, want]) => actual !== want);

  for (const [field, actual, want] of mismatches) {
    problems.push(
      `${relativePath} ${field} is ${JSON.stringify(actual)}; ${manifestName} supports ${JSON.stringify(want)}`,
    );
  }
}

function checkCards(problems) {
  const cards = walk(skillsRoot, cardFileName);
  if (cards.length === 0) {
    problems.push(
      `no ${cardFileName} found under skills/; this gate exists because at least one skill publishes one`,
    );
    return 0;
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validators = new Map();
  const packed = packedFiles();

  for (const file of cards) {
    const relativePath = portable(relative(repoRoot, file));
    const card = readJson(file);

    // Publication path 1: npm. Ask npm what it would pack rather than
    // re-implementing its allowlist and ignore-file semantics here.
    if (!packed.has(relativePath)) {
      problems.push(`${relativePath} is not in the npm tarball`);
    }

    // Publication path 2: the Claude marketplace plugin.
    const spec = skillSpecs.find(
      (candidate) => portable(dirname(relativePath)) === candidate.source,
    );
    if (!spec) {
      problems.push(
        `${relativePath} belongs to a skill the marketplace plugin does not project; add it to skillSpecs in scripts/sync_claude_marketplace_plugin.mjs`,
      );
    } else {
      const projected = join(pluginSkillsRoot, spec.target, cardFileName);
      if (!existsSync(projected)) {
        problems.push(
          `${relativePath} is missing from the generated plugin at plugins/open-agreements/skills/${spec.target}/${cardFileName}; run npm run generate:claude-plugin`,
        );
      } else if (!readFileSync(projected).equals(readFileSync(file))) {
        problems.push(
          `plugins/open-agreements/skills/${spec.target}/${cardFileName} is stale; run npm run generate:claude-plugin`,
        );
      }
    }

    // The reference has to survive both of those journeys, which a relative
    // path does not: neither artifact carries `schemas/`.
    const schemaFile = schemaFileForUrl(card.$schema);
    if (!schemaFile) {
      problems.push(
        `${relativePath} points $schema at ${JSON.stringify(card.$schema)}; it must be a canonical ${schemaBaseUrl}/<name>.schema.json URL so the reference resolves outside this repository`,
      );
      continue;
    }
    if (!existsSync(schemaFile)) {
      problems.push(
        `${relativePath} points $schema at ${card.$schema}, which openagreements.org serves from ${portable(relative(repoRoot, schemaFile))} — that file does not exist`,
      );
      continue;
    }

    checkCardDates(card, file, relativePath, problems);

    let validate = validators.get(schemaFile);
    if (!validate) {
      validate = ajv.compile(readJson(schemaFile));
      validators.set(schemaFile, validate);
    }
    if (!validate(card)) {
      for (const error of validate.errors ?? []) {
        problems.push(
          `${relativePath}${error.instancePath} ${error.message}${
            error.params?.additionalProperty ? ` (${error.params.additionalProperty})` : ""
          }`,
        );
      }
    }
  }

  return cards.length;
}

export function checkQualityCards() {
  const problems = [];
  checkSchemaLayout(problems);
  const count = checkCards(problems);
  if (problems.length > 0) {
    throw new Error(`Quality card check failed:\n${problems.join("\n")}`);
  }
  console.log(
    `Quality cards are valid and published (${count} card${count === 1 ? "" : "s"}).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) checkQualityCards();

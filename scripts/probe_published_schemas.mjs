#!/usr/bin/env node

/**
 * Prove that the `$schema` URL every published quality card carries actually
 * resolves, and resolves to this repository's schema.
 *
 * `check:quality-cards` is hermetic: it proves the card and the schema agree
 * with each other and with the layout openagreements.org serves. It cannot
 * prove the site is serving them. That gap is not theoretical — the canonical
 * `$id` on these schemas returned 404 for as long as it had existed, and the
 * serving side lives in a different repository whose own post-deploy probe
 * cannot re-run when a schema later lands here.
 *
 * So this runs after a merge to `main`, and on a schedule, where a network
 * call is appropriate and a failure is actionable rather than flaky. It is
 * deliberately NOT part of `preflight:ci`: a pull request must not go red
 * because a third party is having an outage.
 *
 * Usage: node scripts/probe_published_schemas.mjs
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { pathToFileURL } from "node:url";

import {
  cardFileName,
  schemaFileForUrl,
  skillsRoot,
  walk,
} from "./check_quality_cards.mjs";

const repoRoot = new URL("..", import.meta.url).pathname;

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

async function probe(url, local) {
  // Cache-bust: the edge is configured to serve a stale copy for a week, which
  // would otherwise let a freshly broken route pass against the last good
  // response.
  const requested = `${url}?probe=${Date.now()}`;
  const response = await fetch(requested, {
    headers: { accept: "application/schema+json, application/json" },
    redirect: "follow",
  });
  if (!response.ok) {
    return `${url} returned HTTP ${response.status}`;
  }

  let served;
  try {
    served = JSON.parse(await response.text());
  } catch (error) {
    return `${url} did not return JSON (${error.message})`;
  }

  if (served.$id !== url) {
    return `${url} served a document whose $id is ${JSON.stringify(served.$id)}`;
  }
  if (served.schema_version !== local.schema_version) {
    return `${url} serves schema_version ${JSON.stringify(served.schema_version)}, this repository has ${JSON.stringify(local.schema_version)}`;
  }
  return null;
}

export async function probePublishedSchemas() {
  const cards = walk(skillsRoot, cardFileName);
  if (cards.length === 0) {
    throw new Error(`no ${cardFileName} found under skills/`);
  }

  const problems = [];
  const seen = new Set();
  for (const card of cards) {
    const url = readJson(card).$schema;
    if (seen.has(url)) continue;
    seen.add(url);

    const schemaFile = schemaFileForUrl(url);
    if (!schemaFile) {
      problems.push(
        `${relative(repoRoot, card)} carries a $schema this repository does not publish: ${JSON.stringify(url)}`,
      );
      continue;
    }

    const problem = await probe(url, readJson(schemaFile));
    if (problem) problems.push(problem);
  }

  if (problems.length > 0) {
    throw new Error(
      `Published schema references do not resolve:\n${problems.join("\n")}\n\n` +
        "Every card in skills/ points at openagreements.org. If this is failing right " +
        "after a merge, the schema-hosting route in UseJunior/openagreements-org-deploy " +
        "is not deployed yet — it has to land before the cards that reference it.",
    );
  }
  console.log(`Published schema references resolve (${seen.size} URL${seen.size === 1 ? "" : "s"}).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await probePublishedSchemas();

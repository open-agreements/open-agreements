import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(__dirname, "../..");

// The Legal Practice Library is a one-way OKF projection synced from
// UseJunior/legal-explainer (see legal-practice-library/index.md + NOTICE). We
// only READ it here. `index.md` (section navigation) and `log.md` (provenance)
// are reserved scaffolding, never counted as content documents.
export const LIBRARY_DIR = "legal-practice-library";
const RESERVED_FILES = new Set(["index.md", "log.md"]);

// Curated section metadata. Labels, blurbs, and the live topic-landing URL are
// authored here; document COUNTS are always computed from the committed tree so
// they cannot drift from what the corpus bot syncs. Rows are ordered by measured
// demand (Vercel log drain, 30d): non-compete >> privacy > AI. `kind`:
// "jurisdictional" renders a "N states (+ international)" coverage label;
// "topic" renders a plain note count. A section may span multiple `dirs` (the
// collapsed AI & Workforce row); its Browse link then points at the library root.
export const PRACTICE_GUIDE_SECTIONS = [
  {
    label: "Non-Compete & Restrictive Covenants",
    dirs: ["non-compete"],
    kind: "jurisdictional",
    live: "/practice-guides/non-compete",
    blurb:
      "Enforceability, blue-pencil reformation, tolling, choice of law, and FTC-rule status.",
  },
  {
    label: "Consumer Data Privacy",
    dirs: ["privacy"],
    kind: "jurisdictional",
    live: "/practice-guides/privacy/us",
    blurb:
      "CCPA/CPRA and every comprehensive state privacy act — who's covered, consumer rights, opt-outs, and who enforces.",
  },
  {
    label: "AI Vendors",
    dirs: ["ai-vendors"],
    kind: "topic",
    live: "/practice-guides/ai-vendors",
    blurb:
      "Zero-data-retention, data residency, and the terms that matter in AI vendor contracts.",
  },
  {
    label: "AI & the Workforce",
    dirs: ["ai-hiring", "ai-policies", "ai-layoffs", "outside-counsel"],
    kind: "topic",
    live: "/practice-guides",
    blurb:
      "AI in hiring and adverse-action, workforce AI policies, and outside-counsel transitions.",
  },
  {
    label: "Privacy-Policy Requirement Phrasings",
    dirs: ["privacy-policy"],
    kind: "topic",
    live: "/practice-guides/privacy/us",
    blurb:
      "Preferred phrasings for what a U.S. consumer privacy policy must disclose.",
  },
];

// Checklist sub-topics, demand-ordered. No counts rendered: outside non-compete
// (a 50-state set) there is typically one checklist per topic.
export const CHECKLIST_SECTIONS = [
  {
    label: "Non-Compete review",
    dir: "non-compete",
    live: "/checklists/non-compete/us",
    blurb: "Clause-by-clause reviewer checklists — a baseline plus 50-state overlays.",
  },
  {
    label: "Privacy-Policy review",
    dir: "privacy-policy",
    live: "/checklists/privacy-policy/us",
    blurb: "What a compliant U.S. consumer privacy policy must contain.",
  },
  {
    label: "Venture Financing review",
    dir: "venture-financing",
    live: "/checklists/venture-financing/nvca-stock-purchase-agreement",
    blurb: "NVCA model-document review (e.g. the Stock Purchase Agreement).",
  },
];

export const SURVEYS_DIR = "surveys";
export const CASE_EXCERPTS_DIR = "case-excerpts";

// State-law notes carry `STATE_TYPE`; non-U.S.-state jurisdiction notes (e.g.
// Australian states) carry `NOTE_TYPE` and signal "+ international". The pillar
// ("Law Topic") and other types are neither, so they don't trigger it.
const STATE_TYPE = "State Law Practice Note";
const NOTE_TYPE = "Practice Note";

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  return match ? yaml.load(match[1]) || {} : {};
}

function firstHeading(raw) {
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// All non-reserved *.md files under `dir` (recursive), sorted for determinism.
function conceptFiles(dir) {
  const found = [];
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const child = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(child);
      } else if (entry.name.endsWith(".md") && !RESERVED_FILES.has(entry.name)) {
        found.push(child);
      }
    }
  }
  walk(dir);
  return found;
}

// Tally concept docs across one or more topic dirs, bucketed by `type`.
function tallyTypes(rootDir, dirs) {
  let total = 0;
  let stateCount = 0;
  let internationalCount = 0;
  for (const dir of dirs) {
    for (const file of conceptFiles(resolve(rootDir, LIBRARY_DIR, dir))) {
      total += 1;
      const { type } = parseFrontmatter(readFileSync(file, "utf-8"));
      if (type === STATE_TYPE) {
        stateCount += 1;
      } else if (type === NOTE_TYPE) {
        internationalCount += 1;
      }
    }
  }
  return { total, stateCount, internationalCount };
}

function coverageLabel(kind, { total, stateCount, internationalCount }) {
  if (kind === "jurisdictional" && stateCount > 0) {
    return internationalCount > 0
      ? `${stateCount} U.S. states + international`
      : `${stateCount} U.S. states`;
  }
  return `${total} note${total === 1 ? "" : "s"}`;
}

/**
 * Pure read of the committed Legal Practice Library. Returns counts (from the
 * tree) plus curated section metadata; the renderer in generate_readme.mjs turns
 * this into README tables. No writes, no network.
 */
export function buildLibrary({ rootDir = REPO_ROOT } = {}) {
  let practiceGuideCount = 0;
  const practiceGuides = PRACTICE_GUIDE_SECTIONS.map((section) => {
    const tally = tallyTypes(rootDir, section.dirs);
    practiceGuideCount += tally.total;
    return {
      label: section.label,
      blurb: section.blurb,
      live: section.live,
      coverage: coverageLabel(section.kind, tally),
      count: tally.total,
      // Multi-dir (collapsed) rows link Browse at the library root index.
      repoPath:
        section.dirs.length === 1
          ? `${LIBRARY_DIR}/${section.dirs[0]}`
          : LIBRARY_DIR,
    };
  }).filter((section) => section.count > 0);

  const checklists = CHECKLIST_SECTIONS.map((section) => ({
    label: section.label,
    blurb: section.blurb,
    live: section.live,
    count: countConcept(rootDir, `checklists/${section.dir}`),
    repoPath: `${LIBRARY_DIR}/checklists/${section.dir}`,
  })).filter((section) => section.count > 0);

  // Surveys are self-describing — derive title + live URL from H1 + `resource:`.
  const surveys = conceptFiles(resolve(rootDir, LIBRARY_DIR, SURVEYS_DIR))
    .map((file) => {
      const raw = readFileSync(file, "utf-8");
      const frontmatter = parseFrontmatter(raw);
      return {
        title: firstHeading(raw) || frontmatter.title || file,
        resource: frontmatter.resource || null,
        repoPath: relative(rootDir, file),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const checklistCount = checklists.reduce(
    (total, section) => total + section.count,
    0,
  );
  const caseExcerptCount = countConcept(rootDir, CASE_EXCERPTS_DIR);

  return {
    practiceGuides,
    practiceGuideCount,
    checklists,
    checklistCount,
    surveys,
    caseExcerptCount,
    repoPath: LIBRARY_DIR,
  };
}

function countConcept(rootDir, dir) {
  return conceptFiles(resolve(rootDir, LIBRARY_DIR, dir)).length;
}

# Design: Trim site/ to a thin protocol-host

## Context

The Vercel deployment of this repo at `openagreements.{org,ai}` started life as the OpenAgreements public site — homepage, template browser, docs, trust pages. In late 2026 the marketing surface migrated to `usejunior.com/developer-tools/open-agreements`. PR #196 added 301 redirects in `vercel.json` for `/`, `/templates`, `/templates/:name`, `/docs/*`, `/trust/*` to the new host. `eleventy.config.js`'s `REDIRECT_MODE=1` was added at the same time to skip rendering those pages during the Vercel build.

What remained of the deployment was a thin **protocol-host**: `/.well-known/{mcp-server-card,api-catalog,agent-card.json,ai/entity.json,arp/pubkey.json}`, the `/api/*` Vercel functions, `/schemas/*.schema.json`, and `/downloads/*.docx` blanks. PR #247 canonicalized those to `openagreements.org` (with `.ai` as a Vercel serving alias).

What hasn't been cleaned up is the source for the marketing pages. They're never built, never served — but they're still in the repo, still in code review diffs, still show up when someone greps `site/`. This change removes them.

## Goals / Non-Goals

**Goals:**
- Repo state matches deployment reality: no source for pages that don't exist in `_site/`
- `eleventy.config.js` and `package.json` scripts no longer carry `REDIRECT_MODE=1` conditionals
- `site/trust/system-card.md` is classified consistently — either it's a rendered page (and we keep the layout) or it's a source-only artifact (and we don't)
- Build pipeline still emits exactly the deployed surface: `_site/{.well-known,schemas,downloads,assets/previews}/**` plus the generated `_site/.well-known/ai/index.json` and `_site/.well-known/arp/index.sig`

**Non-Goals:**
- Fixing the broken Allure deploy pipeline (issue #250) — orthogonal
- Removing Eleventy entirely from the build — possible follow-up, deferred
- Changing the wildcard ALIAS DNS routing — out of scope
- Touching `site/.well-known/`, `site/schemas/`, `site/downloads/`, `site/assets/previews/`, or `site/_data/{templateEvidence,systemCardRuntime}.json` — those are load-bearing

## Decisions

### Decision 1: `system-card.md` becomes source-only (Option A)

**What:** Strip `layout: trust-layout.njk` frontmatter from `site/trust/system-card.md`. Stop emitting that frontmatter in `scripts/generate_system_card.mjs`. Delete `_includes/trust-layout.njk` along with the other dead layouts.

**Why:** Today the file claims to be a rendered page (frontmatter declares a layout), but `REDIRECT_MODE=1` ignores it at build, so the claim is a lie. The CI freshness gate `check:system-card` (in `package.json:104`) reads the file as raw markdown, doesn't care about layouts. Re-classifying it as a source-only traceability artifact aligns the file with how it's actually used.

**Alternative considered (Option B):** Keep `_includes/{trust-layout,base}.njk` and therefore `styles.css`/`main.js` (which `base.njk:20,82` references). Smaller cleanup, but defers the "what is this file?" question and keeps ~5 dead files alive. Rejected because Option A is the principled answer.

### Decision 2: Keep `site/_data/{templateEvidence,systemCardRuntime}.json`, drop `changelog.json`

**Why:** `templateEvidence.json` and `systemCardRuntime.json` are freshness-gated by CI (`check:template-evidence` and the system-card runtime check). Deleting them would break those gates. `changelog.json` is consumed only by `site/trust/changelog.njk` (which is being deleted); it has no freshness gate and no other consumers. Drop it.

### Decision 3: Update or delete `integration-tests/trust-signal-surfaces.test.ts`

**Context:** The test currently reads `site/index.njk` directly (lines 20–26) and asserts trust-signal content is present. After PR 3, that file doesn't exist.

**What:** Rewrite the test to assert against `_site/.well-known/{mcp-server-card,api-catalog,agent-card.json}` — those are the actual public trust surfaces post-cleanup. The README and the generated `system-card.md` are the human-facing trust surfaces; either is fine to assert against.

**Alternative:** Delete the test outright and rely on the freshness gates. Rejected because the test asserts behavior worth keeping (trust signals exist on a public surface).

### Decision 4: Keep Eleventy in the build pipeline for now

**Why:** With the deletions, Eleventy's job reduces to "passthrough copy `site/{.well-known,schemas,downloads,assets}` to `_site/`." That's a small enough job that you could replace it with `cp -r`, but Eleventy also handles the build chain that produces `_site/.well-known/ai/index.json` (signed manifest) and `_site/sitemap.xml` (`scripts/generate_site_indexes.mjs`). Removing Eleventy is a follow-up, not part of this change.

## Risks / Trade-offs

- **Risk:** Translated READMEs (`README.{de,es,pt-br,zh}.md`) describe `site/index.njk`, `site/templates.njk`, `site/template-detail.njk`, `site/styles.css` as project structure (lines 262–270). After delete, those descriptions are wrong. **Mitigation:** Update those sections in the same PR to describe the thin-protocol-host structure.
- **Risk:** `docs/changelog-release-process.md:108` tells readers to open `_site/trust/changelog/index.html` to verify the rendered changelog. After delete, that file doesn't exist. **Mitigation:** Update the doc to reference the GitHub Releases page (or remove the verification step).
- **Risk:** Some external system or marketing collateral might link to `https://openagreements.org/templates` or `/trust/` etc. **Mitigation:** The 301 redirects in `vercel.json` continue to work — those external links still resolve, just to usejunior.com. No regression.
- **Trade-off:** The `redirects[]` block in `vercel.json` becomes load-bearing for *every* user of the old URLs. If it's ever removed, those links 404. Worth a comment in `vercel.json` to make the intent explicit.

## Migration Plan

1. **Cut the OpenSpec proposal** (this file). Get approval before any code changes.
2. **Land a single PR** implementing all deletions + modifications + test/doc updates. Don't split — the build pipeline can't be in a half-stripped state.
3. **CI must pass** (`npm run preflight:ci`, integration tests, system-card freshness, template-evidence freshness, template previews).
4. **Post-merge verification:**
   - `curl https://openagreements.org/.well-known/{mcp-server-card,api-catalog,agent-card.json}` unchanged
   - `curl https://openagreements.org/schemas/forms-catalog.schema.json` unchanged
   - `curl https://openagreements.org/downloads/openagreements-mutual-nda.docx` returns the DOCX
   - `curl -I https://openagreements.org/` returns 308 to `usejunior.com` (existing redirect)
5. **Rollback:** straightforward git revert. The deleted source is recoverable from git history; the build pipeline restores via revert.

## Open Questions

- Does the OpenSpec capability need a new requirement specifically for "Thin Protocol Host Deployment," or is modifying `Public Trust Signal Surfaces` enough? (Proposed: yes, add the new requirement — codifies what `_site/` contents must be.)
- Should `site/main.js` line 176 (`const canonical = 'https://openagreements.ai';`) get its `.ai` reference flipped before deletion, for grep-cleanliness during the PR-2 → PR-3 transition? (Proposed: no — the file is being deleted, flipping it is wasted churn.)

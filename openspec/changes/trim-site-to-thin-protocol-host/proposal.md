# Change: Trim site/ to a thin protocol-host

## Why

The marketing site for OpenAgreements has moved to `usejunior.com/developer-tools/open-agreements`. `vercel.json` already 301-redirects all marketing paths, and `eleventy.config.js`'s `REDIRECT_MODE=1` skips rendering them at build. The Vercel deployment of this repo at `openagreements.{org,ai}` only really exists to host the protocol/discovery surface (`/.well-known/*`, `/api/*`, `/schemas/*`, `/downloads/*`).

But the repo on `main` still carries a full marketing/trust Eleventy site under `site/` whose `.njk` pages, `_includes`, `src/` (Tailwind input), and `docs/` are dead code under `REDIRECT_MODE=1`. They never get built, never served — but their source still lives in the repo and shows up in code review, makes the repo look sloppy, and adds maintenance noise. A peer-reviewed (Codex + Gemini) cleanup plan identified this as the third of three sequenced PRs (after #235 cleanup and #247 canonicalization, both merged or queued).

## What Changes

- Strip `site/` to the surfaces that actually serve users on `openagreements.{org,ai}`.
- Re-classify `site/trust/system-card.md` from a *rendered Eleventy page* (with `layout: trust-layout.njk` frontmatter) to a *source-only traceability artifact* (frontmatter stripped). The CI freshness gate `check:system-card` continues to enforce it.
- Remove `REDIRECT_MODE=1` ignore semantics from `eleventy.config.js`. With marketing pages deleted, the conditional becomes redundant.
- **BREAKING (deployed surface):** the Vercel deployment for `openagreements.{org,ai}` no longer ships HTML for `/`, `/templates`, `/templates/:name`, `/docs/*`, `/trust/*`. These paths have been 301-redirected since PR #196; this change removes the underlying source as well.
- Update tests, translated READMEs, and release docs that currently describe deleted paths.

## Impact

- **Affected specs:** `open-agreements` capability — `Public Trust Signal Surfaces` requirement scenarios are modified to reflect that the landing-page trust signals now live on `usejunior.com` rather than in this repo's `_site/`. New `Thin Protocol Host Deployment` requirement codifies what the Vercel deploy must continue to serve.
- **Affected code:**
  - Deletes: `site/{index,templates,template-detail}.njk`; `site/trust/{index,template-evidence,evidence-story,changelog}.njk`; `site/{main.js,templates-filter.js,styles.css}`; `site/src/**`; `site/_includes/**`; `site/docs/**`; `site/_data/changelog.json`
  - Modifies: `eleventy.config.js`, `package.json` scripts (`build:css`, `build:docs`, `build:site:vercel`), `scripts/generate_system_card.mjs` (stop emitting `layout:` frontmatter), `integration-tests/trust-signal-surfaces.test.ts`, `README.{de,es,pt-br,zh}.md`, `docs/changelog-release-process.md`
  - Keeps: `site/.well-known/**`, `site/schemas/**`, `site/downloads/**`, `site/assets/previews/**`, `site/_data/{docsNav.js, catalog.js, github.js, templateEvidence.json, systemCardRuntime.json}`, `site/trust/system-card.md`
- **Latent issue NOT addressed here:** the broken Allure deploy pipeline at `tests.openagreements.{ai,org}` (issue #250). Orthogonal to this change.

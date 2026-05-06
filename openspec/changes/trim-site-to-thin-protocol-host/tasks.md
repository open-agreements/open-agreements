# Tasks: Trim site/ to a thin protocol-host

## 1. Source deletions

- [ ] 1.1 Delete `site/index.njk`, `site/templates.njk`, `site/template-detail.njk`
- [ ] 1.2 Delete `site/trust/{index,template-evidence,evidence-story,changelog}.njk`
- [ ] 1.3 Delete `site/main.js`, `site/templates-filter.js`, `site/styles.css`
- [ ] 1.4 Delete `site/src/**` (Tailwind input)
- [ ] 1.5 Delete `site/_includes/{base,docs-layout,trust-layout}.njk`
- [ ] 1.6 Delete `site/docs/**` (gitignored copy of `docs/`; remove the dir)
- [ ] 1.7 Delete `site/_data/changelog.json`

## 2. Re-classify `system-card.md` as source-only

- [ ] 2.1 Strip `layout: trust-layout.njk` frontmatter from `site/trust/system-card.md`
- [ ] 2.2 Update `scripts/generate_system_card.mjs` (~line 834) to stop emitting layout frontmatter
- [ ] 2.3 Run `npm run trust:rebuild` to regenerate; verify diff matches expectation

## 3. Build pipeline updates

- [ ] 3.1 In `eleventy.config.js`, remove the `REDIRECT_MODE=1` ignore block (lines 27–34)
- [ ] 3.2 In `eleventy.config.js`, remove passthrough for `site/main.js`, `site/templates-filter.js`, `site/styles.css` (lines 202, 203, 205)
- [ ] 3.3 In `package.json`, drop `build:css` script (line 87)
- [ ] 3.4 In `package.json`, drop `build:docs` script (line 88)
- [ ] 3.5 In `package.json`, adjust `build:site:vercel` to not invoke removed scripts; verify it still emits the protocol surface
- [ ] 3.6 In `vercel.json`, add a comment near `redirects[]` noting the redirects are load-bearing (source deleted)

## 4. Test and doc updates

- [ ] 4.1 Rewrite `integration-tests/trust-signal-surfaces.test.ts` (lines 20–26) to assert against `_site/.well-known/*` outputs instead of `site/index.njk`
- [ ] 4.2 Update `README.de.md` (lines 262–270) — replace `site/` structure description with thin-protocol-host
- [ ] 4.3 Update `README.es.md` (lines 262–270) — same
- [ ] 4.4 Update `README.pt-br.md` (lines 262–270) — same
- [ ] 4.5 Update `README.zh.md` (lines 262–270) — same
- [ ] 4.6 Update `docs/changelog-release-process.md:108` — replace `_site/trust/changelog/index.html` reference with GitHub Releases link or remove the verification step
- [ ] 4.7 Run `npm run generate:readme` to refresh `README.md` if any structure-description sections are present

## 5. OpenSpec deltas

- [ ] 5.1 Modify `Public Trust Signal Surfaces` scenarios: OA-DST-007 and any others that reference the landing page in this repo's deployment
- [ ] 5.2 Add new requirement `Thin Protocol Host Deployment` codifying what `_site/` must contain
- [ ] 5.3 Update `openspec/specs/open-agreements/spec.md` after this change archives (Stage 3)

## 6. Verification

- [ ] 6.1 `npm run preflight:ci` passes
- [ ] 6.2 `REDIRECT_MODE=1 npm run build:site:vercel` (or its updated form) succeeds
- [ ] 6.3 `_site/` contains only `.well-known/`, `schemas/`, `downloads/`, `assets/`, `trust/system-card.md`, generated indexes (`llms.txt`, `llms-full.txt`, `sitemap.xml`)
- [ ] 6.4 `_site/` contains NO `index.html`, `templates/`, `template/`, `trust/index.html`, `docs/`
- [ ] 6.5 `npm run check:system-card` and `npm run check:template-evidence` pass
- [ ] 6.6 `npx vitest run integration-tests/` passes (incl. rewritten trust-signal-surfaces test)
- [ ] 6.7 Open the resulting deploy preview and confirm:
  - `https://<preview>.vercel.app/.well-known/mcp-server-card` returns 200
  - `https://<preview>.vercel.app/.well-known/agent-card.json` returns 200 with `.org` URLs
  - `https://<preview>.vercel.app/schemas/forms-catalog.schema.json` returns 200
  - `https://<preview>.vercel.app/downloads/openagreements-mutual-nda.docx` returns 200 (sample one)
  - `https://<preview>.vercel.app/` returns 301 → usejunior.com (existing redirect still works)

## 7. Stage 3 (post-merge, separate PR)

- [ ] 7.1 Run `openspec archive trim-site-to-thin-protocol-host --yes`
- [ ] 7.2 Update `openspec/specs/open-agreements/spec.md` with the modified/added requirements
- [ ] 7.3 Run `openspec validate --strict` to confirm

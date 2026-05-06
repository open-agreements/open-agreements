## MODIFIED Requirements

### Requirement: Public Trust Signal Surfaces
The project SHALL expose trust signals that help users and AI agents quickly verify maintenance quality and testing posture from public surfaces.

#### Scenario: [OA-DST-006] README exposes trust evidence at first glance
- **WHEN** a visitor opens the repository README
- **THEN** the top section shows trust signals for CI status and coverage
- **AND** identifies the active JavaScript test framework (Vitest or Jest)

#### Scenario: [OA-DST-007] External landing page exposes trust evidence without scrolling deep
- **WHEN** a visitor opens the OpenAgreements landing page on `usejunior.com/developer-tools/open-agreements`
- **THEN** the Trust section links to npm package, CI status, coverage dashboard, and source repository
- **AND** includes an explicit signal for the active JavaScript test framework (Vitest or Jest)
- **AND** this content is owned and served by the `usejunior.com` deployment, not by the `openagreements.{org,ai}` Vercel deployment

#### Scenario: [OA-DST-006b] System card is published as a source-only traceability artifact
- **WHEN** the project regenerates trust artifacts via `npm run trust:rebuild`
- **THEN** `site/trust/system-card.md` is written as plain markdown without Eleventy layout frontmatter
- **AND** `npm run check:system-card` enforces the file is up-to-date relative to OpenSpec scenarios and Allure runtime data
- **AND** the file is committed to git as the canonical traceability record (not as a rendered HTML page)

## ADDED Requirements

### Requirement: Thin Protocol Host Deployment
The Vercel deployment for `openagreements.{org,ai}` SHALL serve only the protocol/discovery surface plus generated indexes and existing 301 redirects to the marketing host. Marketing pages, template browser pages, and trust HTML pages SHALL NOT be present in the deployed `_site/` output.

#### Scenario: [OA-DST-027] Deployed protocol surface is present
- **WHEN** the project builds the Vercel deployment via `npm run build:site:vercel`
- **THEN** `_site/.well-known/{mcp-server-card,api-catalog,agent-card.json,ai/entity.json,ai/index.json,arp/pubkey.json,arp/index.sig}` are emitted
- **AND** `_site/schemas/{forms-catalog,conventions}.schema.json` are emitted
- **AND** `_site/downloads/*.docx` are emitted for templates whose metadata advertises a static blank download
- **AND** `_site/assets/previews/**.png` are emitted for templates with CI-validated preview images

#### Scenario: [OA-DST-028] Deployed marketing surface is absent
- **WHEN** the project builds the Vercel deployment via `npm run build:site:vercel`
- **THEN** `_site/index.html` is NOT emitted
- **AND** `_site/templates/index.html` is NOT emitted
- **AND** `_site/templates/<slug>/index.html` is NOT emitted
- **AND** `_site/docs/**` is NOT emitted
- **AND** `_site/trust/{index,template-evidence,evidence-story,changelog}/index.html` are NOT emitted

#### Scenario: [OA-DST-029] Marketing paths return 301 redirects to the external marketing host
- **WHEN** an HTTP GET hits `https://openagreements.org/`, `/templates`, `/templates/<slug>`, `/docs`, `/docs/<slug>`, `/trust`, `/trust/system-card`, `/trust/template-evidence`, `/trust/evidence-story`, or `/trust/changelog`
- **THEN** Vercel responds with a 301 redirect to the corresponding `usejunior.com/developer-tools/open-agreements` path
- **AND** the redirect rules are codified in `vercel.json`

#### Scenario: [OA-DST-030] Generated site indexes advertise the canonical origin
- **WHEN** the project builds and emits `_site/{llms.txt,llms-full.txt,sitemap.xml}`
- **THEN** all URLs in those indexes use `https://openagreements.org` as the origin
- **AND** the deployed indexes do not advertise `openagreements.ai` as a canonical URL


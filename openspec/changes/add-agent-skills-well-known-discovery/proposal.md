# Change: Add agent skills well-known discovery

## Why
The `skills` CLI can discover installable skills from website well-known URIs.
OpenAgreements already maintains public skill directories, but
`openagreements.org` does not publish a machine-readable
`/.well-known/agent-skills/index.json` catalog for domain-based discovery.

## What Changes
- Generate a v0.2.0 agent-skills discovery index during the site index build.
- Emit one deterministic ZIP archive per public skill and attach a SHA-256
  digest for each archive.
- Exclude skills marked `metadata.internal: true` from the well-known catalog.
- Document the new well-known path in the repository inventory.

## Impact
- Affected specs: `distribution`
- Affected code: `scripts/generate_site_indexes.mjs`,
  `integration-tests/agent-skills-well-known-discovery.test.ts`,
  `docs/well-known/README.md`

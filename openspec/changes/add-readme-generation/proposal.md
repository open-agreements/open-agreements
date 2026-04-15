# Change: Add generated README workflow

## Why

The repository README now includes large inventory sections for skills,
templates, packages, and documentation links. Those sections are valuable on
GitHub and the npm package page, but they are also high-drift content because
they duplicate data that already exists elsewhere in the repo.

The project already uses generated public artifacts for trust and catalog
surfaces. README content should follow the same pattern so counts, links,
template inventories, and package references stay aligned with the real repo
state and can be enforced in CI.

## What Changes

- Add a generated README workflow driven by a checked-in markdown template and
  repository metadata.
- Extract a pure catalog builder that can be shared between the website and the
  README generator without site-specific side effects.
- Add a helper script to rebuild `README.md` from the template and current
  skills, templates, packages, and docs data.
- Add a CI drift check that fails when `README.md` is out of sync with the
  generated output.

## Impact

- Affected specs: `open-agreements`
- Affected code:
  - `README.md`
  - `README.template.md`
  - `scripts/generate_readme.mjs`
  - `scripts/lib/*`
  - `site/_data/catalog.js`
  - `package.json`
  - `.github/workflows/ci.yml`

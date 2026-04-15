## 1. Shared metadata pipeline

- [x] 1.1 Extract the pure template catalog logic from `site/_data/catalog.js`
      into a reusable helper module with no site-side effects.
- [x] 1.2 Keep website behavior intact by having the Eleventy data file consume
      the shared helper and continue site-specific download preparation.

## 2. README generation

- [x] 2.1 Add a checked-in `README.template.md` for the hand-authored sections.
- [x] 2.2 Add a generation script that rebuilds `README.md` from the template
      plus live repo metadata for skills, templates, packages, and docs links.
- [x] 2.3 Keep the generated README structure compatible with both GitHub and
      npm rendering by using stable headings and absolute links where needed.

## 3. Drift enforcement

- [x] 3.1 Add package scripts for README generation and drift checking.
- [x] 3.2 Add a CI gate that fails when `README.md` is stale relative to the
      generated output.
- [x] 3.3 Verify the generated README matches the committed file after the
      generator runs.

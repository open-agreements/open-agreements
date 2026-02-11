# Change: Add Basic Vercel Landing Site

## Why
OpenAgreements currently has no dedicated web landing page for discovery, trust signals, and clear onboarding links. A simple public site improves first-use clarity and gives a stable destination for demos and install instructions.

## What Changes
- Add a static landing page under `site/` with:
  - product value proposition
  - trust/supporting signals (CI, coverage, npm)
  - clear installation and usage paths (CLI, Claude/skills)
  - demo section linking to the existing NDA GIF
- Add root `vercel.json` so Vercel can deploy the static landing page from this repo.
- Add short documentation for local preview and Vercel deployment.

## Impact
- Affected specs: `open-agreements`
- Affected code/docs: `site/*`, `vercel.json`, `README.md`

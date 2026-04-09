---
title: Changelog & Release Process
description: How release notes are generated and published to the public changelog
section: Reference
---

# Changelog & Release Process

## Goals

- Keep release history public and easy to audit.
- Minimize manual publishing work.
- Use one canonical source of truth for release notes.

## Commit Message Standard

All pull request commits should follow Conventional Commits:

```text
type(scope): short summary
```

Examples:

- `feat(cli): add templates --json filter`
- `fix(site): handle missing template previews`
- `docs(trust): clarify hosted connector data flow`

Allowed types include:

- `feat`
- `fix`
- `docs`
- `chore`
- `refactor`
- `test`
- `build`
- `ci`
- `perf`
- `revert`

## Release Workflow

1. Merge approved PRs into `main`.
2. Bump `package.json` version and create a matching tag (`vX.Y.Z`).
3. Push the tag. The release workflow will:
   - publish the npm package suite with trusted OIDC provenance, including both `open-agreements` and `@open-agreements/open-agreements`,
   - create a GitHub Release with auto-generated notes (if one does not exist),
   - deploy production to Vercel.
4. During site builds, changelog data is generated from GitHub Releases and published on:
   - `/trust/changelog/`

## Skills Directory Publishing

`Smithery` and `ClawHub` are published through the manual GitHub Actions workflow
`Publish Skills Directories`. This is intentionally separate from the npm release
tag flow because skill directory publishing changes public listings and scanner
surfaces.

### Workflow inputs

- `target`: `smithery`, `clawhub`, or `both`
- `scope`: `changed`, `selected`, or `all`
- `selected_skills`: comma-separated slugs when `scope=selected`
- `base_ref`: git base ref for `scope=changed` (defaults to `HEAD^`)
- `clawhub_changelog`: optional changelog text for ClawHub updates
- `dry_run`: defaults to `true` for a safe preview

### Required secrets

- `SMITHERY_API_KEY`: service or restricted token for Smithery publishing
- `CLAWHUB_TOKEN`: token for `clawhub login --token ... --no-browser`

### How skill versions are chosen

The workflow reads each skill's `metadata.version` directly from
`skills/<slug>/SKILL.md` and passes that version to ClawHub. Do not hand-edit a
separate registry version file.

### Operational notes

- Merge the skill changes to `main` first, then run the workflow from the main
  branch.
- Use `dry_run=true` first when publishing a new batch.
- `skills.sh` is **not** a direct CI publish target. Treat it as a
  discovery/indexing surface rather than a registry with a supported publish API.

## Required Gemini Local Extension Gate

Before pushing a release tag, run a local Gemini extension install smoke test:

1. Copy or symlink this repo checkout into `~/.gemini/extensions/open-agreements`.
2. Verify `gemini-extension.json` is valid and includes:
   - `name`, `version`, `description`, `contextFileName`, `entrypoint`, `mcpServers`
   - two local servers (`contracts-workspace-mcp`, `contract-templates-mcp`)
   - no `cwd` overrides
3. Start Gemini and confirm both MCP servers initialize and respond.

Tagging is blocked until this gate passes.

## Local Preview

```bash
npm run generate:changelog-data
npm run build:site
```

Then open the generated Trust changelog page from `_site/trust/changelog/index.html`.

## Editing Release Notes

If a published note needs adjustment, edit the GitHub Release body. The next site build will pick up the updated notes automatically.

# Change: add template author metadata

## Why
Template authorship is currently flattened into generic attribution text. That makes it hard for downstream consumers to credit specific drafters, render author bios, and attach visible authorship to public template pages.

## What Changes
- Add optional structured `authors` metadata to internal and external template metadata.
- Include structured `authors` in `list --json` output when present.
- Add structured author metadata to OpenAgreements-authored employment templates and Joey Tsang-authored SAFE consent templates.

## Impact
- Affected specs: `open-agreements`
- Affected code: `src/core/metadata.ts`, `src/commands/list.ts`, template `metadata.yaml` files with author metadata, `data/templates-snapshot.json`

# Change: add template author metadata

## Why
Template authorship is currently flattened into generic attribution text. That makes it hard for downstream consumers to credit specific drafters, render author bios, and attach visible authorship to public template pages.

## What Changes
- Add optional structured `authors` metadata to internal and external template metadata.
- Include structured `authors` in `list --json` output when present.
- Attach Joey Tsang as the primary author of the Wyoming restrictive covenant template.

## Impact
- Affected specs: `open-agreements`
- Affected code: `src/core/metadata.ts`, `src/commands/list.ts`, `content/templates/openagreements-restrictive-covenant-wyoming/metadata.yaml`, `data/templates-snapshot.json`

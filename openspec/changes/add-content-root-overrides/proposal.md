# Change: Add optional content root overrides for template discovery

## Why

Today OpenAgreements always loads `templates/`, `external/`, and `recipes/`
from the bundled package root. This is simple, but as the form library grows,
space-conscious users may want to keep large content libraries outside the core
package while still using the same CLI.

A low-overhead future-proofing path is to keep bundled behavior as default and
allow optional, explicit override roots for advanced users.

## What Changes

- Add optional env var `OPEN_AGREEMENTS_CONTENT_ROOTS` (path-delimited list)
  for additional content roots.
- Discover templates/external/recipes across override roots first, then fall
  back to bundled package content.
- Preserve default behavior for users who do not set the env var.
- Dedupe duplicate IDs by precedence (first root wins).
- Update `fill`, `list`, and `validate` to use merged content roots.
- Add tests for root override discovery and precedence.
- Add README documentation for the env var and expected directory structure.

## Impact

- Affected specs: `open-agreements`
- Affected code:
  - `src/utils/paths.ts`
  - `src/commands/fill.ts`
  - `src/commands/list.ts`
  - `src/commands/validate.ts`
  - `tests/content-roots.test.ts`
  - `README.md`
- Backward compatibility:
  - No behavior change for users without `OPEN_AGREEMENTS_CONTENT_ROOTS`

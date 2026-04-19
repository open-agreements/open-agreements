# Two-Sidecar Metadata Ownership

Some templates in `content/templates/*/` have a sibling file named
`metadata.legal-context.yaml`. This document explains what it is, who owns it,
and what contributors should and shouldn't do with it.

## TL;DR

| File | Hand-edit? | Notes |
|------|------------|-------|
| `metadata.yaml` | Yes | Hand-authored template metadata. Contributors edit this. |
| `metadata.legal-context.yaml` | **No** | **Generated.** Overwritten by the project's editorial backend. |

The filename tells you the ownership boundary. Anything with a `.legal-context.`
infix in its filename is a generated artifact — hand-edits will be stomped the
next time the maintainers regenerate it.

## Why two files?

Some metadata is pure template structure — field names, types, UI sections,
priority fields, descriptions, license, attribution, category. That's
hand-authored in `metadata.yaml` by anyone contributing a template.

Other metadata is derived from curated legal research — the `default` values
lawyers endorse, the `default_value_rationale` explaining why, and the
`options` array for multi-choice fields. Those values are maintained as part
of a separate editorial workflow and pushed into `metadata.legal-context.yaml`
by the project's maintainers.

Splitting these into two files keeps ownership obvious. A contributor looking
at a changed file knows from the filename alone whether their edit will
survive or will be overwritten.

## What keys may the sidecar set?

Per field entry:

- `name` — must match a field name declared in the sibling `metadata.yaml`
- `default`
- `default_value_rationale`
- `options`
- `display`

Any other top-level key (e.g. `description`, `type`, `section`) implies the
sidecar is claiming ownership of template structure, which it isn't. The CI
lint at `scripts/validate_metadata_sidecar.mjs` enforces this.

## Fill-pipeline merge rule

At fill time, `loadMetadata(templateDir)` in `src/core/metadata.ts` merges
the two files per field. The merge is an **owned-key replace**, not a deep
merge: when a field appears in both files, the sidecar's four owned keys
(`default`, `default_value_rationale`, `options`, `display`) overwrite
whatever those keys held on the metadata.yaml field. Every other key on the
field (`name`, `type`, `description`, `section`, `items`, …) comes from
metadata.yaml unchanged. For object-valued keys like `display`, the override
is a full replacement — sibling keys on a metadata.yaml `display` object are
discarded. If you need to preserve some sub-keys, don't let the sidecar
manage `display` on that field.

- Fields in both, where neither also sets an owned key in metadata.yaml:
  merged cleanly per above.
- Fields only in `metadata.yaml`: pass through unchanged.
- Fields only in the sidecar: **runtime error** (and CI-lint failure) —
  means the template renamed or removed a field and the sidecar wasn't
  regenerated.
- Both files setting the same owned key for the same field: **runtime
  error** (and CI-lint failure) — single-ownership rule.
- Duplicate field names in the sidecar: **runtime error** (and CI-lint
  failure) — each field may appear at most once in the sidecar.

After applying sidecar overrides, the merged metadata is re-validated
against the full `TemplateMetadataSchema`, so a sidecar can't inject values
that violate a field's declared type (e.g. a string default on a
boolean-typed field).

## Guidance for contributors

### What you should do

- Improve existing templates and add new ones by editing `metadata.yaml`,
  `template.md`, and `content.md` as usual.
- If you find incorrect legal guidance (e.g. a `default_value_rationale`
  that cites outdated law), open a PR or issue pointing at the specific
  field. A maintainer will update the editorial source and regenerate
  the sidecar.
- If you have a DOCX version of a template a maintainer can convert into
  the canonical markdown format, attach it to the PR or issue and a
  maintainer will do the conversion.

### What you should not do

- Don't hand-edit `metadata.legal-context.yaml`. Edits there will not
  survive the next regeneration. If something in that file is wrong, the
  fix belongs in the editorial pipeline upstream, which a maintainer
  handles.
- Don't rename fields in `metadata.yaml` without coordinating. A rename
  will fail the `validate_metadata_sidecar.mjs` CI lint until the sidecar
  is regenerated, which only the maintainers can do.

### What to do if the CI lint fails because of a field rename

Two options:

1. Coordinate with a maintainer — flag the rename in the PR description and
   they'll regenerate the sidecar against the new field name before merging.
2. In the same PR, delete `metadata.legal-context.yaml` entirely. The
   template will fall back to the hand-authored defaults in `metadata.yaml`
   (if any). A maintainer will re-generate the sidecar in a follow-up once
   the editorial source catches up.

Option 1 is preferred for templates with many downstream consumers.

## References

- `scripts/validate_metadata_sidecar.mjs` — CI lint enforcing the rules above.
- `src/core/metadata.ts` — loader + deep-merge.
- `docs/adding-templates.md` — general template-authoring guide.

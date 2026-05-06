## Context
The current branch still generates employment templates directly from JSON
specs. An upstream worktree already includes a canonical-source compiler, but
its definition syntax is too schema-heavy for lawyer-facing authoring:
per-definition IDs, visible cover-row IDs, and `[[def:...]]` references make
the source read more like serialized structure than contract prose.

## Goals
- Keep the authoring document readable as normal Markdown/legal prose.
- Use the established repo convention that `template.md` is the canonical
  source filename.
- Preserve explicit clause IDs where they buy stable machine references.
- Remove per-definition IDs and visible cover-row IDs from the authoring layer.
- Allow optional explicit defined-term references without requiring them
  everywhere.
- Carry enough structure into compiled JSON specs to render DOCX and Markdown
  deterministically.

## Non-Goals
- Rework the broader Contract IR pipeline.
- Add automatic enrichment for plain-text defined-term mentions.
- Support arbitrary multi-paragraph or note-rich definition blocks in v1.

## Decisions

### Cover terms
The canonical cover-term table uses visible columns:

`Kind | Label | Value | Show When`

Rows are identified by position plus label, not by a visible ID column. The
compiler reads `Show When` and projects it to the existing `condition` field in
the JSON spec.

### Definitions
Inside a clause marked with `oa:clause ... type=definitions`, each blank-line
separated paragraph is a definition paragraph. The first `[[...]]` span in that
paragraph declares the canonical defined term. The compiler strips any optional
leading article (`a`, `an`, or `the`) from the declaration site and stores the
canonical term separately from the definition body.

Optional aliases are declared immediately after the canonical term via:

`(Aliases: [[Alias 1]], [[Alias 2]])`

Aliases are authoring metadata. They are stored in the compiled JSON spec but
do not render into the final legal Markdown or DOCX.

### Explicit references
Outside the declaration site, `[[...]]` is an explicit reference. It may match
either a canonical defined term or an alias. Plain text remains valid and is
not automatically validated. Existing `[[clause:<id>]]` clause cross-references
remain supported.

### Signatures
Inline `oa:signature-mode` and `oa:signer` directives replace the trailing
signature layout metadata table. The compiler projects that source into the
existing shared renderer via a `signers` signature mode.

### Artifact strategy
For migrated employment templates, `template.md` is the checked-in canonical
source. The checked-in generated artifact is `template.docx`. The renderer may
still derive an in-memory Markdown preview from the normalized model, but v1
does not require writing a second rendered Markdown file back into the template
directory.

## Validation rules
- Canonical defined terms must be unique.
- Aliases must be unique across the document.
- An alias may not collide with a canonical term.
- Explicit `[[...]]` references must resolve to a canonical term, alias, or
  supported clause ID reference.
- Non-empty paragraphs inside the definitions clause must contain a canonical
  `[[...]]` declaration in v1.

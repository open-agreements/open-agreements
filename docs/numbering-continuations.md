# Explicit numbering continuations

Some source-authored outline headings use a concrete numbering override while
their children use the main outline instance. Section normalization must not
silently separate those headings from their children. It also must not merge
independent lists merely because they share an abstract numbering definition.

`normalize.json` can explicitly declare approved continuations:

```json
{
  "numbering_continuations": {
    "source_sha256": "<64-character lowercase SHA-256 of the original DOCX>",
    "source_num_id": "1",
    "headings": [
      {
        "anchor": "Continued heading",
        "num_id": "2",
        "expected_abstract_num_id": "0",
        "ilvl": 1,
        "expected_starts": { "0": 2, "1": 3, "2": 1 }
      }
    ]
  }
}
```

The example is illustrative; replace the hash and every source-specific value
with independently inspected source facts. Canonical recipe declarations belong
upstream, not in the generic runtime.

## Contract

- The original input bytes must match `source_sha256` before the fill pipeline
  starts. Source validation is mandatory even when an explicit input path is used.
- Every declaration must identify exactly one original paragraph and exactly one
  use of its concrete numbering instance. The paragraph's numbering and outline
  levels must match `ilvl` (1 through 8).
- Anchors compare concatenated Word text after whitespace normalization, removal
  of square brackets, and removal of one terminal period. This permits ordinary
  optional-heading cleanup without substring matching or regex guesses.
- A declared instance must reference `expected_abstract_num_id`. Its only children
  may be that abstract link and `lvlOverride`
  elements containing only `startOverride`. `expected_starts` must specify the
  exact concrete override set; `{}` means no overrides (starts come from the
  pinned abstract). Additional
  or changed overrides, replacement levels, and numbering-style links fail closed.
- A different abstract is accepted only when levels 0 through `ilvl` have matching
  counter semantics and formatting. Starts and paragraph-style associations are
  excluded from that comparison. The only font exception is an otherwise empty
  `rFonts` with `hint="default"`, equivalent to no explicit hint. Font names,
  themes, indents, glyphs, restart rules, and suffixes must match. Unused levels
  may differ because a declared instance has exactly one paragraph at its declared
  level; they are never rebound as a family. Source-instance overrides are unsupported.
- After selection, a declaration can be absent only when both its anchor and its
  concrete instance are gone. A remaining mismatched or duplicated anchor or
  instance fails before normalized output is written.
- Only explicitly declared headings join the existing active section stream.
  Their children already using that stream then inherit the correct parent and
  ordinary restart semantics. Undeclared instances remain unchanged, including
  independent lists and intentional restarts sharing the same abstract definition.
- The normalizer accepts only an in-process plan produced by original-source
  validation. A caller cannot bypass the original hash check by passing plain JSON
  directly to its post-selection entry point.
- The opaque plan fingerprints the original source and target instances and
  entire abstract definitions. Any post-validation change, even to an unused
  level or default start, fails closed before output normalization.

Capability: `normalize.numbering-continuations.v1`. Consumers must inspect this
operation when checking runtime compatibility. Old strict normalize loaders
reject the unknown key rather than silently ignoring it.

## Regression and scope

The historical defect normalized only the dominant concrete instance. Source
override headings stayed on the old abstract definition while children moved to
section-specific definitions. A heading numbered 2.12 could therefore acquire
children whose full numbering context still resolved to 2.11.

Correction (2026-09-08): the initial implementation required the same abstract ID. A complete source
inventory showed a compatible heading on a separate abstract, preceding another
manual heading. Omitting that first heading left the shared parent stream one
step behind. The corrected contract therefore supports individually declared,
compatible different-abstract headings, with complete source fingerprints and
used-level formatting checks; it never infers continuation from similarity.

Tests use synthetic DOCX fixtures to verify pinned-source validation, drift
rejection, declaration-only rebinding, selection removal, and preservation of an
undeclared restart. Real-source smoke documents and references stay local-only.
This feature does not modify legal wording, add style-separator carriers, freeze
editable numbering, or evaluate REF fields. Renderer-only REF handling is a
separate concern.

Known existing resolver limitation: an outline-only paragraph style with no
numbering instance in its inheritance chain can lose its outline value when
the paragraph supplies numbering directly. Such a continuation is safely
rejected by the level/outline guard, not silently rebound. Supporting that style
shape requires a separate paragraph-numbering inheritance fix; this change does
not claim it is supported.

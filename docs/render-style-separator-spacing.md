# Source-declared style-separator spacing

Capability: `render.style-separator-spacing.v1`. This is an **opt-in, render-only**
correction for independently audited, source-pinned paragraph pairs. It does not
modify the editable DOCX or automatically repair arbitrary style separators.

Some LibreOffice imports raise the first continuation line beside a hidden
heading with positive paragraph-before spacing. For the supported source shape,
moving that spacing from the hidden heading to its continuation aligns the first
body line. Vertical spacing and downstream pagination can change; original
heading coordinates or pagination are not guaranteed. Wrapped headings can have other
import defects that this correction does not repair. A fingerprint is not a font
measurement or proof that a heading fits on one line.

Canonical recipe authors declare the supported pairs in `metadata.yaml`:

```yaml
source_sha256: <unmodified-source-sha256>
rendering:
  style_separator_spacing:
    boundaries:
      - heading_para_id: AAAAAAAA
        continuation_para_id: BBBBBBBB
        before_twips: 240
        expected_layout_sha256: <audited-source-local-layout-sha256>
```

The runtime exports `inspectStyleSeparatorSpacingSource` from its implementation
module as an authoring aid for computing each layout fingerprint. Authors must
first audit the source and actual rendered controls, including all declared pairs,
page-top placement, line wrapping, nearby references and the other suite documents.
Every declared pair is required; only declare mandatory pairs in this version.
The declaration belongs upstream with the canonical source recipe, not in a
benchmark-specific script. Consumers must require the capability when this
metadata operation is present; an old parser can otherwise silently discard it.

```sh
open-agreements field-selector render-copy editable.docx -o preview.render.docx \
  --style-separator-metadata canonical/metadata.yaml \
  --style-separator-source pinned-source.docx
```

Both options are required together. The default remains unchanged. API callers
pass `styleSeparatorSpacing: {sourcePath, sourceSha256, profile}` as a member of
the third `createNumberingRenderCopy` argument. `profile` is the nested metadata
declaration above. This can be combined with the host-verified glyph-font option.

Before writing a new output, the runtime verifies the actual source hash, unique
adjacent main-body paragraph IDs, the source-local fingerprint, and the same
fingerprint in the editable input. It binds heading text/run properties,
paragraph properties, the leading period's formatting, relevant paragraph and
character-style chains, defaults, applicable page geometry and compatibility
settings. Mutable body prose is deliberately not bound. Runtime-owned `numPr`,
editing-session IDs and inert `xml:space` additions on text without edge whitespace
are excluded. Meaningful edge whitespace remains bound.

Supported pairs have an explicit hidden heading mark, positive direct twip-based
before spacing, an initially zero-before continuation in the same style family,
matching text metrics and a plain leading period (possibly sharing its prose run).
Ambiguous styles, style toggles, revisions, explicit breaks, frame/section changes,
automatic/line-unit spacing, missing pairs and fingerprint drift fail closed.
No paragraphs, text, bookmark events, run formatting or numbering are moved.

The optional `styleSeparatorSpacing` receipt records `sourceSha256`,
`profileSha256`, `replacements` and `headingParaIds`. Controllers must seal the
canonical metadata/source inputs, explicitly pass both options, bind the receipt
to those inputs, and verify the actual PDF on the selected render host. Omitting
the options does not apply the declaration. Do not deliver the temporary render
copy as the editable agreement or claim Word/layout certification from this receipt.

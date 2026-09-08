# Optional nonbreaking-hyphen font in render copies

Some LibreOffice/font combinations render U+2011 as a missing-glyph square.
Changing `w:noBreakHyphen` to equivalent Unicode text alone does not reliably
enable fallback. An optional, explicit font override isolates only that glyph
in the disposable render copy:

```sh
open-agreements field-selector render-copy editable.docx -o preview.render.docx \
  --nonbreaking-hyphen-font "Host Verified Font Family"
```

The API accepts a third options argument:
`createNumberingRenderCopy(input, output, { nonbreakingHyphenFont: family })`.
Capability: `render.nonbreaking-hyphen-font.v1`.

Default behavior is unchanged. The original editable DOCX remains byte-identical.
Only main-document `w:noBreakHyphen` tokens and U+2011 characters in text runs are
isolated into glyph runs with the requested font. Other text and its font,
formatting, bookmarks and field events are preserved. The hyphen remains U+2011,
not an ordinary breakable ASCII hyphen. Glyphs in other stories, AlternateContent,
textboxes, ruby or tracked-revision contexts are rejected before output creation.
This is not a general font substitution or style-flattening facility.

The returned JSON includes an optional receipt:

```json
{
  "glyphFallback": {
    "fontFamily": "Host Verified Font Family",
    "codePoint": "U+2011",
    "replacements": 2,
    "parts": ["word/document.xml"]
  }
}
```

**The render host/controller must verify font availability and U+2011 coverage.**
The core library deliberately does not discover, install, or select fonts, and
the receipt is not an availability certificate. A sealed rendering workflow
should record the resolved family, font file hash, renderer identity and coverage
check, then bind those facts to the requested family and output receipt. Do not
let a builder silently choose a substitute family. No machine-specific font
belongs in canonical template metadata.

Different glyph metrics can cause line/page reflow. Validate the actual PDF and
nonbreaking behavior on the actual rendering host; do not claim pixel identity.
No change to editable legal text or whole-document font family is implied.

## Reproduction history

On 2026-09-08, an unchanged pinned source and a synthetic Times New Roman control
both displayed squares for the OOXML token and literal U+2011. The installed
font lacked that code point. A host-verified supporting font on only the glyph
fixed the visual output; a narrow-line test kept the compound word together
while the ASCII-hyphen control broke. This corrected the initial hypothesis that
token-to-Unicode materialization alone would resolve fallback.

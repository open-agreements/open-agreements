# Numbering-safe PDF rendering

Keep the filled DOCX as the editable deliverable. For PDF conversion, prepare a
separate disposable copy:

```sh
open-agreements field-selector render-copy agreement.docx -o agreement.render.docx
soffice --headless --convert-to pdf --outdir rendered agreement.render.docx
```

The first command prints JSON with `renderOnly: true`, source/output SHA-256,
and counts of snapshotted `paragraphs` and materialized numeric `references`.
Retain this receipt and the actual
converter command, exit status and output with the run evidence. Rename the PDF
to the intended deliverable name if necessary; do not rename or deliver the
`.render.docx` as the editable agreement.

The output must be a **new** `*.render.docx`; input replacement, existing files,
and chained render copies are rejected. The original DOCX bytes and automatic
numbering are unchanged. The render copy freezes effective list counters into
independent instances solely for a static PDF, preserving ordinary text,
bookmarks, number formats and paragraph layout. Numeric references must be
evaluated from the same final counter snapshot; their editable fields remain
in the original, not in the disposable copy. Unsupported numbering structures
fail closed rather than silently choosing labels. Inspect rendered references
and all numbering levels; preparation is not a production-readiness verdict.

This first version handles main-story numbering, including tables. Numbering or
REF fields within mutually exclusive `AlternateContent` branches are rejected;
the tool does not guess which renderer-specific branch to select. Numbered
textboxes and numbering or REF fields in headers, footers, footnotes, endnotes,
or comments are rejected rather than silently omitted. Prepare the **filled**
document, after the normal recipe cleanup; unfilled source forms may still
contain instructional footnotes that are outside this rendering scope.

Numeric REF evaluation is deliberately bounded: decimal, alphabetic counters
1–26, Roman counters 1–3999, and English ordinal words 1–20. Supported switches
are `n`, `r`, `w`, `h`, `t`, and `MERGEFORMAT`; combined numeric switches use
`r` before `n` before `w`. Relative references use the preceding numbered
paragraph's concrete list context, not heading-text guesses. Composite level
labels stay intact. The `t` switch suppresses literal label text according to
the documented Word semantics; LibreOffice does not consistently do that
itself. Unsupported fields, ambiguous or incomplete bookmark targets, and
unsupported languages or formats fail closed. This is not a general Word
field evaluator or a guarantee of identical pagination across renderers.

## Why this is separate from filling

In the pinned IRA source, LibreOffice imports mixed ordinary headings and Word
style-separator headings into inconsistent counter streams. A shared explicit
numbering ID alone does not fix its PDF output. A proposed uniform-separator
repair corrected section numbers but regressed nested alphabetic labels; it
was rejected after visual checks. Freezing every heading in the editable
document would instead impair later automatic renumbering. This separate
render-only path avoids both compromises. This is a reproduced LibreOffice
interoperability defect, not a claim of a reproduced Word display failure.

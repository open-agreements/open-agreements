# Change: Cover confirmation notice — live section cross-reference + hyperlinks

## Why
The page-one confirmation notice (shipped in `add-confirmation-cover-notice`, #418) lists each
unconfirmed statutory-compliance item as a plain-text bullet that locates its in-body clause **by
section name only** and prints the authority URL as **plain, unclickable text** (issue #416). Two
gaps:

1. **No live section number / jump.** A reader must hand-scan the Standard Terms for the named
   heading. The bullet should name the clause's resolved number ("Section N") and let the reader
   click to jump there. The number must stay correct after clause omission/renumbering.
2. **The reference URL is not a link.** "for more details see <url>" is plain text; it should be a
   real clickable hyperlink.

A naive static "Section N" baked at render time would rot, because clause numbers are literal text
re-sequenced by the post-fill `renumberClauseHeadings` pass after `{IF}` conditionals resolve.

## What Changes
- **Heading anchors (authoring/renderer).** The renderer wraps each `confirm=` clause heading in a
  bookmark (`oa_xref_<hash>`, hashed to satisfy Word's bookmark-name rules) so the cover notice can
  target it. Anchors are emitted only for clauses the notice links to, keeping the footprint to
  templates that have confirm clauses (today: Florida only).
- **Cover bullet structure (renderer).** Each bullet becomes
  `• <Section N jump> — <heading> — for more details see <url>`: the section number is a
  `<<xref:<bookmark>>>` sentinel wrapped in an internal hyperlink to the heading bookmark, and the
  URL is a real external hyperlink. The notice still never emits the literal `[CONFIRM before
  signing:` token.
- **Sentinel resolution (engine).** The post-fill `renumberClauseHeadings` pass, in the same DOM
  walk that assigns numbers, maps each heading's `oa_xref_*` bookmark to its resolved number and
  rewrites every `<<xref:<bookmark>>>` sentinel to the live "Section N". A present bullet always has
  a present target heading (both share the same `{IF}` gating), so the number is always resolvable.
- **Catalog preview (engine).** `humanizeDocx` renders any stray sentinel as a neutral `Section [#]`
  placeholder (defense-in-depth; the notice's conditional bullets are already dropped from the
  unfilled preview).

Out of scope (tracked separately, #420): converting the repository-wide `[[clause:<id>]]` mechanism
to live Word `REF` fields. The spike showed Word `REF` number switches render **blank** in the
LibreOffice preview because clauses use literal-text numbering, not native Word list numbering — a
true auto-updating cross-reference requires migrating clause numbering first. The internal-anchor +
static-number approach here renders correctly in both Word and the LibreOffice preview today.

## Impact
- Affected specs: `authoring` (heading anchors, bullet structure), `engine` (sentinel resolution,
  preview placeholder).
- Affected code: `scripts/template_renderer/layouts/cover-standard-signature-v1.mjs`,
  `src/core/fill-pipeline.ts`, `src/core/humanize-docx.ts`.
- Regenerated artifact: the Florida template `template.docx` (only template with confirm clauses).
- No change to `checkStatutoryComplianceReps` or the `any_confirmation_pending` gating; the in-body
  `[CONFIRM …; see <url>]` bracket stays plain text.

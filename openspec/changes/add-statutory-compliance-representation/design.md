## Context
Recitals speak as of signing, so a past-tense compliance recital asserts a fact that
must already have happened. The renderer (`template.md` → contract spec → `template.docx`)
reads only `template.md`; the metadata schema/validator and MCP read `metadata.yaml`. The
fill pipeline already keeps yellow `<w:highlight>` on runs that have no filled `{field}`
tag, so a static highlighted bracket survives a fill while filled placeholders get their
highlight stripped.

## Goals / Non-Goals
- Goals: a reusable, narrow mechanism that renders a compliance recital clean when
  confirmed and as a visible highlighted bracket when unconfirmed; surface the warning to
  the calling LLM before `fill_template`; catch metadata↔template drift.
- Non-Goals: general (non-statutory) representations; the rejected #408 options; changing
  the markdown/humanize download path's existing negated-block behavior.

## Decisions
- **Boolean flag, not an enum `field_category`.** A single narrow opt-in category; an enum
  would be premature abstraction that invites broader use than #408 wants.
- **`metadata.yaml` is the single source of truth for `authority_url` and `confirm_note`**
  (issue #413). The canonical compiler resolves a `confirm=<field>` clause's note and URL
  from that field's `metadata.yaml` entry via a field lookup built in
  `compileCanonicalSourceFile` (sharing the `loadMetadataFromDir` loader), so the directive
  shrinks to `confirm=<field>` and MUST NOT restate `confirm_note`/`authority_url`.
  `confirm_note` is a metadata field property scoped (like `authority_url`) to
  `statutory_compliance_representation` fields. The validator's URL/note equality check is
  retained but reframed: it no longer guards two hand-edited files, it guards the committed
  rendered artifact (`template.docx`) against the metadata (catching a stale, un-regenerated
  DOCX) and hand-authored JSON templates.
- **Validator scans for the literal bracket, not just `{IF !field}`.** The legacy
  `when=field omitted="…"` path also emits `{IF !field}`, so presence of the conditional
  is insufficient proof the CONFIRM bracket is wired. The validator requires
  `{IF !<field>}` immediately followed by `[CONFIRM before signing: …]` and a matching URL.
- **Strict `confirm=` parser.** Unlike `when=`, `always` is not a sentinel — a confirm
  gate must name a real boolean field, so any non-field-name value is an error (avoids
  silently disabling the mechanism).
- **Warning rides in `description`.** No `requiresConfirmation` array; the description
  already flows through `get_template`, so no MCP code change.

## Risks / Trade-offs
- The catalog preview / humanized download strips negated `{IF !field}` blocks, so the
  CONFIRM bracket is not shown there — only in the actual `fill_template`/CLI output.
  Acceptable: the preview is a marketing artifact and this matches existing negated-block
  behavior. → Out of scope to change the humanize path.

## Migration Plan
Migrate Florida's `choice-act-counsel-notice` clause (id unchanged) from `when=`/`omitted`
to `confirm=`; mark `choice_act_advance_notice_confirmed` as a
`statutory_compliance_representation`. Regenerate the docx + generated JSON and pin the
byte-identical preview in the freshness manifest.

## Open Questions
- None.

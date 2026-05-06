## Context

PR #237 began as a spike that moved the SAFE consents onto hand-authored
`template.json` plus repeat-aware signature rendering. The agreed direction is
stricter: OpenAgreements-authored branded templates should use canonical
`template.md` as the authored source, with JSON generated from that source
rather than edited by hand.

The SAFE board and stockholder consents are also the only remaining branded
templates that still carry consent-local Contract IR sidecars (`schema.yaml`,
`styles.yaml`, `clean.json`) and a dedicated generation script.

## Goals

- Keep a single OpenAgreements-authored branded template path:
  canonical `template.md` -> generated JSON spec -> rendered DOCX.
- Make array-driven signer blocks authorable directly in canonical Markdown.
- Remove consent-only Contract IR scaffolding once the SAFE consents are
  canonical Markdown templates.

## Non-Goals

- Introduce a consent-specific layout.
- Restore source-only drafting notes or omit-on-fill cleanup behavior.
- Redesign the visual style for Delaware governance documents in this change.

## Decisions

### Decision: repeat-backed stacked signers stay declarative at signature-mode

Canonical authoring adds repeat metadata to `oa:signature-mode`:

```html
<!-- oa:signature-mode arrangement=stacked repeat=board_members item=member -->
```

The author writes one signer prototype using `{member.*}` fields. The compiler
normalizes those row references into loop-safe renderer placeholders such as
`{$member.name}`, and the shared renderer emits the corresponding
`{FOR ...}` / `{END-FOR ...}` loop markers.

Why:
- Keeps the authored legal source readable.
- Avoids a consent-specific layout or signer DSL.
- Reuses the existing fill pipeline behavior for array loops.

### Decision: remove the consent-only Contract IR path

Once the SAFE consents are canonical Markdown templates, the old Contract IR
support used only by those templates becomes dead weight:
- no remaining branded template depends on `schema.yaml` / `styles.yaml`
- `generate_templates.mjs` already owns branded template generation
- catalog markdown downloads should expose canonical `template.md`, not a
  second rendered Markdown artifact

This change removes the consent-only generator, sidecars, and related docs
rather than preserving a second dormant authoring path.

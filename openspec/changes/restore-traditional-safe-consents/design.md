## Context

PR #254 (`update-safe-consents-to-canonical-markdown`) migrated the SAFE board and stockholder consents from Contract IR to canonical Markdown. The legacy Contract IR + per-template `styles.yaml` rendered the traditional Series Seed structure faithfully. The canonical-Markdown layout introduced in PR #254 (`cover-standard-signature-v1`) is built around a cover-page table — which is not part of the traditional structure. That visual regression is the trigger for this change.

Joey Tsang's reference DOCX (`content/templates/openagreements-board-consent-safe/reference-source.docx`) and the Cooley open-source Series Seed source (https://github.com/CooleyLLP/seriesseed) both follow the no-cover-page structure. This change restores that structure on the canonical-Markdown pipeline.

## Goals

- Same slugs (`openagreements-board-consent-safe`, `openagreements-stockholder-consent-safe`).
- Truly traditional rendered output: no cover table, centered all-caps title, italic drafting note, opening recital, centered+bold+underlined section headings, WHEREAS/RESOLVED chain, signature stack.
- Reuse canonical-Markdown machinery (FOR/END-FOR signer loops, fill-pipeline empty-array rejection, validateTemplate FOR-loop typing).

## Non-Goals

- Generalize to non-SAFE consents.
- Add the SAFE form variant/version to either consent.
- Restore Contract IR (deleted in PR #254; leave deleted).

## Decisions

### Decision: New layout module `traditional-consent-v1` (Option B from peer review)

Rather than extend `cover-standard-signature-v1` with a "no cover" flag, build a separate layout module. The two visual languages (cover-table vs. centered-title) diverge enough that a flag would create maintenance debt at 6-12 months. The new layout shares no rendering helpers with `cover-standard-signature-v1` to keep the boundary clean.

### Decision: `cover_terms` becomes optional in canonical schema and compiler

Templates can omit `sections.cover_terms` from frontmatter and `## Cover Terms` from the body simultaneously. The compiler validates that both are present together or both are absent — never one without the other. Existing cover-table templates are unaffected.

### Decision: First-class `document.opening_note` and `document.opening_recital` fields

The italic drafting note and opening recital are layout-specific concepts. Rather than rely on freeform `*italic*` body text (which the canonical-Markdown compiler doesn't parse for inline emphasis), make them first-class frontmatter fields that the layout module renders with the appropriate styling.

### Decision: Inline `**bold**` parsing in the new layout's body paragraphs

Joey's reference uses `**WHEREAS**`, `**RESOLVED**`, `**RESOLVED FURTHER**` lead-ins. The new layout parses inline `**...**` markdown and emits bold runs in the DOCX. This is local to `traditional-consent-v1.mjs` and does not affect other layouts.

### Decision: Version bump `1.1 → 1.2`

The legal text and visual structure change materially. Bumping the patch version signals the change to anyone who pinned `1.1`.

### Decision: New scenario IDs (do not reuse OA-TMP-036/-037/-038)

OA-TMP-036/-037/-038 are already bound to canonical-authoring scenarios from PR #254. Allocate fresh IDs (OA-TMP-040 onward) for the traditional-restore scenarios.

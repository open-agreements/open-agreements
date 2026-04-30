## Context
The SAFE consents currently generate from Contract IR `template.md` plus
external `schema.yaml` and `styles.yaml` files. The new colocated JSON-spec path
expects `template.json` to be the canonical source and to drive `template.docx`
and `template.md` generation directly. A straight content rewrite is not enough,
because these consents also depend on runtime `{FOR}` loops for variable signer
counts.

## Goals
- Put both SAFE consents on the same colocated JSON path consumed by
  `dev-website`.
- Preserve loop-based signer expansion during fill.
- Keep the renderer change narrow and reusable.

## Non-Goals
- Rework the broader Contract IR pipeline for templates that still need it.
- Invent a second hand-authored consent DSL.
- Change fill-engine loop semantics.

## Decisions

### 1. Stacked signer sections stay loop-backed in the generated DOCX
The JSON spec will describe a stacked signer section that renders literal
`{FOR ...}` / `{$...}` / `{END-FOR ...}` markers into the generated DOCX
template. This preserves the existing fill-time array expansion behavior rather
than unrolling a fixed number of signer blocks at spec-authoring time.

### 2. The spec declares the signer collection explicitly
The stacked signer branch needs to know both the loop variable and the array
field name. The signature schema will therefore carry an explicit repeat target
for loop-backed stacked signer sections instead of inferring it from placeholder
text.

### 3. Consent templates move fully onto `template.json`
After migration, the canonical consent source lives in `template.json`. The
generated artifacts remain `template.docx` and `template.md`. The old Contract
IR-specific `schema.yaml`, `styles.yaml`, and source `template.md` files are no
longer part of the authoring path.

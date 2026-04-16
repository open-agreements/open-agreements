## Context
The runtime already uses `docx-templates` directly for fill rendering. Upstream supports `{IF}` / `{END-IF}` and `{FOR}` / `{END-FOR}` for paragraph and table repetition. This repo also already passes array values straight through to `createReport()`, and `working-group-list` proves array loops render successfully today.

The two missing pieces are:
- A reliable, documented pattern for pruning extra fixed signer slots without changing global blank-placeholder behavior
- Machine-readable array item schemas so clients know the object shape to pass into repeating arrays

## Goals
- Preserve current blank-placeholder behavior for ordinary optional fields
- Avoid introducing new template syntax when existing `docx-templates` control tags already work
- Expose array item schemas in a form that both CLI and MCP clients can consume directly

## Non-Goals
- Changing the global defaulting behavior for all optional string/date fields
- Adding bespoke OOXML marker syntax for signature blocks
- Migrating held Cooley consent templates in this change

## Decisions

### 1. Feature B uses existing `{IF}` blocks, not a new signature-block marker
Optional extra signer slots will be authored as:

```text
{IF signer_2_name}
_______
{signer_2_name}
Date: {signer_2_date}
{END-IF}
```

The anchor field (`signer_2_name` in this example) must declare `default: ""` in `metadata.yaml`. That keeps the field falsey during template-path fills, so `docx-templates` removes the whole block. This is already compatible with the current renderer and avoids inventing a second pruning mechanism.

### 2. Global blank-placeholder behavior remains unchanged
`prepareFillData()` currently defaults omitted template-path fields to `BLANK_PLACEHOLDER`. Existing templates depend on that visible behavior, and the current OpenSpec spec explicitly documents it. We will not special-case all optional signer fields in the engine. Instead, template authors opt into pruning with an explicit field default of `""`.

### 3. Array item schemas use nested `items` field definitions
Array fields in `metadata.yaml` gain an optional `items` property:

```yaml
- name: signers
  type: array
  description: Signers on the document
  items:
    - name: name
      type: string
      description: Printed signer name
    - name: title
      type: string
      description: Printed signer title
```

This stays close to JSON Schema naming while reusing the existing field-definition shape. Nested item definitions are recursive, so arrays of objects can describe their object fields without inventing a second schema language.

### 4. Feature C is primarily schema/discovery/documentation work
No loop-specific engine change is required for the current scope. The runtime already renders `{FOR signer IN signers}` with `{$signer.name}`. The change is to formalize this pattern with tests, expose the expected input shape through discovery surfaces, and document it as the preferred template-authoring approach for variable signers.

## Risks and mitigations
- Risk: authors forget `default: ""` on optional fixed-slot anchor fields.
  Mitigation: add a targeted regression test and a worked docs example that calls out the requirement explicitly.
- Risk: nested array item schemas break existing listing consumers.
  Mitigation: add new optional `items` properties only; existing flat field metadata remains unchanged.

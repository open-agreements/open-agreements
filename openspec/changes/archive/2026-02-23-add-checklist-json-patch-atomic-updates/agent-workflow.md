# Checklist Patch Agent Workflow

This workflow documents the expected agent behavior for atomic checklist updates.

## Validate-First Workflow

1. Build patch JSON (`ChecklistPatchEnvelopeSchema`) from source evidence.
2. Run dry-run validation (`checklist patch-validate` or equivalent API/tool call).
3. Confirm:
   - JSON schema is valid
   - all target paths resolve (no guessing)
   - resulting checklist state is schema-valid
4. Capture `validation_id`.
5. Submit apply request (`ChecklistPatchApplyRequestSchema`) with:
   - `validation_id`
   - identical patch payload

## CLI Example

```bash
open-agreements checklist patch-validate \
  --state .tmp/checklist-state.json \
  --patch .tmp/patch.json \
  --validation-store .tmp/validation-store.json \
  --output .tmp/validate-result.json
```

`checklist-state.json` shape:

```json
{
  "checklist_id": "ck_atlas_series_a",
  "revision": 7,
  "checklist": { "...": "ClosingChecklistSchema payload" }
}
```

Patch apply:

```bash
open-agreements checklist patch-apply \
  --state .tmp/checklist-state.json \
  --request .tmp/apply-request.json \
  --validation-store .tmp/validation-store.json \
  --applied-store .tmp/applied-store.json \
  --proposed-store .tmp/proposed-store.json \
  --output .tmp/apply-result.json
```

`apply-request.json` shape:

```json
{
  "validation_id": "val_...",
  "patch": { "...": "same patch payload used in validate" }
}
```

## Proposed Mode

Use `patch.mode = "PROPOSED"` to store a proposal without mutating checklist state.
`checklist patch-apply` returns success with unchanged revision and `applied: false`.

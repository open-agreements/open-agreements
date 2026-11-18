# Answer-key review, frozen before production scoring

The seven JSON fixtures pair a synthetic business narrative with a separate, manually authored answer key. They use reserved `.example` notice addresses. The answer key is never sent to the model. Metadata and the narrative are sent; the returned values are passed to the actual extension MCP `fill_template` handler.

Review performed by the implementing assistant on November 18, 2026:

- Matched every key against every metadata field, including optional fields; checked scalar types and enum membership.
- Read the rendered Word story text for every gold document, including signature pages and repeated fields. Confirmed named parties, dates, money, selection flags and signatory capacity against the narrative. The board's array includes both directors and both signing dates.
- Corrected the SOW's shared unit token to `days`, which makes the rendered rejection and resubmission deadlines match the narrative. Invoice cadence remains “Monthly in arrears.”
- Included an individual contractor with empty entity-only signature fields, explicit false boolean alternatives, a repeated director array, and amounts where the template supplies its own dollar sign.

This is an assistant-checked synthetic answer key, not a lawyer-adjudicated evaluation of legal sufficiency. Exact wording is deliberate: equivalent paraphrases can fail strict field accuracy. The full-document metric measures textual and selection parity with a gold render through the same engine; it cannot detect a defect shared by gold and model renders. It is not a visual-layout or legal-quality score.

Preflight exclusions: the design-partner form reuses `free_text` for unrelated terms, producing an incoherent gold contract; the letter of intent retains multiple confidentiality alternatives. Neither is in the seven-template production sample. Two exploratory design-partner calls completed while preflight was being finalized; retain these calls and their costs as pilot overhead, exclude them from every production accuracy denominator. No production fixture was changed in response to model answers. The final fixture hashes are recorded in `fixtures-manifest.json`.

The SOW renderer warns that an unselected third-party-materials alternative remains in the document. Its checkbox is unselected and the no-materials choice is selected; preserve the warning in the evidence. The order form retains an unselected pilot-modification example. These existing renderer limitations are disclosed rather than counted as Gemini field errors.

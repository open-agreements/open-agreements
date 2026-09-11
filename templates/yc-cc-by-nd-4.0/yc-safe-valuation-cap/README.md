# YC Post-Money SAFE — Valuation Cap

Y Combinator's Post-Money SAFE (Simple Agreement for Future Equity) with a valuation cap and no discount.

## Source

- **Document**: Post-Money SAFE — Valuation Cap Only
- **Publisher**: Y Combinator
- **URL**: https://www.ycombinator.com/documents
- **License**: CC BY-ND 4.0

## License Notice

This document is redistributed under the Creative Commons Attribution-NoDerivatives 4.0 International license (CC BY-ND 4.0). The `template.docx` file in this directory is an unmodified copy of the original as published by Y Combinator.

You may fill in the blanks for your own use. Do not redistribute modified versions of the document itself. See https://creativecommons.org/licenses/by-nd/4.0/ for full license terms.

## Filling signature and notice details

The original download intentionally leaves signature and notice blanks. The fill pipeline accepts `investor_signatory_name`, `investor_signatory_title`, `company_notice_address`, `company_notice_email`, `investor_notice_address`, and `investor_notice_email` for a completed unsigned draft. The existing `name` and `title` fields identify the company signatory. Signature strokes remain blank. Supplying `date_of_safe` as an ISO calendar date renders a readable document date.

These fields require an engine supporting `external.anchored-paragraph-bindings.v1`, `anchored-paragraph-bindings.document-end.v1`, and `anchored-paragraph-bindings.wrapped-line-indent.v1` (for notice-address continuation indents); the source DOCX remains byte-for-byte unchanged.

# APAP interoperability

OpenAgreements is the canonical source for template text, field metadata,
license and attribution, and DOCX rendering. The Accord Project Agreement
Protocol (APAP) provides a portable representation of the template and its
agreement data, plus lifecycle operations in an APAP server.

## First supported template

The initial production pilot is
`openagreements-confidentiality-invention-assignment-agreement` (CIIAA). It is
an OpenAgreements-authored, derivative-permitted operative agreement with
canonical MDoc, Concerto, and DOCX artifacts. The Bonterms Mutual NDA is not
the pilot because the bundled CC0 artifact is a cover page that incorporates
Bonterms standard terms by reference; it would not exercise full agreement
authoring.

## MCP flow

1. Call `get_apap_template` with the CIIAA template ID.
2. Register the returned APAP Template with an APAP Agreement server.
3. Create the APAP Agreement with Concerto data.
4. Pass that same data to `create_apap_agreement_docx`.
5. Local MCP returns a local DOCX path. The hosted OpenAgreements MCP returns a
   signed, expiring download URL or MCP resource metadata.

The adapter removes APAP control properties (`$class`, `$identifier`, and
`contractId`) before filling the canonical DOCX. It does not invent missing
legal terms and fails closed on unsupported MDoc directives.

## Repository boundaries

- `open-agreements/open-agreements`: canonical export, data mapping, local DOCX
  renderer adapter, and local MCP tools.
- `accordproject/apap`: generic `create-agreement` MCP operation. It does not
  depend on OpenAgreements.
- `UseJunior/openagreements-org-deploy`: hosted DOCX adapter and signed,
  expiring download artifacts.
- `UseJunior/legal-explainer`: optional future demo UI, not a runtime dependency.

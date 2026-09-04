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
3. Create the APAP Agreement with Concerto data. Set its `template`
   relationship to the returned `template_relationship`, not the bare
   `template.uri`. Package consumers can compute the same value with
   `toApapTemplateRelationship(template)`.
4. Pass that same data to `create_apap_agreement_docx`.
5. Local MCP returns a local DOCX path. The hosted OpenAgreements MCP returns a
   signed, expiring download URL or MCP resource metadata.

The adapter removes APAP control properties (`$class`, `$identifier`, and
`contractId`) before filling the canonical DOCX. It does not invent missing
legal terms and fails closed on unsupported MDoc directives.

The exported template declares Cicero `^2.0.0`, matching the current APAP
reference implementation's Cicero 2 runtime. Its bundled Accord contract model
and imports use the versioned `org.accordproject.contract@0.2.0` namespace
required by current Concerto.

The APAP template identifier is a stable `openagreements://templates/...`
rather than the public `https:` page URL. The reference server treats HTTP(S)
template identifiers as downloadable Cicero archives during agreement creation;
the custom-scheme identifier makes it resolve the template registered in step 2
instead. Its version segment uses hyphens because APAP template identifiers
permit lowercase alphanumerics, underscores, and hyphens. The public canonical
source remains in the template description.

## Repository boundaries

- `open-agreements/open-agreements`: canonical export, data mapping, local DOCX
  renderer adapter, and local MCP tools.
- `accordproject/apap`: generic `create-agreement` MCP operation. It does not
  depend on OpenAgreements.
- `UseJunior/openagreements-org-deploy`: hosted DOCX adapter and signed,
  expiring download artifacts.
- `UseJunior/legal-explainer`: optional future demo UI, not a runtime dependency.

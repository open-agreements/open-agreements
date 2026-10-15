# Commercial Arbitration Clause

An experimental clause for insertion into a negotiated business-to-business commercial agreement.
It provides a common structure for selecting administration, rules, tribunal composition, juridical seat, language, and provider-specific procedure.
No provider, seat, or decision-maker is selected by default.
The parties’ signed agreement must incorporate the completed clause; rendering a DOCX does not establish consent or commence a case.

The separate examples illustrate AAA, JAMS, and People’s Court.
They are alternatives for consideration, not a ranking, endorsement, provider partnership, or an agreement to arbitrate before several providers.
Select one complete configuration and review it against the transaction and current provider requirements.

## Scope and review

This is a starting point for transaction-specific legal review, not an enforceability opinion or a universal arbitration agreement.
It is not designed for consumer, employment, collective or class proceedings, or international transactions.
It does not add a class-action waiver, an internal-appeal waiver, a confidentiality covenant, a damages limitation, a shortened limitation period, or authority over escrow or payments.
Those choices need separate consideration if relevant.

The Federal Arbitration Act’s written-agreement rule preserves applicable contract defenses and statutory exceptions; selecting arbitration does not eliminate those questions ([9 U.S.C. § 2](https://www.govinfo.gov/content/pkg/USCODE-2024-title9/html/USCODE-2024-title9-chap1-sec2.htm)).
The judgment language is a contractual consent to seek confirmation, not a representation that a court has jurisdiction or will enforce an award ([9 U.S.C. § 9](https://www.govinfo.gov/content/pkg/USCODE-2024-title9/html/USCODE-2024-title9-chap1-sec9.htm)).

## Fields and drafting decisions

| Field | Decision before signing |
| --- | --- |
| `administrator_name` | Choose one administrator and check acceptance policies and fees. If it declines or becomes unavailable, decide whether a separately drafted successor or fallback arrangement is needed. |
| `rules_name`, `rules_url` | Identify the exact applicable rules and make them available to both parties. A provider’s name alone does not identify the full procedure. |
| `rules_version` | Choose a rule-version mechanism compatible with the provider. The examples defer to the provider’s mechanism; People’s Court fixes the filed case’s text and election. |
| `tribunal_composition` | Select a supported composition. Do not replace a human tribunal with an AI decision-maker through a name substitution. |
| `arbitral_seat` | Choose the legal seat and reconcile it with judicial venue and mandatory law. A remote participant’s location is a separate question. |
| `arbitration_language` | Confirm a language the provider supports. |
| `procedure_terms` | Read and adapt the entire provider-specific election, notices, and review terms; the engine does not assess their legal compatibility. |

The parent agreement should identify the parties, establish assent, select substantive governing law, and supply reliable notice details.
Reconcile existing dispute-resolution and court-venue provisions before inserting this clause.
The core clause leaves jurisdiction and arbitrability questions to the selected rules and applicable law; it does not create an additional express delegation clause.
Any intended delegation, interim-relief arrangement, confidentiality obligation, fee allocation, or fallback forum requires deliberate drafting.

## Examples

The JSON files contain complete illustrative fill inputs, not provider-approved clauses.
The New York seats in the AAA and JAMS examples are illustrative negotiated choices, not provider requirements.
Review current provider materials before using any example; source links were checked on October 15, 2026.

### AAA

[`examples/aaa.json`](../../../docs/examples/commercial-arbitration-clause/aaa.json) uses one neutral arbitrator and the AAA Commercial Arbitration Rules and Mediation Procedures.
The reference materials are the AAA’s [commercial arbitration resources](https://www.adr.org/commercial/) and [clause-drafting page](https://www.adr.org/clause-drafting/).
The example does not opt into a separate optional appellate procedure.

### JAMS

[`examples/jams.json`](../../../docs/examples/commercial-arbitration-clause/jams.json) expressly selects the Comprehensive Arbitration Rules and Procedures and one neutral arbitrator.
See the [JAMS clause workbook](https://www.jamsadr.com/clauses) and [Comprehensive Rules](https://www.jamsadr.com/rules-comprehensive-arbitration), particularly Rules 1, 3, 7, and 34.
It does not elect JAMS’ optional appeal procedure.

### People’s Court

[`examples/peoples-court.json`](../../../docs/examples/commercial-arbitration-clause/peoples-court.json) selects **AI-assisted human** arbitration: an AI panel assists with drafting, and the appointed human Arbitrator decides and signs the Award.
It uses Wilmington, Delaware as the seat, English, and the Rules in effect at filing, preserved for that case by version and hash.
Every party must still accept the exact case-opening procedure and fee terms.
See People’s Court’s [published model clause](https://peoplescourt.ai/clause), [Rules of Procedure & Evidence](https://peoplescourt.ai/rules), and [Terms](https://peoplescourt.ai/legal/terms).

The Rules also offer an **AI-only** tier, which is the default absent every party’s election of AI-assisted human.
Under AI-only, an AI arbiter or panel decides and serves the first-instance Award without human merits review before service, except for a question referred to a human Arbitrator (Rules 2.1-2.4).
The example expressly chooses AI-assisted human and does not authorize an automatic switch to AI-only if the required acceptances are missing.
A different tier requires corresponding drafting and disclosures, not just a changed provider label.

The example preserves the Rules’ human appeal, correction, additional-Award, and stay procedures; it includes no appeal waiver (Articles 8-9).
The human appeal proceeds on the existing Record under the deferential standards in Rule 9.3; it is not a new hearing on the merits.
Proceedings ordinarily use written submissions without discovery, depositions, compulsory production, or an evidentiary hearing (Rules 4.11 and 5.8).
The Rules’ treatment of private filings and possible Award publication differs from an absolute confidentiality promise (Rules 10.3-10.4).
Judicial proceedings remain subject to Rule 12.3’s venue provisions.

**Contributor affiliation:** this contribution was proposed by Shunhe Wang, a co-founder of People’s Court.
That relationship is disclosed so maintainers and users can assess the example in context.
Including a named provider is not a claim of OpenAgreements endorsement or guaranteed enforceability.

## Generate and fill

The canonical `template.mdoc` owns the clause text and full field declarations; `template.md` is its tokenized reading projection and `metadata.yaml` supplies matching catalog fields.
Regenerate the DOCX files using the existing canonical Markdoc renderer, DOCX post-processing, and humanization helpers:

```bash
npm run build
node scripts/generate_arbitration_clause.mjs
node bin/open-agreements.js validate openagreements-commercial-arbitration-clause
mkdir -p artifacts/arbitration-clause
node bin/open-agreements.js fill openagreements-commercial-arbitration-clause \
  --data docs/examples/commercial-arbitration-clause/aaa.json \
  --output artifacts/arbitration-clause/aaa.docx
```

Substitute `jams.json` or `peoples-court.json` and an appropriate output path to inspect another example.
The source bundle includes a machine-fillable `template.fill.docx` and a humanized `template.docx`, following the catalog’s canonical-template convention.
Add `--declarative` to a fill command to exercise rendering directly from Markdoc.
Refresh derived catalog artifacts with `npm run generate:derived`.
For preview images, use the configured headless renderer with `node scripts/render_docx_pages.mjs --input templates/openagreements-cc-by-4.0/openagreements-commercial-arbitration-clause/template.docx --output-dir data/template-previews/openagreements-commercial-arbitration-clause --prefix page`.
The Word output uses the repository’s existing canonical document styles.

## Provenance and license

The clause and example wording are an original contribution offered under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with drafting considerations checked against the linked primary and provider sources.
No third-party provider’s published clause or rulebook is vendored or relicensed here.
The linked external materials retain their respective rights and terms.
The template is version `0.1.0`, with `experimental` stability and maturity; source review and successful rendering do not establish legal suitability for a particular transaction.

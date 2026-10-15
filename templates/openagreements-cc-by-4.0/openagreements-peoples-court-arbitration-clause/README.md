# People’s Court Model Arbitration Clause

Use this model to designate [People’s Court](https://peoplescourt.ai/) as the administrator of disputes under a negotiated commercial agreement.
It is adapted directly from People’s Court’s [published sample clause](https://peoplescourt.ai/clause), with an express procedure election and source-linked drafting notes.
The default draft selects **AI-only arbitration**; the parties can instead select AI-assisted human arbitration or choose the tier when a case is filed.
The generated human-readable Word document visibly names People’s Court and includes this sentence:

> The parties expressly agree to the AI-only tier.

The following paragraph explains that an AI Tribunal decides and serves the first-instance Award without human merits review before service, except for a question referred to a human Arbitrator.
The clause retains the Rules’ internal human appeal and the requirement that every party accept the same exact case-opening procedure and fee terms.
A template default is a drafting choice for the parties to review and accept; generating or downloading a document does not establish consent or commence a case.

This model can also be adapted to another arbitration provider using the [adaptation guide](../../../docs/examples/commercial-arbitration-clause/provider-adaptation.md).
That guide includes a general clause structure and AAA/JAMS administration examples.
A different provider requires a deliberate adaptation of the procedure and disclosures as well as the administrator’s name.

## Choose the procedure

The single `procedure_election` field supplies the phrase following “The parties expressly agree to”.
Its allowed values are:

| Election | Exact field value | Example |
| --- | --- | --- |
| AI-only, the default | `the AI-only tier` | [AI-only](../../../docs/examples/commercial-arbitration-clause/peoples-court.json) |
| AI-assisted human | `the AI-assisted human tier` | [Human decision-maker](../../../docs/examples/commercial-arbitration-clause/peoples-court-human.json) |
| Choose at filing, with the disclosed AI-only default | `the tier selected when a case is filed, with AI-only applying unless all parties then choose AI-assisted human` | [Selection at filing](../../../docs/examples/commercial-arbitration-clause/peoples-court-at-filing.json) |

The default is AI-only at the express request of the contributing People’s Court co-founder, consistent with Rule 2.1.
For AI-assisted human, an AI panel assists with a draft, and the appointed human Arbitrator decides, may revise or reject the draft, and issues the Award in that Arbitrator’s own name.
For selection at filing, AI-only applies unless every party then chooses AI-assisted human.
Every election remains subject to the exact case-opening assent required by the Rules; an internal appeal waiver would require separate, express acceptance and is not included here.
An explicit blank or unresolved field leaves an incomplete election in the draft and must be completed before signing; it is not a substitute for agreement to AI arbitration.

## Relationship to the published sample

Source materials were checked on October 15, 2026.
The source of the People’s Court wording is the [published model clause](https://peoplescourt.ai/clause), not a provider-neutral clause with only its administrator’s name replaced.

| Published sample component | Treatment in this template |
| --- | --- |
| People’s Court, Epistemic Labs Inc., Rules at filing, Wilmington seat, and FAA | Retained in the operative text. |
| Delegation to the Tribunal and separability | Retained. |
| Bracketed AI-only / AI-assisted human / selection-at-filing choice | Replaced with one fillable enum and an express election; AI-only is the visible default. Both tiers’ decision-maker roles are explained. |
| Proprietary adjudication technology | Retained, including the applicable-law and protective-treatment qualifications. |
| Operative Award and judgment | Qualified expressly by the correction, additional-Award, appeal, and nonwaivable judicial rights already preserved by Rule 9.5; judicial venue follows Rule 12.3. |
| Escrow or payment-mechanism authorization | Separated into the optional module below. It is not part of the default clause. |
| Intake, Rules link, electronic notices, and support | Retained. |

The exact Rules text and procedure accepted for a filed case govern that case; amendments do not alter pending cases (Rules 1.3 and 13.2).
The AI-only Tribunal may be one AI arbiter or an AI panel depending on the Rules’ amount and relief criteria; this template does not hardcode three panelists for every case (Rule 2.1).
The process ordinarily uses written submissions without discovery, depositions, compulsory production, or an evidentiary hearing (Rules 4.11 and 5.8).
The human appeal proceeds on the existing Record under Rule 9.3’s deferential standards, rather than a new hearing on the merits.
The Rules preserve correction, additional-Award, and applicable execution-stay procedures (Articles 8-9).
Review the [Rules of Procedure & Evidence](https://peoplescourt.ai/rules) and [Terms](https://peoplescourt.ai/legal/terms) before using the clause.

## Optional funds authorization

The published sample includes the following additional sentence, which may be considered separately when the transaction already has an authorized escrow or payment mechanism:

> Where funds are held under an authorized escrow or payment mechanism for the transaction, the parties authorize disposition of those funds in accordance with the Award.

This sentence is not included in the default rendered clause.
Before adding it, identify the funds, lawful authority, actual mechanism, and its release conditions.
Rule 8.2 limits execution to funds or mechanisms within People’s Court’s lawful and technical control; naming the forum does not itself create custody, control, or an integration.
The applicable stays and other execution conditions remain in place.

## Scope and adaptation review

This is an experimental starting point for negotiated business-to-business agreements and transaction-specific legal review.
It is not a consumer, employment, class or collective, or international arbitration model, and makes no promise of enforceability.
The parent agreement should identify the parties, establish assent, supply reliable notice information, and select substantive governing law.
Reconcile any existing dispute-resolution and court-venue provisions before inserting this clause.

The FAA’s written-agreement provision preserves applicable contract defenses and statutory exceptions ([9 U.S.C. § 2](https://www.govinfo.gov/content/pkg/USCODE-2024-title9/html/USCODE-2024-title9-chap1-sec2.htm)).
The parties’ consent to seek judgment on an Award does not itself establish court jurisdiction or an entitlement to enforcement ([9 U.S.C. § 9](https://www.govinfo.gov/content/pkg/USCODE-2024-title9/html/USCODE-2024-title9-chap1-sec9.htm)).
No class-action waiver, automatic internal-appeal waiver, absolute confidentiality covenant, damages limit, shortened limitation period, or default funds authorization is added by this template.
The Rules’ treatment of private filings and possible Award publication should be considered separately (Rules 10.3-10.4).

**Contributor affiliation:** Shunhe Wang, who proposed this contribution, is a co-founder of People’s Court.
This is a disclosed contribution of that provider’s model clause for review by OpenAgreements; inclusion would not establish endorsement by OpenAgreements or another named organization.

## Generate and fill

The canonical `template.mdoc` owns the clause text and field declarations; `template.md` is its tokenized reading projection and `metadata.yaml` supplies the matching catalog field.
The generator reuses the repository’s Markdoc renderer, DOCX post-processing, and fill engine.
It writes `template.fill.docx` for programmatic filling and a human-readable `template.docx` with the visible AI-only election already rendered.

```bash
npm run build
node scripts/generate_arbitration_clause.mjs
node bin/open-agreements.js validate openagreements-peoples-court-arbitration-clause
mkdir -p artifacts/arbitration-clause
node bin/open-agreements.js fill openagreements-peoples-court-arbitration-clause \
  --data docs/examples/commercial-arbitration-clause/peoples-court.json \
  --output artifacts/arbitration-clause/peoples-court.docx
```

Omit `--data` to render the default AI-only draft.
Use `peoples-court-human.json` or `peoples-court-at-filing.json` to render another election, and add `--declarative` to exercise canonical-source rendering.
Refresh derived catalog artifacts with `npm run generate:derived`.
For preview images, use the configured headless renderer with `node scripts/render_docx_pages.mjs --input templates/openagreements-cc-by-4.0/openagreements-peoples-court-arbitration-clause/template.docx --output-dir data/template-previews/openagreements-peoples-court-arbitration-clause --prefix page`.
Word output follows the repository’s canonical document styles.

## Provenance and license

This contribution adapts People’s Court’s published sample with its co-founder’s authorization and offers this contributed template under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The linked Rules, Terms, provider websites, and other external materials retain their own rights and are not relicensed by this contribution.
The template is an experimental `0.1.0` draft; successful generation or source review does not establish suitability for a particular agreement.

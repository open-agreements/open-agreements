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
An explicit blank on the standard fill path exits successfully and produces “The parties expressly agree to.” with an unfilled-priority-field notice; the declarative path rejects it. Do not sign that incomplete draft or assume a blank avoids the Rules’ AI-only default.

## Relationship to the published sample

Source materials were checked on October 15, 2026.
The source of the People’s Court wording is the [published model clause](https://peoplescourt.ai/clause), not a provider-neutral clause with only its administrator’s name replaced.

| Published sample component | Treatment in this template |
| --- | --- |
| People’s Court, Epistemic Labs Inc., Rules at filing, Wilmington seat, and FAA | Retained in the operative text. |
| Delegation to the Tribunal and separability | Retained. |
| Bracketed AI-only / AI-assisted human / selection-at-filing choice | Replaced with one fillable enum and an express election; AI-only is the visible default. Both tiers’ decision-maker roles, Rule 2.1’s case-opening confirmation, and the absence of an appeal waiver are made explicit. |
| Proprietary adjudication technology | Retained, including the applicable-law and protective-treatment qualifications. |
| Operative Award and judgment | Qualified expressly by the correction, additional-Award, appeal, and nonwaivable judicial rights already preserved by Rule 9.5; judicial venue follows Rule 12.3. |
| Escrow or payment-mechanism authorization | Separated into the optional module below. It is not part of the default clause. |
| Intake, Rules link, electronic notices, and support | Retained. |

The exact Rules text and procedure accepted for a filed case govern that case; amendments do not alter pending cases (Rules 1.3 and 13.2).
The AI-only Tribunal may be one AI arbiter or an AI panel depending on the Rules’ amount and relief criteria; this template does not hardcode three panelists for every case (Rule 2.1).
The process ordinarily uses written submissions without an evidentiary hearing (Rule 4.11). It does not provide discovery, depositions, or compulsory production (Rule 5.8).
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

## Review the enforcement and provider terms

**AI-only enforcement risk:** Do not assume that agreement to an AI decider makes its Award judicially enforceable. This template does not establish whether a court would treat a decision without human merits decision-making as an arbitral award under the FAA or applicable state law. Review the appointment, confirmation, and vacatur provisions in [9 U.S.C. §§ 5, 9–11](https://uscode.house.gov/view.xhtml?path=/prelim@title9/chapter1&edition=prelim) for the transaction. AI-assisted human arbitration provides a human first-instance decision; the limited internal human appeal is not the same safeguard. The AI-only default is retained to identify the contributed provider model, rather than as an OpenAgreements recommendation of its enforcement posture.

The source clause delegates formation questions, but that wording does not eliminate judicial review of whether an agreement was formed. See [Ahlstrom v. DHI Mortgage Co., 21 F.4th 631, 635 (9th Cir. 2021)](https://cdn.ca9.uscourts.gov/datastore/opinions/2021/12/29/20-15114.pdf). Courts also decide which agreement governs when arbitration and court-forum agreements conflict: [Coinbase, Inc. v. Suski, 602 U.S. 143 (2024)](https://www.supremecourt.gov/opinions/23pdf/23-3_879d.pdf). Establish party identity, authority, and actual assent independently.

Rule 2.1 requires confirmation through case-opening terms even where the contract selects a tier. The added confirmation sentence restates that provider requirement; it does not resolve how the provider would handle a respondent who refuses those terms. Before relying on a preselected human tier, confirm with the provider how it handles nonparticipation and whether the selected tier can proceed. Do not assume refusal changes the election or permits an AI-only substitution. Consider an express alternative forum if the agreed procedure cannot proceed.

The following summarizes the provider materials checked on November 17, 2026; review the actual version and fees applicable at filing:

- **Judicial venue:** Rule 12.3 specifies exclusive Delaware Court of Chancery venue, with another Delaware state or federal court as fallback if Chancery lacks subject-matter jurisdiction, and consent to personal jurisdiction and venue, unless the parties validly agree otherwise. Decide expressly whether a parent agreement’s forum clause should displace that rule. The operative clause’s reference to a “valid venue agreement” applies only to an agreement that is legally valid; it does not guarantee validity or court jurisdiction.
- **Publication:** [Terms § 9](https://peoplescourt.ai/legal/terms) authorizes publication of a public version of a final Award as permitted by the Rules; case filings are not public by default. Assess this against transaction confidentiality obligations.
- **Provider liability and disputes:** Terms § 13 contains a release for covered good-faith conduct and a covenant concerning claims based on disagreement with an Award. Sections 16.2–16.3 address Miami-Dade, Florida venue and class and jury waivers for provider disputes, distinct from judicial proceedings concerning the parties’ arbitration. Review the qualifications and enforceability of those provisions.
- **Fees:** Rule 11.1 lists AI-only fees of 5.67% of the amount in dispute, AI-assisted human fees of $310 plus 5.67%, and appeal fees of 15.67% with a $520 minimum. These percentages have no stated maximum; retaining an appeal right does not mean it will be affordable. Confirm current fees and any waiver arrangements before selecting the provider.

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

# OpenAgreements Employee Restrictive Covenant (Florida)

Florida-specific employee restrictive covenant agreement with a modular covenant
structure (non-compete, employee and customer non-solicitation, no-dealing,
non-investment, confidentiality, and non-disparagement). The form is built around
Florida's restrictive-covenant statute, Fla. Stat. § 542.335, the § 542.336
physician carve-out, and the 2025 CHOICE Act (Fla. Stat. §§ 542.41–542.45).
It is a sibling of the Wyoming pilot template, Florida-ified clause by clause.

This is a drafting starting point for licensed counsel, not legal advice.

## Source

- **URL**: https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-florida
- **Version**: 1.0
- **License**: CC BY 4.0
- **Legal requirement set**: the Florida restrictive-covenant overlay (`restrictive-covenant.florida`, v0.3.0), itself a delta over the `restrictive-covenant.core` base spec, stewarded in `UseJunior/legal-context`.

## Two enforcement pathways

Florida law gives an employer two parallel ways to enforce a non-compete. This
template models both; which one applies is driven by `covered_employee`.

1. **General § 542.335 pathway (every covenant).** A restrictive covenant is
   enforceable when it is supported by one or more **legitimate business
   interests** (Fla. Stat. § 542.335(1)(b)) and is reasonable in time, area, and
   line of business. Distinctives this template implements:
   - **Legitimate-business-interest recital** — the `recitals-and-legitimate-business-interest`
     clause names the enumerated interests the covenants protect.
   - **Mandatory judicial modification** — under § 542.335(1)(c) a court *shall*
     modify an overbroad restraint and grant only the relief reasonably
     necessary. The `enforceability-severability-and-reformation` clause
     **affirms** judicial modification. This is the exact inverse of the Wyoming
     template, which disclaims reformation.
   - **Presumptively-reasonable duration window** — § 542.335(1)(d)–(e) presumes
     different reasonable/unreasonable durations by relationship type
     (`covenant_relationship_type`). The defaults sit inside the reasonable
     window.
   - **Express assignee / successor / third-party-beneficiary enforcement** —
     § 542.335(1)(f) requires express contract language; silence defeats
     enforcement by an acquirer, reorganized operating entity, or PEO. The
     `assignment-and-successors` clause supplies it expressly.
   - **Physician specialty-monopoly carve-out** — § 542.336 voids a physician
     non-compete in a county where one entity employs/contracts with **all**
     physicians of that specialty (and for 3 years after a second entity begins
     offering it). The `physician-specific-rights-and-notices` clause carves this
     out for any Physician worker as a defensive posture.

2. **CHOICE Act covered-employee pathway (`covered_employee == true`).** The 2025
   CHOICE Act (Fla. Stat. §§ 542.41–542.45) is an **opt-in, enhanced-enforcement**
   regime that runs *alongside* — it does not replace — § 542.335. A *covered
   employee* earns more than twice the county annual mean wage **and** is not a
   health care practitioner under s. 456.001 (Fla. Stat. § 542.43; physicians are
   categorically excluded). On the employer's application a court **must**
   preliminarily enjoin a covered employee from competing, dissolvable only by the
   employee's clear-and-convincing evidence (§ 542.45(5)). The enhanced track is
   available only if procedural prerequisites are met, which this template
   surfaces in three gated clauses:
   - `choice-act-counsel-notice` — written counsel advisal + ≥7-day notice
     (§ 542.45(2)(a), (3)).
   - `choice-act-confidential-info-acknowledgement` — written acknowledgement of
     receipt of confidential information or customer relationships
     (§ 542.45(2)(b)).
   - `choice-act-garden-leave` — when paired with a covered garden leave agreement
     (§ 542.43(5)), the noncompete period is reduced day-for-day by any nonworking
     portion of the notice period (§ 542.45(2)(c); see § 542.44).

   The written counsel advisal and ≥7-day notice are operational steps the
   employer must actually perform; reciting them does not by itself satisfy
   them. The `choice-act-counsel-notice` recital is therefore a
   *statutory compliance representation*: the `choice_act_advance_notice_confirmed`
   field defaults to `false`, and until a human confirms the advisal and notice
   were actually given, the recital renders followed by a yellow-highlighted
   `[CONFIRM before signing: …; see § 542.45]` bracket rather than asserting
   clean compliance (it is never silently dropped).

## Fields

AI-only fields drive conditional gating and duration analysis; they are not
rendered as cover-term rows in the output document.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employer_name` | string | yes | Legal name of the employer |
| `employee_name` | string | yes | Full legal name of the employee |
| `employee_title` | string | no | Employee job title or position |
| `effective_date` | date | yes | Effective date of this agreement |
| `governing_law` | string | yes | Governing law state (default Florida) |
| `worker_category` | enum | no | Executive / Management / Professional Staff / Physician / Other (AI-only). Physician triggers the § 542.336 carve-out and forces `covered_employee` false |
| `covered_employee` | boolean | no | CHOICE Act covered-employee status: salary > 2× county annual mean wage AND not a health care practitioner under s. 456.001 (AI-only). Gates the CHOICE Act clauses. Default false |
| `garden_leave_included` | boolean | no | Whether a covered garden leave agreement (§ 542.43(5)) is paired with the covered-employee non-compete (AI-only). Gates the garden-leave offset clause. Default false |
| `covenant_relationship_type` | enum | no | employee / distributor_dealer_franchisee_licensee / sale_of_business / trade_secret_predicated. Selects the § 542.335(1)(d)–(e) duration window (AI-only; never gates a clause). Default employee |
| `covenant_duration_months` | number | no | Non-compete length in months for machine-checkable duration evaluation (AI-only). Advisory when empty |
| `confidentiality_trade_secret_duration` | string | no | Trade-secret confidentiality duration. Default Perpetual |
| `confidentiality_other_duration` | string | no | Non-trade-secret confidentiality duration. Default 24 months |
| `employee_nonsolicit_included` | boolean | no | Include the employee non-solicitation covenant. Default true |
| `employee_nonsolicit_duration` | string | no | Employee non-solicitation duration. Default 12 months |
| `covered_employee_period` | string | no | Lookback for covered employees. Default 12 months |
| `customer_nonsolicit_included` | boolean | no | Include the customer non-solicitation covenant. Default true |
| `customer_nonsolicit_duration` | string | no | Customer non-solicitation duration. Default 12 months |
| `covered_customer_period` | string | no | Lookback for covered customers. Default 12 months |
| `noncompete_included` | boolean | no | Include the non-compete covenant. Default false |
| `noncompete_duration` | string | no | Non-compete duration. Default 12 months |
| `territory` | string | no | Restricted territory. Default: employee's actual service area |
| `competitive_business_definition` | string | no | What constitutes a Competitive Business |
| `specified_competitors` | string | no | Optional named-competitor list (narrows the non-compete) |
| `nondealing_included` | boolean | no | Include the no-business-with-covered-customers covenant. Default false |
| `nondealing_duration` | string | no | No-dealing duration. Default 12 months |
| `passive_public_holdings_threshold` | string | no | Passive public-holdings ownership cap. Default five percent |
| `noninvestment_included` | boolean | no | Include the non-investment covenant. Default false |
| `noninvestment_duration` | string | no | Non-investment duration. Default 12 months |
| `nondisparagement_duration` | string | no | Non-disparagement duration. Default 24 months |
| `cloud_drive_id` | string | no | Optional document-system URI / file ID |
| `cloud_drive_id_footer` | string | no | Internal computed footer text |

## Canonical Markdown Authoring

The agreement is authored canonically in
`content/templates/openagreements-restrictive-covenant-florida/template.md`, with
the generated JSON spec and rendered DOCX derived from that source. Conditionally
included covenants render `[Intentionally Omitted.]` in their section position when
their inclusion boolean is false, preserving section structure. Every gated clause
is conditioned on a single boolean field name (`covered_employee`,
`garden_leave_included`, or a covenant inclusion toggle); the renderer does not
support compound conditions, so `covenant_relationship_type` is consumed for the
duration value only and never used to include or omit a clause.

## Attribution

Authored by OpenAgreements contributors. Florida-specific analysis informed by
publicly available legal commentary cited in the related practice note. Licensed
under CC BY 4.0.

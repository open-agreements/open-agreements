---
jurisdiction: "Oregon"
slug: oregon
countryCode: US
snapshotAsOf: "2026-06-24"
lastReviewed: "2026-06-05"
canonicalUrl: https://openagreements.org/practice-guides/privacy/us/oregon
license: CC BY 4.0
stale: false
---

> [!IMPORTANT]
> **Informational only — not legal advice.** This is a snapshot of an OpenAgreements practice note,
> provided for general information. It is not legal advice, does not create an attorney-client
> relationship, and is not a substitute for a licensed attorney in the relevant jurisdiction.
> Laws change; verify against the canonical version before relying on it.
>
> **Canonical:** https://openagreements.org/practice-guides/privacy/us/oregon · **Snapshot as of:** 2026-06-24 · License: CC BY 4.0 · © openagreements.org

# Oregon Consumer Privacy Law (OCPA)[^about]

The Oregon Consumer Privacy Act gives Oregon consumers rights over their personal data and imposes notice, contracting, and consent duties on controllers above defined thresholds — it is enforced exclusively by the Attorney General, carries civil penalties of up to $7,500 per violation, provides no private right of action, and as of January 1, 2026 no longer offers most businesses a mandatory right to cure.


## At a glance

| Question | Oregon |
| --- | --- |
| **Law coverage** | Comprehensive law |
| **Summary** | If you meet the 100,000-consumer (or 25,000 plus 25%-data-sale-revenue) threshold in Oregon, the OCPA requires a privacy notice with prescribed contents, opt-in consent to process sensitive data, recognition of a universal opt-out signal, and processor contracts — enforced by the Attorney General with civil penalties up to $7,500 per violation, no consumer lawsuits, and no general right to cure after January 1, 2026. |
| **Main law** | Or. Rev. Stat. §§ 646A.570–646A.589 (Oregon Consumer Privacy Act) |
| **Privacy policy required?** | Yes — a reasonably accessible, clear, and meaningful notice with statutorily fixed contents |
| **Who does it cover?** | Persons doing business in Oregon (or targeting residents) that, in a calendar year, control or process the personal data of 100,000+ consumers, or 25,000+ while deriving 25% or more of annual gross revenue from selling personal data — no dollar revenue floor; nonprofits covered; GLBA financial institutions, insurers, and public bodies are exempt at the entity level, while HIPAA-regulated health data is exempt only at the data level (so HIPAA-covered businesses still comply for non-exempt data) |
| **Can consumers sue?** | No |
| **Privacy policy rule** | Policy contents fixed by law |
| **Consent for sensitive data?** | Consent required first |
| **Browser opt-out signals?** | Must be honored |
| **Lawsuit detail** | No — enforcement is exclusively the Attorney General's |
| **Who enforces it?** | Oregon Attorney General (exclusive) |

## Does the OCPA apply to your business? {#does-ocpa-apply}

**Short answer.** It turns on consumer volume, not dollar revenue. The OCPA applies to a person that conducts business in Oregon or provides products or services to its residents and that, during a calendar year, controls or processes the personal data of 100,000 or more consumers, or 25,000 or more consumers while deriving 25 percent or more of annual gross revenue from selling personal data [^stat-572-apply].

There is no dollar revenue floor for the 100,000-consumer trigger. A consumer is an Oregon resident acting in a capacity other than a commercial or employment context, so workforce, applicant, and business-to-business data fall outside the statute [^stat-570-consumer]. Section 646A.572(2) mixes two kinds of exemption. Some carve-outs are entity-level: the OCPA does not apply to a public body, to a financial institution as defined in Oregon banking law (or such an institution's affiliate or subsidiary that is only and directly engaged in financial activities), or to insurers and insurance producers [^stat-572-exempt]. Other carve-outs are data-level: the OCPA exempts HIPAA protected health information, information processed under the Gramm-Leach-Bliley Act and the Family Educational Rights and Privacy Act, and activity carried out strictly under the Fair Credit Reporting Act [^stat-572-exempt-data]. The distinctive point worth flagging is that there is no blanket entity-level exemption for HIPAA-covered health-care entities — Oregon exempts the regulated health data rather than the entity, so a HIPAA-covered business must still comply with the OCPA for any personal data that falls outside the exempt categories. Nonprofits are now covered.

## What must your Oregon privacy policy contain? {#privacy-policy-contents}

**Short answer.** A controller must provide a reasonably accessible, clear and meaningful privacy notice that lists the categories of personal data it processes, describes the purposes for processing, explains how a consumer may exercise and appeal rights, lists the categories of personal data shared with third parties, and describes the categories of those third parties [^stat-578-notice].

Section 646A.578(4) is the content checklist for an Oregon privacy policy, and it is prescriptive. Beyond the items above, the notice must specify an actively monitored email address or other online contact method, identify the controller by its registered and assumed business names, give a clear and conspicuous description of any targeted advertising or qualifying profiling along with how to opt out, and describe the methods for submitting requests [^stat-578-notice-detail]. The controller must also limit collection to data that is adequate, relevant and reasonably necessary for the disclosed purposes [^stat-578-minimize]. A generic multistate notice that omits the appeal route, the third-party-sharing detail, or the request mechanics is the most common Oregon notice gap, so the policy should track section 646A.578(4) item by item.

## What must your contracts with vendors and processors include? {#vendor-processor-contracts}

**Short answer.** A processor must enter into a contract with the controller that governs how the processor processes personal data on the controller's behalf — so a data processing agreement is a statutory requirement, not a best practice [^stat-581-contract].

Section 646A.581(2) then fixes the required terms: clear processing instructions and the nature, purpose, type, and duration of processing; specification of each party's rights and obligations; a duty of confidentiality on everyone who processes the data; deletion or return of the data at the controller's direction or at the end of services; information the controller needs to verify compliance; a flow-down requirement binding subcontractors to the same obligations; and a right to assess the processor's safeguards [^stat-581-terms]. The processor also has an affirmative duty to help the controller respond to consumer requests and conduct data protection assessments. A compliant template data processing agreement tracks each of these.

## When do you need consent, and must you honor a universal opt-out signal? {#sensitive-data-and-opt-out}

**Short answer.** You need consent for sensitive data, and you must honor a universal opt-out signal. A controller may not process a consumer's sensitive data without first obtaining consent, and if it knows the consumer is a child it must instead follow the federal Children's Online Privacy Protection Act [^stat-578-consent]. Sensitive data includes data revealing race or ethnicity, religious beliefs, a mental or physical condition or diagnosis, sexual orientation, transgender or nonbinary status, crime-victim status, or citizenship or immigration status; a child's personal data; precise geolocation; and genetic or biometric data [^stat-570-sensitive].

Consent must be a freely given, specific, informed and unambiguous affirmative act, and a consumer's inaction does not count as consent. Separately, the request methods a controller offers must let a consumer or authorized agent send a signal indicating a preference to opt out of the sale of personal data or targeted advertising, through a mechanism that requires an affirmative choice rather than a default setting [^stat-578-signal]. In practice that means the program has to recognize a browser- or device-level universal opt-out preference signal, not just an on-site opt-out link.

## Who enforces the OCPA, and can consumers sue? {#enforcement-and-lawsuits}

**Short answer.** The Attorney General enforces it, and consumers cannot sue. The Attorney General has exclusive authority to enforce the OCPA, and the statute provides no private right of action [^stat-589-exclusive]. The Attorney General may bring an action for a civil penalty of up to $7,500 for each violation, plus injunctive or other equitable relief [^stat-589-penalty].

There is also no longer a general right to cure. The OCPA's pre-suit notice-and-cure provision sunset on January 1, 2026 for ordinary covered businesses; from that date the 30-day cure survived only for a controller that is a noncommercial educational broadcast station and that meets two further conditions — it receives Corporation for Public Broadcasting funding or is a designated emergency-alert primary entry point, and it distributes its journalism content without cost to recipients [^stat-589-cure]. Even that narrow carve-out is temporary: the legislature repealed the cure section in full effective July 1, 2026, after which no controller has a statutory right to cure [^stat-589-cure-repeal]. The practical takeaway is to build the notice, consent, contracting, and opt-out controls before a complaint arrives, because covered businesses no longer have a statutory window to fix a violation after the Attorney General identifies it. The Attorney General must bring an action within five years after the last act constituting the violation.

[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-06-05. License: CC BY 4.0. Steven Obiajulu, J.D. is admitted in New York, not Oregon. This article synthesizes Oregon primary law and is not legal advice from a Oregon-admitted attorney. This article is for informational purposes only and does not create an attorney-client relationship.

[^stat-572-apply]: **Or. Rev. Stat. § 646A.572** — "ORS 646A.570 to 646A.589 apply to any person that conducts business in this state, or that provides products or services to residents of this state, and that during a calendar year, controls or processes: (A) The personal data of 100,000 or more consumers, other than personal data controlled or processed solely for the purpose of completing a payment transaction; or (B) The personal data of 25,000 or more consumers, while deriving 25 percent or more of the person’s annual gross revenue from selling personal data." *Or. Rev. Stat. § 646A.572(1)(a).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-570-consumer]: **Or. Rev. Stat. § 646A.570** — "‘Consumer’ means a natural person who resides in this state and acts in any capacity other than in a commercial or employment context." *Or. Rev. Stat. § 646A.570(7).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-572-exempt]: **Or. Rev. Stat. § 646A.572** — "(L) A financial institution, as defined in ORS 706.008, or a financial institution’s affiliate or subsidiary that is only and directly engaged in financial activities, as described in 12 U.S.C. 1843(k), as in effect on January 1, 2024;" *Or. Rev. Stat. § 646A.572(2)(a), (L), (n), (o).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-572-exempt-data]: **Or. Rev. Stat. § 646A.572** — "(b) Protected health information that a covered entity or business associate processes in accordance with, or documents that a covered entity or business associate creates for the purpose of complying with, the Health Insurance Portability and Accountability Act of 1996, P.L. 104-191, and regulations promulgated under the Act, as in effect on January 1, 2024;" *Or. Rev. Stat. § 646A.572(2)(b), (j), (k).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-578-notice]: **Or. Rev. Stat. § 646A.578** — "A controller shall provide to consumers a reasonably accessible, clear and meaningful privacy notice that: (a) Lists the categories of personal data, including the categories of sensitive data, that the controller processes; (b) Describes the controller’s purposes for processing the personal data;" *Or. Rev. Stat. § 646A.578(4).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-578-notice-detail]: **Or. Rev. Stat. § 646A.578** — "(c) Describes how a consumer may exercise the consumer’s rights under ORS 646A.570 to 646A.589, including how a consumer may appeal a controller’s denial of a consumer’s request under ORS 646A.576; (d) Lists all categories of personal data, including the categories of sensitive data, that the controller shares with third parties; (e) Describes all categories of third parties with which the controller shares personal data at a level of detail that enables the consumer to understand what type of entity each third party is and, to the extent possible, how each third party may process personal data;" *Or. Rev. Stat. § 646A.578(4).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-578-minimize]: **Or. Rev. Stat. § 646A.578** — "Limit the controller’s collection of personal data to only the personal data that is adequate, relevant and reasonably necessary to serve the purposes the controller specified in paragraph (a) of this subsection;" *Or. Rev. Stat. § 646A.578(1)(b).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-581-contract]: **Or. Rev. Stat. § 646A.581** — "The processor shall enter into a contract with the controller that governs how the processor processes personal data on the controller’s behalf." *Or. Rev. Stat. § 646A.581(2).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-581-terms]: **Or. Rev. Stat. § 646A.581** — "(b) Set forth clear instructions for processing data, the nature and purpose of the processing, the type of data that is subject to processing and the duration of the processing; (c) Specify the rights and obligations of both parties with respect to the subject matter of the contract; (d) Ensure that each person that processes personal data is subject to a duty of confidentiality with respect to the personal data; (e) Require the processor to delete the personal data or return the personal data to the controller at the controller’s direction or at the end of the provision of services, unless a law requires the processor to retain the personal data; (f) Require the processor to make available to the controller, at the controller’s request, all information the controller needs to verify that the processor has complied with all obligations the processor has under ORS 646A.570 to 646A.589; (g) Require the processor to enter into a subcontract with a person the processor engages to assist with processing personal data on the controller’s behalf and in the subcontract require the subcontractor to meet the processor’s obligations under the processor’s contract with the controller; and (h) Allow the controller, the controller’s designee or a qualified and independent person the processor engages, in accordance with an appropriate and accepted control standard, framework or procedure, to assess the processor’s policies and technical and organizational measures for complying with the processor’s obligations under ORS 646A.570 to 646A.589, and require the processor to cooperate with the assessment and, at the controller’s request, report the results of the assessment to the controller." *Or. Rev. Stat. § 646A.581(2)(b)-(h).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-578-consent]: **Or. Rev. Stat. § 646A.578** — "Process sensitive data about a consumer without first obtaining the consumer’s consent or, if the controller knows the consumer is a child, without processing the sensitive data in accordance with the Children’s Online Privacy Protection Act of 1998, 15 U.S.C. 6501 et seq." *Or. Rev. Stat. § 646A.578(2)(b).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-570-sensitive]: **Or. Rev. Stat. § 646A.570** — "‘Sensitive data’ means personal data that: (A) Reveals a consumer’s racial or ethnic background, national origin, religious beliefs, mental or physical condition or diagnosis, sexual orientation, status as transgender or nonbinary, status as a victim of crime or citizenship or immigration status; (B) Is a child’s personal data;" *Or. Rev. Stat. § 646A.570(18)(a).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-578-signal]: **Or. Rev. Stat. § 646A.578** — "Allow a consumer or authorized agent to send a signal to the controller that indicates the consumer’s preference to opt out of the sale of personal data or targeted advertising under ORS 646A.574 (1)(d) by means of a platform, technology or mechanism that: (A) Does not unfairly disadvantage another controller; (B) Does not use a default setting but instead requires the consumer or authorized agent to make an affirmative, voluntary and unambiguous choice to opt out;" *Or. Rev. Stat. § 646A.578(5)(c).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-589-exclusive]: **Or. Rev. Stat. § 646A.589** — "The Attorney General has exclusive authority to enforce the provisions of ORS 646A.570 to 646A.589. ORS 646A.570 to 646A.589, or any other laws of this state, do not create a private right of action to enforce a violation of ORS 646A.570 to 646A.589." *Or. Rev. Stat. § 646A.589(7).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-589-penalty]: **Or. Rev. Stat. § 646A.589** — "The Attorney General may bring an action to seek a civil penalty of not more than $7,500 for each violation of ORS 646A.570 to 646A.589 or to enjoin a violation or obtain other equitable relief." *Or. Rev. Stat. § 646A.589(4)(a).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-589-cure]: **Or. Rev. Stat. § 646A.589** — "(a) Receives funding from the Corporation for Public Broadcasting or is a primary entry point, national primary or state primary, as defined in 47 C.F.R. 11.18, as in effect on the effective date of this 2025 Act; and (b) Distributes the noncommercial educational broadcast station’s journalism content without cost to recipients." *Or. Laws 2025, ch. 417, § 5(2).* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

[^stat-589-cure-repeal]: **Or. Laws 2025, ch. 417, § 6** — "Section 5 of this 2025 Act is repealed on July 1, 2026." *Or. Laws 2025, ch. 417, § 6.* <https://www.oregonlegislature.gov/bills_laws/ors/ors646A.html>

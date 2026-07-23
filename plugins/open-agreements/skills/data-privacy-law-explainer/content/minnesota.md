---
jurisdiction: "Minnesota"
slug: minnesota
countryCode: US
exportedAt: "2026-07-23"
lawReviewedThrough: "2026-06-06"
canonicalUrl: https://openagreements.org/practice-guides/privacy/us/minnesota
license: CC BY 4.0
stale: false
---

> [!IMPORTANT]
> **Informational only — not legal advice.** This is a snapshot of an OpenAgreements practice guide,
> provided for general information. It is not legal advice, does not create an attorney-client
> relationship, and is not a substitute for a licensed attorney in the relevant jurisdiction.
> Laws change; verify against the canonical version before relying on it.
>
> **Canonical:** https://openagreements.org/practice-guides/privacy/us/minnesota · **Law reviewed through:** 2026-06-06 · **Exported:** 2026-07-23 · License: CC BY 4.0 · © openagreements.org

# Minnesota Consumer Privacy Law (MCDPA)[^about]

The Minnesota Consumer Data Privacy Act gives Minnesota consumers rights over their personal data and imposes notice, contracting, and consent duties on controllers above defined thresholds. Built on the Virginia model but distinctively stricter — it lets consumers demand a list of the specific third parties their data was disclosed to, grants profiling-reevaluation rights, has no general nonprofit exemption, and its right to cure has already sunset. Enforced exclusively by the Attorney General with no private right of action.


## At a glance

| Question | Minnesota |
| --- | --- |
| **Law coverage** | Comprehensive law |
| **Summary** | If you control or process the data of 100,000+ Minnesota consumers (or 25,000+ plus over 25% of revenue from data sales), the MCDPA requires a privacy notice, opt-in consent to process sensitive data, and processor contracts — plus a uniquely strict list-of-third-parties right and profiling-reevaluation rights. The Attorney General enforces it; there are no consumer lawsuits, and the 30-day cure period has already expired. |
| **Main law** | Minn. Stat. §§ 325M.10–325M.21 (Minnesota Consumer Data Privacy Act), effective July 31, 2025 |
| **Privacy policy required?** | Yes — a reasonably accessible, clear, and meaningful notice with statutorily fixed contents |
| **Who does it cover?** | Legal entities doing business in Minnesota (or targeting residents) that control or process the data of 100,000+ consumers a year (excluding payment-only data), or 25,000+ while deriving over 25% of gross revenue from selling data — no general nonprofit exemption; small businesses exempt except they still cannot sell sensitive data without consent |
| **Can consumers sue?** | No |
| **Privacy policy rule** | Policy contents fixed by law |
| **Consent for sensitive data?** | Consent required first |
| **Browser opt-out signals?** | Must be honored |
| **Lawsuit detail** | No — enforcement is exclusively the Attorney General's |
| **Who enforces it?** | Minnesota Attorney General (exclusive) |

## Does the Minnesota Consumer Data Privacy Act apply to your business? {#does-mcdpa-apply}

**Short answer.** It turns on how much consumer data you handle. The MCDPA applies to entities that do business in Minnesota or target its residents and that, in a calendar year, control or process the personal data of at least 100,000 consumers (excluding data used only to complete a payment), or at least 25,000 consumers while deriving over 25% of gross revenue from selling personal data [^stat-12-scope]. A consumer means a Minnesota resident acting in an individual or household context, not someone acting in a commercial or employment role.

Minnesota followed the Virginia template that much of the country copied, but it diverges in ways that matter for triage. There is no general carve-out for nonprofit organizations — most peer states exempt them outright, but here the only nonprofit relief is for organizations established to detect and prevent insurance fraud. Small businesses are excluded from the general framework, yet they remain on the hook for one rule: they may not sell a consumer's sensitive data without prior consent [^stat-17-smallbiz]. The exclusion list otherwise tracks the familiar pattern — government entities, federally recognized tribes, HIPAA, GLBA, FCRA, and FERPA data among them.

## What must your Minnesota privacy policy contain? {#privacy-policy-contents}

**Short answer.** A controller must provide a reasonably accessible, clear, and meaningful privacy notice that lists the categories of personal data processed, the purposes for processing, how consumers exercise and appeal their rights, the categories of data sold or shared and the categories of third parties involved, the controller's contact information, its retention policies, and the date the notice was last updated [^stat-16-notice]. Minnesota also makes you document your compliance program internally — including naming a privacy lead and keeping a data inventory [^stat-18-policies].

For a template privacy policy, section 325M.16 is the content checklist, and it is more prescriptive than many peer laws — note the explicit retention-policy and last-updated-date line items. If you sell personal data, run targeted advertising, or profile in ways that produce legal or significant effects, you must disclose that and provide a clear opt-out method outside the notice itself. Separately, section 325M.18 adds an internal-governance layer most states leave implicit: you must document the policies and procedures you adopted to comply, identify who is responsible, and conduct data privacy and protection assessments for higher-risk processing. The notice the policy presents should match the data practices the controller actually carries out.

## What must your contracts with processors say? {#vendor-contracts}

**Short answer.** A contract between a controller and a processor must govern the processor's data processing on the controller's behalf — so a data processing agreement is a statutory requirement, not a best practice [^stat-13-contract]. That contract has to be binding and spell out the processing instructions, the nature and purpose of processing, the type of data, the duration, and each side's rights and obligations.

Section 325M.13 then specifies the required terms: a duty of confidentiality for everyone handling the data and subcontractor flow-down only after the controller has a chance to object [^stat-13-contract], plus deletion or return of data at the end of the engagement, the information needed to demonstrate compliance, and cooperation with assessments and inspections [^stat-13-terms]. As an alternative to direct inspections, a processor may arrange its own qualified independent assessor at least annually and at its own expense [^stat-13-terms]. A compliant template DPA tracks each of these, and no contract can sign away a party's statutory liability [^stat-13-liability].

## Do you need consent to process sensitive data? {#sensitive-data}

**Short answer.** Yes. Except as the Act otherwise allows, a controller may not process a consumer's sensitive data without obtaining consent, and for a known child it must instead follow the federal Children's Online Privacy Protection Act [^stat-16-consent]. Sensitive data includes personal data revealing race or ethnicity, religious beliefs, a mental or physical health condition or diagnosis, sexual orientation, or citizenship or immigration status; biometric or genetic information used to uniquely identify someone; the data of a known child; and specific geolocation data [^stat-11-sensitive].

This is the opt-in model shared by most of the newer state laws — sensitive data is walled off until the consumer affirmatively agrees, and consent obtained through a dark pattern does not count. Minnesota also requires an easy way to revoke consent, with processing stopping within 15 days, and it bars selling or running targeted advertising on the data of consumers the controller knows to be between 13 and 16 without consent. A multi-state template generally has to support universal opt-out signals to stay compliant across jurisdictions, and Minnesota recognizes those signals too.

## Can a consumer sue your business under the MCDPA? {#consumer-lawsuit}

**Short answer.** No. Nothing in the MCDPA creates a private right of action, so consumers cannot sue under it — the Minnesota Attorney General enforces the law [^stat-20-no-pra]. And unlike several peer states, Minnesota's right to cure was time-limited: the warning-letter-and-30-day-cure provision expired January 31, 2026, so the Attorney General can now bring an enforcement action without first offering a window to fix the problem [^stat-20-cure].

This makes Minnesota's posture stricter than the states whose cure periods are permanent. An uncured violation exposes a controller or processor to an injunction and a civil penalty of up to $7,500 per violation, and the state may also recover its litigation expenses. Because the grace period is gone, the practical move is to stand up the notice, consent, and contracting controls before the Attorney General comes calling rather than counting on a chance to remediate after a complaint.

[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-06-06. License: CC BY 4.0. Steven Obiajulu, J.D. is admitted in New York, not Minnesota. This article synthesizes Minnesota primary law and is not legal advice from a Minnesota-admitted attorney. This article is for informational purposes only and does not create an attorney-client relationship. CC BY 4.0. Cite as Steven Obiajulu, *Minnesota Consumer Privacy Law (MCDPA)*, OpenAgreements (last updated June 6, 2026), https://openagreements.org/practice-guides/privacy/us/minnesota.

[^stat-12-scope]: **Minn. Stat. § 325M.12** — "Sections 325M.10 to 325M.21 apply to legal entities that conduct business in Minnesota or produce products or services that are targeted to residents of Minnesota, and that satisfy one or more of the following thresholds: (1) during a calendar year, controls or processes personal data of 100,000 consumers or more, excluding personal data controlled or processed solely for the purpose of completing a payment transaction; or (2) derives over 25 percent of gross revenue from the sale of personal data and processes or controls personal data of 25,000 consumers or more." *Minn. Stat. § 325M.12, subd. 1(a).* <https://www.revisor.mn.gov/statutes/cite/325M.12>

[^stat-17-smallbiz]: **Minn. Stat. § 325M.17** — "A small business, as defined by the United States Small Business Administration under Code of Federal Regulations, title 13, part 121, that conducts business in Minnesota or produces products or services that are targeted to residents of Minnesota, must not sell a consumer's sensitive data without the consumer's prior consent." *Minn. Stat. § 325M.17(a).* <https://www.revisor.mn.gov/statutes/cite/325M.17>

[^stat-16-notice]: **Minn. Stat. § 325M.16** — "Controllers must provide consumers with a reasonably accessible, clear, and meaningful privacy notice that includes: (1) the categories of personal data processed by the controller; (2) the purposes for which the categories of personal data are processed;" *Minn. Stat. § 325M.16, subd. 1(a).* <https://www.revisor.mn.gov/statutes/cite/325M.16>

[^stat-18-policies]: **Minn. Stat. § 325M.18** — "A controller must document and maintain a description of the policies and procedures the controller has adopted to comply with sections 325M.10 to 325M.21 ." *Minn. Stat. § 325M.18(a).* <https://www.revisor.mn.gov/statutes/cite/325M.18>

[^stat-13-contract]: **Minn. Stat. § 325M.13** — "A contract between a controller and a processor shall govern the processor's data processing procedures with respect to processing performed on behalf of the controller. The contract shall be binding and clearly set forth instructions for processing data, the nature and purpose of processing, the type of data subject to processing, the duration of processing, and the rights and obligations of both parties. The contract shall also require that the processor: (1) ensure that each person processing the personal data is subject to a duty of confidentiality with respect to the data; and (2) engage a subcontractor only (i) after providing the controller with an opportunity to object, and (ii) pursuant to a written contract in accordance with paragraph (e) that requires the subcontractor to meet the obligations of the processor with respect to the personal data." *Minn. Stat. § 325M.13(c).* <https://www.revisor.mn.gov/statutes/cite/325M.13>

[^stat-13-terms]: **Minn. Stat. § 325M.13** — "(e) Processing by a processor shall be governed by a contract between the controller and the processor that is binding on both parties and that sets out the processing instructions to which the processor is bound, including the nature and purpose of the processing, the type of personal data subject to the processing, the duration of the processing, and the obligations and rights of both parties. The contract shall include the requirements imposed by this paragraph, paragraphs (c) and (d), as well as the following requirements: (1) at the choice of the controller, the processor shall delete or return all personal data to the controller as requested at the end of the provision of services, unless retention of the personal data is required by law; (2) upon a reasonable request from the controller, the processor shall make available to the controller all information necessary to demonstrate compliance with the obligations in sections 325M.10 to 325M.21 ; and (3) the processor shall allow for, and contribute to, reasonable assessments and inspections by the controller or the controller's designated assessor. Alternatively, the processor may arrange for a qualified and independent assessor to conduct, at least annually and at the processor's expense, an assessment of the processor's policies and technical and organizational measures in support of the obligations under sections 325M.10 to 325M.21 . The assessor must use an appropriate and accepted control standard or framework and assessment procedure for assessments as applicable, and shall provide a report of an assessment to the controller upon request." *Minn. Stat. § 325M.13(e).* <https://www.revisor.mn.gov/statutes/cite/325M.13>

[^stat-13-liability]: **Minn. Stat. § 325M.13** — "(f) In no event shall any contract relieve a controller or a processor from the liabilities imposed on a controller or processor by virtue of the controller's or processor's roles in the processing relationship under sections 325M.10 to 325M.21 ." *Minn. Stat. § 325M.13(f).* <https://www.revisor.mn.gov/statutes/cite/325M.13>

[^stat-16-consent]: **Minn. Stat. § 325M.16** — "a controller may not process sensitive data concerning a consumer without obtaining the consumer's consent, or, in the case of the processing of personal data concerning a known child, without obtaining consent from the child's parent or lawful guardian, in accordance with the requirement of the Children's Online Privacy Protection Act" *Minn. Stat. § 325M.16, subd. 2(d).* <https://www.revisor.mn.gov/statutes/cite/325M.16>

[^stat-11-sensitive]: **Minn. Stat. § 325M.11** — "Sensitive data is a form of personal data. ‘Sensitive data’ means: (1) personal data revealing racial or ethnic origin, religious beliefs, mental or physical health condition or diagnosis, sexual orientation, or citizenship or immigration status; (2) the processing of biometric data or genetic information for the purpose of uniquely identifying an individual; (3) the personal data of a known child; or (4) specific geolocation data." *Minn. Stat. § 325M.11(v).* <https://www.revisor.mn.gov/statutes/cite/325M.11>

[^stat-20-no-pra]: **Minn. Stat. § 325M.20** — "Nothing in sections 325M.10 to 325M.21 establishes a private right of action, including under section 8.31, subdivision 3a , for a violation of sections 325M.10 to 325M.21 or any other law." *Minn. Stat. § 325M.20(d).* <https://www.revisor.mn.gov/statutes/cite/325M.20>

[^stat-20-cure]: **Minn. Stat. § 325M.20** — "If, after 30 days of issuance of the warning letter, the attorney general believes the controller or processor has failed to cure any alleged violation, the attorney general may bring an enforcement action under paragraph (b). This paragraph expires January 31, 2026." *Minn. Stat. § 325M.20(a).* <https://www.revisor.mn.gov/statutes/cite/325M.20>

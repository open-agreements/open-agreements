---
jurisdiction: "Texas"
slug: texas
countryCode: US
snapshotAsOf: "2026-06-22"
lastReviewed: "2026-06-04"
canonicalUrl: https://openagreements.org/practice-guides/privacy/us/texas
license: CC BY 4.0
stale: false
---

> [!IMPORTANT]
> **Informational only — not legal advice.** This is a snapshot of an OpenAgreements practice note,
> provided for general information. It is not legal advice, does not create an attorney-client
> relationship, and is not a substitute for a licensed attorney in the relevant jurisdiction.
> Laws change; verify against the canonical version before relying on it.
>
> **Canonical:** https://openagreements.org/practice-guides/privacy/us/texas · **Snapshot as of:** 2026-06-22 · License: CC BY 4.0 · © openagreements.org

# Texas Consumer Privacy Law (TDPSA)[^about]

The Texas Data Privacy and Security Act gives Texas consumers rights over their personal data and imposes notice, consent, contracting, and security duties on businesses that are not small businesses — with no revenue threshold, exclusive Attorney General enforcement, and no private right of action.


## At a glance

| Question | Texas |
| --- | --- |
| **Law coverage** | Comprehensive law |
| **Summary** | If you do business in Texas and are not an SBA small business, the TDPSA requires a specific privacy notice, opt-in consent to process sensitive data, and processor contracts — enforced solely by the Attorney General, with no consumer lawsuits. |
| **Main law** | Tex. Bus. & Com. Code ch. 541 (Texas Data Privacy and Security Act) |
| **Privacy policy required?** | Yes — a reasonably accessible and clear notice with statutorily fixed contents |
| **Who does it cover?** | Anyone who does business in Texas (or sells products/services to Texans), processes or sells personal data, and is not a small business as defined by the U.S. Small Business Administration — no revenue or data-volume threshold |
| **Can consumers sue?** | No |
| **Privacy policy rule** | Policy contents fixed by law |
| **Consent for sensitive data?** | Consent required first |
| **Browser opt-out signals?** | Not required |
| **Lawsuit detail** | No — the statute bars any private right of action |
| **Who enforces it?** | Texas Attorney General (exclusive) |

## Does the Texas Data Privacy and Security Act apply to your business? {#does-tdpsa-apply}

**Short answer.** Probably, if you handle Texans' personal data and are not a small business. Unlike California, Texas sets no revenue or data-volume threshold. The TDPSA applies to a person that does business in Texas or produces a product or service consumed by Texas residents, that processes or sells personal data, and that is not a small business as defined by the U.S. Small Business Administration [^stat-002-apply].

This makes the small-business test the practical gatekeeper rather than a dollar figure. The SBA size standards are industry-specific (by revenue or headcount), so applicability turns on your NAICS classification, not a single statewide number. Two further limits matter: the statute reaches only a consumer acting in an individual or household context — not employees or business contacts — and it carries entity-level and data-level exemptions (state agencies, GLBA financial institutions, HIPAA-covered entities, nonprofits, higher education, and FCRA, DPPA, and FERPA data). One carve-out has a sting in its tail: even a small business that is otherwise exempt may not sell sensitive personal data without prior consumer consent.

## What must your Texas privacy policy contain? {#privacy-policy-contents}

**Short answer.** The TDPSA prescribes the contents of the privacy notice directly. A controller must provide a reasonably accessible and clear privacy notice that lists the categories of personal data processed (including any sensitive data), the purposes of processing, how consumers exercise and appeal their rights, the categories of personal data shared with third parties and the categories of those third parties, and a description of the methods for submitting requests [^stat-102-notice].

For a template privacy policy, treat section 541.102 as a checklist: each of its six items must appear on the face of the policy, not be scattered through product UX. Two Texas-specific drafting points go beyond the generic list. First, if you sell personal data to third parties or process it for targeted advertising, you must clearly and conspicuously disclose that processing and how a consumer can opt out of it [^stat-103-optout]. The Texas text requires opt-out disclosure and request methods, but it does not add a Colorado- or Oregon-style duty to honor universal browser or global device opt-out signals. Second, if you sell sensitive or biometric personal data, the statute requires the policy to carry fixed, word-for-word notice sentences saying so — there is no room to paraphrase them.

## What must your contracts with processors say? {#vendor-contracts}

**Short answer.** Whenever a processor handles personal data on your behalf, the TDPSA requires a written contract that governs the processing — making a data processing agreement a statutory requirement, not a best practice [^stat-104-contract].

Section 541.104 then specifies what that contract must contain: clear processing instructions, the nature and purpose of the processing, the types of data and duration, the parties' rights and obligations, and processor commitments to confidentiality, to delete or return data at the controller's direction, to make available the information needed to demonstrate compliance, to cooperate with assessments, and to bind any subcontractors by written contract to the same terms [^stat-104-terms]. A compliant template DPA tracks each of these elements.

## Do you need consent to process sensitive data? {#sensitive-data-consent}

**Short answer.** Yes. The TDPSA requires opt-in consent before processing a consumer's sensitive data, and for a known child it requires handling the data in accordance with the federal Children's Online Privacy Protection Act [^stat-101-consent]. Sensitive data includes data revealing race or ethnicity, religion, health diagnoses, sexuality, or immigration status; genetic or biometric data used to identify a person; data from a known child; and precise geolocation.

Consent under the statute means a clear affirmative act reflecting a freely given, specific, informed, and unambiguous agreement — so pre-checked boxes and buried terms do not qualify. Selling sensitive data triggers an additional, non-negotiable disclosure: the controller must include the statute's exact sensitive-data and biometric sale-notice sentences in its notice [^stat-102-salenotice].

## Can a consumer sue your business under the TDPSA? {#consumer-lawsuit}

**Short answer.** No. The TDPSA expressly provides that it may not be construed as a basis for, or as being subject to, a private right of action — so consumers cannot sue under it [^stat-156-nopra]. Enforcement is exclusively the Texas Attorney General's, who may seek civil penalties of up to $7,500 per violation after a 30-day cure period [^stat-155-penalty].

The practical consequence is that TDPSA exposure is regulatory, not class-action driven. The Attorney General must give written notice identifying the alleged violations and a 30-day window to cure before suing; a business that cures and certifies it has done so avoids the penalty. That posture is already live — the Attorney General has brought and announced TDPSA actions, including a suit over the covert sale of precise-geolocation driving data — so the cure period is a real off-ramp, not a reason to defer compliance.

[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-06-04. License: CC BY 4.0. Steven Obiajulu, J.D. is admitted in New York, not Texas. This article synthesizes Texas primary law and is not legal advice from a Texas-admitted attorney. This article is for informational purposes only and does not create an attorney-client relationship.

[^stat-002-apply]: **Tex. Bus. & Com. Code § 541.002** — "This chapter applies only to a person that: (1) conducts business in this state or produces a product or service consumed by residents of this state; (2) processes or engages in the sale of personal data; and (3) is not a small business as defined by the United States Small Business Administration, except to the extent that Section 541.107 applies to a person described by this subdivision." *Tex. Bus. & Com. Code § 541.002(a).* <https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm>

[^stat-102-notice]: **Tex. Bus. & Com. Code § 541.102** — "A controller shall provide consumers with a reasonably accessible and clear privacy notice that includes: (1) the categories of personal data processed by the controller, including, if applicable, any sensitive data processed by the controller; (2) the purpose for processing personal data; (3) how consumers may exercise their consumer rights under Subchapter B, including the process by which a consumer may appeal a controller's decision with regard to the consumer's request; (4) if applicable, the categories of personal data that the controller shares with third parties; (5) if applicable, the categories of third parties with whom the controller shares personal data; and (6) a description of the methods required under Section 541.055 through which consumers can submit requests to exercise their consumer rights under this chapter." *Tex. Bus. & Com. Code § 541.102(a).* <https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm>

[^stat-103-optout]: **Tex. Bus. & Com. Code § 541.103** — "If a controller sells personal data to third parties or processes personal data for targeted advertising, the controller shall clearly and conspicuously disclose that process and the manner in which a consumer may exercise the right to opt out of that process." *Tex. Bus. & Com. Code § 541.103.* <https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm>

[^stat-104-contract]: **Tex. Bus. & Com. Code § 541.104** — "A contract between a controller and a processor shall govern the processor's data processing procedures with respect to processing performed on behalf of the controller." *Tex. Bus. & Com. Code § 541.104(b).* <https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm>

[^stat-104-terms]: **Tex. Bus. & Com. Code § 541.104** — "The contract must include: (1) clear instructions for processing data; (2) the nature and purpose of processing; (3) the type of data subject to processing; (4) the duration of processing; (5) the rights and obligations of both parties; and (6) a requirement that the processor shall: (A) ensure that each person processing personal data is subject to a duty of confidentiality with respect to the data; (B) at the controller's direction, delete or return all personal data to the controller as requested after the provision of the service is completed, unless retention of the personal data is required by law; (C) make available to the controller, on reasonable request, all information in the processor's possession necessary to demonstrate the processor's compliance with the requirements of this chapter; (D) allow, and cooperate with, reasonable assessments by the controller or the controller's designated assessor; and (E) engage any subcontractor pursuant to a written contract that requires the subcontractor to meet the requirements of the processor with respect to the personal data." *Tex. Bus. & Com. Code § 541.104(b).* <https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm>

[^stat-101-consent]: **Tex. Bus. & Com. Code § 541.101** — "process the sensitive data of a consumer without obtaining the consumer's consent, or, in the case of processing the sensitive data of a known child, without processing that data in accordance with the Children's Online Privacy Protection Act of 1998 (15 U.S.C. Section 6501 et seq.)." *Tex. Bus. & Com. Code § 541.101(b)(4).* <https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm>

[^stat-102-salenotice]: **Tex. Bus. & Com. Code § 541.102(b)** — "If a controller engages in the sale of personal data that is sensitive data, the controller shall include the following notice" *Tex. Bus. & Com. Code § 541.102(b).* <https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm>

[^stat-156-nopra]: **Tex. Bus. & Com. Code § 541.156** — "This chapter may not be construed as providing a basis for, or being subject to, a private right of action for a violation of this chapter or any other law." *Tex. Bus. & Com. Code § 541.156.* <https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm>

[^stat-155-penalty]: **Tex. Bus. & Com. Code § 541.155** — "A person who violates this chapter following the cure period described by Section 541.154 or who breaches a written statement provided to the attorney general under that section is liable for a civil penalty in an amount not to exceed $7,500 for each violation." *Tex. Bus. & Com. Code § 541.155(a).* <https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm>

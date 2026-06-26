---
jurisdiction: "Maryland"
slug: maryland
countryCode: US
snapshotAsOf: "2026-06-26"
lastReviewed: "2026-06-06"
canonicalUrl: https://openagreements.org/practice-guides/privacy/us/maryland
license: CC BY 4.0
stale: false
---

> [!IMPORTANT]
> **Informational only — not legal advice.** This is a snapshot of an OpenAgreements practice note,
> provided for general information. It is not legal advice, does not create an attorney-client
> relationship, and is not a substitute for a licensed attorney in the relevant jurisdiction.
> Laws change; verify against the canonical version before relying on it.
>
> **Canonical:** https://openagreements.org/practice-guides/privacy/us/maryland · **Snapshot as of:** 2026-06-26 · License: CC BY 4.0 · © openagreements.org

# Maryland Consumer Privacy Law (MODPA)[^about]

The Maryland Online Data Privacy Act gives Maryland consumers rights over their personal data and imposes notice, contracting, and consent duties on controllers above defined thresholds — it is notably stricter than the Virginia-style model, banning the sale of sensitive data outright and limiting sensitive-data collection to what is strictly necessary, and is enforced exclusively by the Attorney General with no private right of action.


## At a glance

| Question | Maryland |
| --- | --- |
| **Law coverage** | Comprehensive law |
| **Summary** | If you meet the 35,000-consumer (or 10,000 plus 20%-data-sale) threshold in Maryland, MODPA requires a detailed privacy notice and processor contracts, limits sensitive-data collection to what is strictly necessary, and bans the sale of sensitive data and of a minor's data outright — enforced by the Attorney General, with a cure period that sunsets for violations after April 1, 2027 and no consumer lawsuits. |
| **Main law** | Md. Code Ann., Com. Law §§ 14-4701 et seq. (Maryland Online Data Privacy Act) |
| **Privacy policy required?** | Yes — a reasonably accessible, clear, and meaningful notice with statutorily fixed contents, including detailed third-party disclosures |
| **Who does it cover?** | Persons doing business in Maryland (or targeting residents) that, in the prior calendar year, controlled or processed the data of 35,000+ consumers, or 10,000+ consumers while deriving more than 20% of gross revenue from selling data — a low threshold with only a narrow nonprofit carve-out |
| **Can consumers sue?** | No |
| **Privacy policy rule** | Policy contents fixed by law |
| **Consent for sensitive data?** | Opt-out right or limits instead |
| **Browser opt-out signals?** | Not required |
| **Lawsuit detail** | No — enforcement is exclusively the Attorney General's Consumer Protection Division |
| **Who enforces it?** | Maryland Attorney General, Consumer Protection Division (exclusive) |

## Does the Maryland Online Data Privacy Act apply to your business? {#does-modpa-apply}

**Short answer.** It turns mostly on consumer volume, and the bar is low. MODPA applies to persons that do business in Maryland or target its residents and that, in the prior calendar year, controlled or processed the personal data of at least 35,000 consumers, or at least 10,000 consumers while deriving more than 20% of gross revenue from selling personal data [^stat-4702-apply].

The 35,000-consumer trigger is far lower than the 100,000-consumer floor in many peer states, so MODPA reaches a much wider band of mid-market businesses; data processed solely to complete a payment transaction is excluded from the count. There is no general dollar-revenue floor. Maryland's exemptions are also narrower than the norm: it carves out state agencies and GLBA-regulated financial institutions, but the nonprofit exemption is limited to nonprofits that process data solely to assist law-enforcement insurance-fraud investigations or first responders in catastrophic events, so an ordinary charity that hits the threshold is covered. A consumer is a Maryland resident acting in an individual or household context, not an employee or business contact.

## What must your Maryland privacy policy contain? {#privacy-policy-contents}

**Short answer.** A controller must provide a reasonably accessible, clear, and meaningful privacy notice that lists the categories of personal data processed (including sensitive data), the purpose for processing, how consumers exercise and appeal their rights and revoke consent, the categories of third parties data is shared with and the categories of data shared, and a contact mechanism [^stat-4707-notice].

Section 14-4707(d) is the content checklist, and one item is more demanding than in most states: the third-party disclosure must be detailed enough to let a consumer understand the type of, business model of, or processing conducted by each third party — generic labels like service providers or marketing partners will not satisfy it. A controller that sells personal data or processes it for targeted advertising must also clearly and conspicuously disclose that and how to opt out, and MODPA pairs the notice with data minimization and an easy consent-revocation path. The notice the policy presents should match the data practices the controller actually carries out.

## What must your contracts with processors say? {#vendor-contracts}

**Short answer.** A controller that uses a processor must enter into a binding contract governing the processor's data processing on the controller's behalf — so a data processing agreement is a statutory requirement, not a best practice [^stat-4708-contract].

Section 14-4708 then specifies the required terms: processing instructions, the nature and purpose of processing, the type of data and the duration, and the rights and obligations of both parties — plus mandatory covenants that the processor keep staff under a duty of confidentiality, maintain reasonable security, delete or return data at the controller's direction, provide the information needed to demonstrate compliance, bind subcontractors by written contract to the same obligations, and cooperate with assessments [^stat-4708-terms]. A compliant template DPA tracks each of these.

## What are the rules for sensitive data? {#sensitive-data}

**Short answer.** Maryland is stricter than the opt-in model used elsewhere. A controller may not collect, process, or share sensitive data unless doing so is strictly necessary to provide or maintain a specific product or service the consumer requested, and it may not sell sensitive data at all [^stat-4707-sensitive]. Consent does not unlock either limit. Sensitive data is defined broadly to include data revealing racial or ethnic origin, religious beliefs, consumer health data, sex life, sexual orientation, transgender or nonbinary status, national origin, or citizenship or immigration status; genetic or biometric data; a known child's data; and precise geolocation.

This strictly necessary ceiling is the headline difference from the consent-based approach in most states: a consumer clicking I agree cannot authorize collecting sensitive data that is not needed to deliver the requested service, nor can it authorize a sale. The sale ban is categorical rather than an opt-out. MODPA layers on a parallel ban for minors — a controller may not sell the personal data of a consumer it knew or should have known is under 18, nor target advertising to them. For a multi-state program, a Maryland-compliant posture generally means turning off sensitive-data sales and most secondary uses of sensitive data for Maryland residents, not relying on a consent banner.

## Can a consumer sue your business under MODPA? {#consumer-lawsuit}

**Short answer.** No. A MODPA violation is treated as an unfair, abusive, or deceptive trade practice under the Maryland Consumer Protection Act, enforced by the Attorney General's Consumer Protection Division — and the statute routes enforcement to that machinery while excluding the Consumer Protection Act's private-action section [^stat-4713-enforce]. For an alleged violation occurring on or before April 1, 2027, the Division may issue a notice of violation if a cure is possible, after which the business gets at least 60 days to cure [^stat-4714-cure].

There is no standalone private right of action — consumers cannot sue controllers or processors directly for MODPA violations, though the statute preserves any other remedy provided by law. The cure window is discretionary, not automatic, and it is time-limited: it applies only to violations on or before April 1, 2027, after which the Division can act without a notice-and-cure step. Because penalties run under the Consumer Protection Act and can be assessed per violation, the practical posture is to build the notice, minimization, sensitive-data, and contracting controls up front rather than relying on the cure period.

[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-06-06. License: CC BY 4.0. Steven Obiajulu, J.D. is admitted in New York, not Maryland. This article synthesizes Maryland primary law and is not legal advice from a Maryland-admitted attorney. This article is for informational purposes only and does not create an attorney-client relationship.

[^stat-4702-apply]: **Md. Code Ann., Com. Law § 14-4702** — "(1) Controlled or processed the personal data of at least 35,000 consumers, excluding personal data controlled or processed solely for the purpose of completing a payment transaction; or (2) Controlled or processed the personal data of at least 10,000 consumers and derived more than 20% of its gross revenue from the sale of personal data." *Md. Code Ann., Com. Law § 14-4702.* <https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4702>

[^stat-4707-notice]: **Md. Code Ann., Com. Law § 14-4707** — "A controller shall provide a consumer with a reasonably accessible, clear, and meaningful privacy notice that includes: (1) The categories of personal data processed by the controller, including sensitive data; (2) The controller’s purpose for processing personal data; (3) How a consumer may exercise the consumer’s rights under this subtitle, including how a consumer may appeal a controller’s decision regarding the consumer’s request or may revoke consent; (4) The categories of third parties with which the controller shares personal data with a level of detail that enables a consumer to understand the type of, business model of, or processing conducted by each third party; (5) The categories of personal data, including sensitive data, that the controller shares with third parties; and (6) An active e–mail address or other online mechanism that a consumer may use to contact the controller." *Md. Code Ann., Com. Law § 14-4707(d).* <https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4707>

[^stat-4708-contract]: **Md. Code Ann., Com. Law § 14-4708** — "If a controller uses a processor to process the personal data of consumers, the controller and the processor shall enter into a contract that governs the processor’s data processing procedures with respect to processing performed on behalf of the controller." *Md. Code Ann., Com. Law § 14-4708(a)(1).* <https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4708>

[^stat-4708-terms]: **Md. Code Ann., Com. Law § 14-4708** — "(2) The contract shall be binding and shall clearly set forth: (i) Instructions for processing data; (ii) The nature and purpose of processing; (iii) The type of data subject to processing; (iv) The duration of processing; and (v) The rights and obligations of both parties. (3) The contract shall require that the processor: (i) Ensure that each person processing personal data is subject to a duty of confidentiality with respect to the personal data; (ii) Establish, implement, and maintain reasonable administrative, technical, and physical data security practices to protect the confidentiality, integrity, and accessibility of personal data, considering the volume and nature of the personal data; (iii) Stop processing data on request by the controller made in accordance with a consumer’s authenticated request; (iv) At the controller’s direction, delete or return all personal data to the controller as requested at the end of the provision of service, unless retention of the personal data is required by law; (v) On the reasonable request of the controller, make available to the controller all information in the processor’s possession necessary to demonstrate the processor’s compliance with the obligations in this subtitle; (vi) After providing the controller an opportunity to object, engage a subcontractor to assist with processing personal data on the controller’s behalf only in accordance with a written contract that requires the subcontractor to meet the processor’s obligations regarding the personal data under the processor’s contract with the controller; and (vii) Allow and cooperate with reasonable assessments by the controller, the controller’s designated assessor, or a qualified and independent assessor arranged for by the processor to assess the processor’s policies and technical and organizational measures in support of the obligations under this subtitle." *Md. Code Ann., Com. Law § 14-4708(a)(2)–(3).* <https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4708>

[^stat-4707-sensitive]: **Md. Code Ann., Com. Law § 14-4707** — "A controller may not: (1) Except where the collection or processing is strictly necessary to provide or maintain a specific product or service requested by the consumer to whom the personal data pertains, collect, process, or share sensitive data concerning a consumer; (2) Sell sensitive data;" *Md. Code Ann., Com. Law § 14-4707(a).* <https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4707>

[^stat-4713-enforce]: **Md. Code Ann., Com. Law § 14-4713** — "a violation of this subtitle is: (1) An unfair, abusive, or deceptive trade practice within the meaning of Title 13 of this article; and (2) Subject to the enforcement and penalty provisions contained in Title 13 of this article, except for § 13–408 of this article." *Md. Code Ann., Com. Law § 14-4713(a).* <https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4713>

[^stat-4714-cure]: **Md. Code Ann., Com. Law § 14-4714** — "If the Division issues a notice of violation under subsection (b) of this section, the controller or processor shall have at least 60 days to cure the violation after receipt of the notice." *Md. Code Ann., Com. Law § 14-4714(c)(1).* <https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4714>

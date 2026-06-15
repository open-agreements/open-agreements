---
jurisdiction: "Utah"
slug: utah
countryCode: US
snapshotAsOf: "2026-06-15"
lastReviewed: "2026-06-04"
canonicalUrl: https://openagreements.org/legal/privacy/utah
license: CC BY 4.0
stale: false
---

> [!IMPORTANT]
> **Informational only — not legal advice.** This is a snapshot of an OpenAgreements practice note,
> provided for general information. It is not legal advice, does not create an attorney-client
> relationship, and is not a substitute for a licensed attorney in the relevant jurisdiction.
> Laws change; verify against the canonical version before relying on it.
>
> **Canonical:** https://openagreements.org/legal/privacy/utah · **Snapshot as of:** 2026-06-15 · License: CC BY 4.0 · © openagreements.org

# Utah Consumer Privacy Law (UCPA)[^about]

The Utah Consumer Privacy Act gives Utah consumers rights over their personal data and imposes notice, contracting, and sensitive-data duties on larger businesses — it has the narrowest applicability of the state privacy laws, treats sensitive data as notice-and-opt-out rather than opt-in, is enforced exclusively by the Attorney General after a 30-day cure, and provides no private right of action.


## At a glance

| Question | Utah |
| --- | --- |
| **Law coverage** | Comprehensive law |
| **Summary** | The UCPA covers only larger businesses ($25M+ revenue plus a volume threshold). Covered controllers must post a privacy notice, give notice and an opt-out before processing sensitive data, sign processor contracts, and honor opt-outs — enforced by the Attorney General after a 30-day cure, with no consumer lawsuits. |
| **Main law** | Utah Code §§ 13-61-101 et seq. (Utah Consumer Privacy Act) |
| **Privacy policy required?** | Yes — a reasonably accessible and clear notice with statutorily fixed contents |
| **Who does it cover?** | Controllers or processors doing business in Utah (or targeting Utahns) with $25,000,000+ annual revenue that also process the data of 100,000+ consumers a year, or 25,000+ while deriving 50%+ of revenue from selling data |
| **Can consumers sue?** | No |
| **Privacy policy rule** | Policy contents fixed by law |
| **Consent for sensitive data?** | Opt-out right or limits instead |
| **Browser opt-out signals?** | Not required |
| **Lawsuit detail** | No — enforcement is exclusively the Attorney General's |
| **Who enforces it?** | Utah Attorney General (after Division of Consumer Protection investigation) |

## Does the Utah Consumer Privacy Act apply to your business? {#does-ucpa-apply}

**Short answer.** Only if you are a larger business — Utah has the highest applicability bar of the state privacy laws. The UCPA reaches a controller or processor that does business in Utah or targets Utah residents, has annual revenue of $25,000,000 or more, and also meets a volume threshold: processing the data of 100,000 or more consumers a year, or 25,000 or more while deriving over 50% of revenue from selling personal data [^stat-102-apply].

The combination is what makes Utah narrow: it requires a $25M revenue floor on top of a consumer-volume threshold, so a high-volume business under $25M is not covered (the inverse of Colorado, which has no revenue floor and even reaches nonprofits). As elsewhere, a consumer is a Utah resident acting in an individual or household context — not an employee or business contact — and the usual GLBA, HIPAA, and FCRA entity- and data-level exemptions apply.

## What must your Utah privacy policy contain? {#privacy-policy-contents}

**Short answer.** A covered controller must provide a reasonably accessible and clear privacy notice that lists the categories of personal data processed, the purposes of processing, how consumers exercise their rights, the categories of personal data shared with third parties, and the categories of those third parties [^stat-302-notice].

For a template privacy policy, section 13-61-302 is the content checklist. Utah's list is close to the other states' but lighter in two ways worth noting: the UCPA does not require a separate appeal process the way Colorado and Texas do, and it imposes no data-protection-assessment obligation. A controller that sells personal data or processes it for targeted advertising must still clearly disclose that and how to opt out, but the UCPA does not require controllers to honor universal browser or global device opt-out signals.

## What must your contracts with processors say? {#vendor-contracts}

**Short answer.** Before a processor handles personal data on your behalf, the UCPA requires a contract — so a data processing agreement is a statutory prerequisite, not a best practice. The contract must set out the processing instructions, the nature and purpose of the processing, the data type and duration, and the parties' rights and obligations [^stat-301-contract].

Section 13-61-301 adds the rest: the processor must keep personnel under a duty of confidentiality, and must bind any subcontractor by a written contract to the same obligations. A compliant template DPA carries each of these terms.

## Do you need consent to process sensitive data? {#sensitive-data}

**Short answer.** No — and this is where Utah is notably more permissive than other states. Rather than requiring opt-in consent, the UCPA lets a controller process an adult's sensitive data as long as it first presents the consumer with clear notice and an opportunity to opt out; for a known child, it must instead follow the federal Children's Online Privacy Protection Act [^stat-302-sensitive].

This notice-and-opt-out model is the opposite of California, Colorado, and Texas, which all require affirmative opt-in consent before processing sensitive data. For a business operating across states, the practical consequence is that a Utah-only flow can rely on opt-out, but a multi-state template generally has to default to the stricter opt-in standard to stay compliant everywhere.

## Can a consumer sue your business under the UCPA? {#consumer-lawsuit}

**Short answer.** No. The Attorney General has exclusive authority to enforce the UCPA, so there is no private right of action for consumers [^stat-402-exclusive]. Enforcement runs through the Division of Consumer Protection (which takes complaints and investigates) and then the Attorney General, and a controller gets at least 30 days' written notice and a chance to cure before any action [^stat-402-cure].

Unlike Colorado, Utah's cure period has not been repealed — it remains a built-in off-ramp. Penalties run up to $7,500 per violation. The compliance posture is still to build the notice, opt-out, and contracting controls up front, but a covered business that receives a notice has a genuine window to fix the issue before penalties attach.

[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-06-04. License: CC BY 4.0. Steven Obiajulu, J.D. is admitted in New York, not Utah. This article synthesizes Utah primary law and is not legal advice from a Utah-admitted attorney. This article is for informational purposes only and does not create an attorney-client relationship.

[^stat-102-apply]: **Utah Code § 13-61-102** — "This chapter applies to any controller or processor who: (a) (i) conducts business in the state; or (ii) produces a product or service that is targeted to consumers who are residents of the state; (b) has annual revenue of $25,000,000 or more; and (c) satisfies one or more of the following thresholds:" *Utah Code § 13-61-102(1).* <https://le.utah.gov/xcode/Title13/Chapter61/13-61-S102.html>

[^stat-302-notice]: **Utah Code § 13-61-302** — "A controller shall provide consumers with a reasonably accessible and clear privacy notice that includes: (i) the categories of personal data processed by the controller; (ii) the purposes for which the categories of personal data are processed;" *Utah Code § 13-61-302(1)(a).* <https://le.utah.gov/xcode/Title13/Chapter61/13-61-S302.html>

[^stat-301-contract]: **Utah Code § 13-61-301** — "Before a processor performs processing on behalf of a controller, the processor and controller shall enter into a contract that: (a) clearly sets forth instructions for processing personal data, the nature and purpose of the processing, the type of data subject to processing, the duration of the processing, and the parties' rights and obligations;" *Utah Code § 13-61-301(2).* <https://le.utah.gov/xcode/Title13/Chapter61/13-61-S301.html>

[^stat-302-sensitive]: **Utah Code § 13-61-302** — "process sensitive data collected from a consumer without: (a) first presenting the consumer with clear notice and an opportunity to opt out of the processing; or (b) in the case of the processing of personal data concerning a known child, processing the data in accordance with the federal Children's Online Privacy Protection Act" *Utah Code § 13-61-302(3).* <https://le.utah.gov/xcode/Title13/Chapter61/13-61-S302.html>

[^stat-402-exclusive]: **Utah Code § 13-61-402** — "The attorney general has the exclusive authority to enforce this chapter." *Utah Code § 13-61-402(1).* <https://le.utah.gov/xcode/Title13/Chapter61/13-61-S402.html>

[^stat-402-cure]: **Utah Code § 13-61-402** — "At least 30 days before the day on which the attorney general initiates an enforcement action against a controller or processor, the attorney general shall provide the controller or processor: (i) written notice identifying each provision of this chapter the attorney general alleges the controller or processor has violated or is violating;" *Utah Code § 13-61-402(3)(a).* <https://le.utah.gov/xcode/Title13/Chapter61/13-61-S402.html>

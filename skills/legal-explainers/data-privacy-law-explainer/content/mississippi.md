---
jurisdiction: "Mississippi"
slug: mississippi
countryCode: US
snapshotAsOf: "2026-06-18"
lastReviewed: "2026-06-12"
canonicalUrl: https://openagreements.org/practice-guides/privacy/us/mississippi
license: CC BY 4.0
stale: false
---

> [!IMPORTANT]
> **Informational only — not legal advice.** This is a snapshot of an OpenAgreements practice note,
> provided for general information. It is not legal advice, does not create an attorney-client
> relationship, and is not a substitute for a licensed attorney in the relevant jurisdiction.
> Laws change; verify against the canonical version before relying on it.
>
> **Canonical:** https://openagreements.org/practice-guides/privacy/us/mississippi · **Snapshot as of:** 2026-06-18 · License: CC BY 4.0 · © openagreements.org

# Mississippi Consumer Privacy Law[^about]

Mississippi has no comprehensive consumer-privacy statute. The operative framework is Miss. Code Ann. § 75-24-29 for breach notification, plus the consumer-protection deceptive-practices statute and its narrow individual private remedy.


## At a glance

| Question | Mississippi |
| --- | --- |
| **Law coverage** | No comprehensive law |
| **Summary** | Mississippi has not enacted an omnibus consumer-privacy law, so there are no general state-law access, deletion, correction, sale opt-out, targeted-advertising opt-out, controller, processor, or privacy-notice duties. The state-law privacy program is breach notice, vendor notice-up, and truthfulness of consumer-facing privacy promises. |
| **Main law** | Miss. Code Ann. § 75-24-29 (data-breach notification), plus Miss. Code Ann. §§ 75-24-5 and 75-24-15 for unfair or deceptive trade practices and individual consumer remedies — Mississippi has no comprehensive consumer-privacy statute |
| **Privacy policy required?** | No Mississippi statute generally requires a consumer privacy policy or fixes its contents; a policy that misstates actual practices is reachable as a deceptive-practices risk under Miss. Code Ann. § 75-24-5 and FTC Act § 5, with GLBA, HIPAA, COPPA, and other sectoral laws supplying notices where they apply |
| **Who does it cover?** | The breach-notification statute applies to any person conducting business in Mississippi that, in the ordinary course of business, owns, licenses, or maintains personal information of a Mississippi resident; the deceptive-practices statute reaches unfair methods of competition and unfair or deceptive trade practices in or affecting commerce |
| **Can consumers sue?** | Limited path |
| **Privacy policy rule** | No state policy checklist |
| **Consent for sensitive data?** | No special rule |
| **Browser opt-out signals?** | Not required |
| **Lawsuit detail** | No private right of action under the breach-notification section; § 75-24-15 gives an individual purchaser or lessee who suffers ascertainable loss a private action for prohibited practices, but class actions are barred |
| **Who enforces it?** | Mississippi Attorney General |

## Which privacy laws apply to your business in Mississippi? {#which-privacy-laws-apply}

**Short answer.** Mississippi has no comprehensive consumer-privacy law. The generally applicable state privacy framework is two-part: the breach-notification statute, which applies to any person conducting business in Mississippi that owns, licenses, or maintains personal information of Mississippi residents in the ordinary course of business [^ms-breach-scope], and the consumer-protection prohibition on unfair methods of competition and unfair or deceptive trade practices in or affecting commerce [^ms-deceptive-practices].

That means Mississippi residents do not have general state-law rights to access, delete, correct, or port their personal data; businesses do not have Mississippi-specific duties to honor sale opt-outs, targeted-advertising opt-outs, or universal opt-out signals; and there is no general Mississippi controller, processor, data-protection-assessment, or privacy-notice statute. The breach law governs incident response. The deceptive-practices law governs what a business tells consumers.

The rest of a Mississippi-facing privacy program comes from the federal and sectoral overlay: FTC Act § 5 for deceptive or unfair practices, GLBA for financial institutions, HIPAA for covered health entities and business associates, COPPA for child-directed services, and other states' comprehensive privacy laws when a Mississippi business reaches their residents and thresholds.

## What must your Mississippi privacy policy contain? {#privacy-policy-contents}

**Short answer.** No Mississippi statute generally requires a consumer privacy policy or fixes its contents. The binding state-law rule is truthfulness: unfair or deceptive trade practices in or affecting commerce are prohibited [^q2-ms-deceptive]. A privacy policy that misstates how the business collects, uses, shares, secures, or retains data is therefore a deceptive-practices risk under Mississippi law and independently under FTC Act § 5 [^q2-ftc5].

Where a sectoral regime applies, that regime supplies the notice contents. A GLBA financial institution may not disclose nonpublic personal information to nonaffiliated third parties unless it has provided the consumer a compliant privacy notice [^q2-glba-notice]. A HIPAA covered entity must give individuals notice of protected-health-information uses and disclosures, rights, and legal duties [^q2-hipaa-notice]. COPPA bars covered operators from collecting children's personal information in violation of the FTC's notice and parental-consent regulations [^q2-coppa-notice].

For everyone else, the practical Mississippi drafting rule is: say what you do, and do what you say. A multistate policy should still describe data categories, purposes, third-party disclosures, retention, security, consumer choices, and contact methods because other states may require those elements. But Mississippi itself does not create a standalone policy checklist.

> [!NOTE]
> **Practice note.**
>
> Do not describe Mississippi as an opt-out or consumer-rights state. The Mississippi sources captured here support breach notice and deceptive-practices exposure, not general access, deletion, correction, or sale opt-out rights [^q2-ms-deceptive].

## What must your contracts with vendors say? {#vendor-contracts}

**Short answer.** Mississippi has no general data-processing-agreement statute. It does not prescribe controller-to-processor instructions, deletion clauses, audit rights, or subprocessor flow-downs. The Mississippi-specific vendor rule is breach-response flow-up: a person conducting business in Mississippi that maintains computerized personal information it does not own or license must notify the owner or licensee as soon as practicable after discovery of a breach, if the personal information was or is reasonably believed to have been acquired by an unauthorized person for fraudulent purposes [^q3-vendor-notice].

Write that flow-up duty into vendor contracts. The statute gives the duty but leaves the operational details open, so the contract should specify the notice channel, what counts as discovery, required incident facts, forensic cooperation, timing for updates, responsibility for resident notice, and cost allocation. Because Mississippi's resident notice is due without unreasonable delay, a vendor's slow notice can consume the owner's response window.

Federal regimes add fuller terms where they apply. The GLBA Safeguards Rule requires financial institutions to oversee service providers, including by requiring safeguards by contract and reassessing providers over time [^q3-glba-safeguards]. HIPAA requires a written business-associate agreement establishing permitted uses and disclosures before protected health information is shared [^q3-hipaa-baa]. Outside those regimes, carry the standard multistate protections anyway: processing limited to documented instructions, confidentiality, reasonable security, breach notice back to your business on a fixed clock, cooperation, and return or deletion at the end of the engagement.

## When must you notify people of a data breach in Mississippi? {#breach-notification}

**Short answer.** Mississippi requires notice to all affected individuals without unreasonable delay after a covered breach, subject to completing an investigation, identifying affected individuals, restoring system integrity, and any law-enforcement or national-security delay [^q4-resident-notice]. There is no fixed day-count deadline in the captured statute. Individual notice is not required if, after an appropriate investigation, the person reasonably determines that the breach will not likely result in harm to affected individuals [^q4-harm-offramp].

The trigger is acquisition-based and narrower than access-only statutes. A breach of security means unauthorized acquisition of electronic files, media, databases, or computerized data containing personal information when access to that personal information has not been secured by encryption or another method or technology rendering it unreadable or unusable [^q4-breach-def]. An affected individual is a Mississippi resident whose personal information was, or is reasonably believed to have been, intentionally acquired by an unauthorized person through a breach [^q4-affected-individual].

Mississippi's personal-information definition is the traditional identity-theft trio: first name or first initial and last name plus Social Security number, driver's license/state ID/tribal ID number, or financial-account/payment-card number with a required security code, access code, or password that would permit access to the financial account [^q4-pi-def]. Publicly available information from government records or widely distributed media is excluded.

Notice may be written, telephone, or electronic if electronic communication is the primary communication method with affected individuals or E-SIGN-consistent. Substitute notice is available if notice cost would exceed $5,000, the affected class exceeds 5,000 individuals, or sufficient contact information is unavailable, and it requires email where available, conspicuous website posting where the person maintains a website, and notice to major statewide media including newspapers, radio, and television [^q4-notice-methods].

There is no general Attorney General breach-notice threshold in § 75-24-29. Instead, failure to comply is itself an unfair trade practice enforced by the Attorney General, and the section expressly says it does not create a private right of action [^q4-enforcement].

## Can a consumer sue your business in Mississippi over privacy? {#consumer-lawsuit}

**Short answer.** Not under the breach-notification section itself: § 75-24-29 expressly says it does not create a private right of action [^q5-no-breach-pra]. The available private route is narrower: an individual who purchases or leases goods or services primarily for personal, family, or household purposes and suffers an ascertainable loss from a practice prohibited by § 75-24-5 may bring an action or assert the loss as a setoff or counterclaim [^q5-individual-action].

That consumer-protection remedy is not a general privacy class-action statute. A private plaintiff must first make a reasonable attempt to resolve the claim through an informal dispute-settlement program approved by the Attorney General [^q5-informal-dispute]. And Mississippi bars class actions under the chapter: every private action must be maintained in the name and for the sole use and benefit of the individual person [^q5-class-bar].

For privacy disputes, the practical distinction is this: a missed breach-notice duty belongs to the Attorney General under § 75-24-29, while a consumer-facing privacy misrepresentation may fit § 75-24-5 and § 75-24-15 only if the plaintiff can satisfy the statute's purchase-or-lease, personal/family/household-purpose, ascertainable-loss, and procedural requirements.

[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-06-12. License: CC BY 4.0. Steven Obiajulu, J.D. is admitted in New York, not Mississippi. This article synthesizes Mississippi primary law and is not legal advice from a Mississippi-admitted attorney. This article is for informational purposes only and does not create an attorney-client relationship.

[^ms-breach-scope]: **Miss. Code Ann. § 75-24-29** — "This section applies to any person who conducts business in this state and who, in the ordinary course of the person’s business functions, owns, licenses or maintains personal information of any resident of this state." *Miss. Code Ann. § 75-24-29(1).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627R-MSW3-GXJ9-31CB-00008-00>

[^ms-deceptive-practices]: **Miss. Code Ann. § 75-24-5** — "Unfair methods of competition affecting commerce and unfair or deceptive trade practices in or affecting commerce are prohibited." *Miss. Code Ann. § 75-24-5(1).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6FD9-SMJ3-SD6B-V4MW-00008-00>

[^q2-ms-deceptive]: **Miss. Code Ann. § 75-24-5** — "Unfair methods of competition affecting commerce and unfair or deceptive trade practices in or affecting commerce are prohibited." *Miss. Code Ann. § 75-24-5(1).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6FD9-SMJ3-SD6B-V4MW-00008-00>

[^q2-ftc5]: **FTC Act § 5** — "Unfair methods of competition in or affecting commerce, and unfair or deceptive acts or practices in or affecting commerce, are hereby declared unlawful." *15 U.S.C. § 45(a)(1).* <https://www.law.cornell.edu/uscode/text/15/45#:~:text=Unfair%20methods%20of%20competition%20in,commerce%2C%20are%20hereby%20declared%20unlawful.>

[^q2-glba-notice]: **GLBA privacy notice** — "a financial institution may not, directly or through any affiliate, disclose to a nonaffiliated third party any nonpublic personal information, unless such financial institution provides or has provided to the consumer a notice that complies with section 6803 of this title." *15 U.S.C. § 6802(a).* <https://www.law.cornell.edu/uscode/text/15/6802#:~:text=a%20financial%20institution%20may%20not%2C,section%206803%20of%20this%20title.>

[^q2-hipaa-notice]: **HIPAA Notice of Privacy Practices** — "an individual has a right to adequate notice of the uses and disclosures of protected health information that may be made by the covered entity, and of the individual's rights and the covered entity's legal duties with respect to protected health information" *45 C.F.R. § 164.520(a)(1).* <https://www.law.cornell.edu/cfr/text/45/164.520#:~:text=an%20individual%20has%20a%20right,respect%20to%20protected%20health%20information>

[^q2-coppa-notice]: **COPPA** — "It is unlawful for an operator of a website or online service directed to children, or any operator that has actual knowledge that it is collecting personal information from a child, to collect personal information from a child in a manner that violates the regulations prescribed under subsection (b)." *15 U.S.C. § 6502(a)(1).* <https://www.law.cornell.edu/uscode/text/15/6502#:~:text=It%20is%20unlawful%20for%20an,regulations%20prescribed%20under%20subsection%20(b).>

[^q3-vendor-notice]: **Miss. Code Ann. § 75-24-29** — "Any person who conducts business in this state that maintains computerized data which includes personal information that the person does not own or license shall notify the owner or licensee of the information of any breach of the security of the data as soon as practicable following its discovery" *Miss. Code Ann. § 75-24-29(4).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627R-MSW3-GXJ9-31CB-00008-00>

[^q3-glba-safeguards]: **GLBA Safeguards Rule** — "Oversee service providers, by: (1) Taking reasonable steps to select and retain service providers that are capable of maintaining appropriate safeguards for the customer information at issue; (2) Requiring your service providers by contract to implement and maintain such safeguards; and (3) Periodically assessing your service providers based on the risk they present and the continued adequacy of their safeguards." *16 C.F.R. § 314.4(f).* <https://www.law.cornell.edu/cfr/text/16/314.4#:~:text=Oversee%20service%20providers%2C%20by%3A%20(1),continued%20adequacy%20of%20their%20safeguards.>

[^q3-hipaa-baa]: **HIPAA Business Associate Contracts** — "A contract between the covered entity and a business associate must: (i) Establish the permitted and required uses and disclosures of protected health information by the business associate." *45 C.F.R. § 164.504(e)(2).* <https://www.law.cornell.edu/cfr/text/45/164.504#:~:text=A%20contract%20between%20the%20covered,information%20by%20the%20business%20associate.>

[^q4-resident-notice]: **Miss. Code Ann. § 75-24-29** — "A person who conducts business in this state shall disclose any breach of security to all affected individuals. The disclosure shall be made without unreasonable delay, subject to the provisions of subsections (4) and (5) of this section and the completion of an investigation by the person to determine the nature and scope of the incident, to identify the affected individuals, or to restore the reasonable integrity of the data system." *Miss. Code Ann. § 75-24-29(3).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627R-MSW3-GXJ9-31CB-00008-00>

[^q4-harm-offramp]: **Miss. Code Ann. § 75-24-29** — "Notification shall not be required if, after an appropriate investigation, the person reasonably determines that the breach will not likely result in harm to the affected individuals." *Miss. Code Ann. § 75-24-29(3).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627R-MSW3-GXJ9-31CB-00008-00>

[^q4-breach-def]: **Miss. Code Ann. § 75-24-29** — "‘Breach of security’ means unauthorized acquisition of electronic files, media, databases or computerized data containing personal information of any resident of this state when access to the personal information has not been secured by encryption or by any other method or technology that renders the personal information unreadable or unusable" *Miss. Code Ann. § 75-24-29(2)(a).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627R-MSW3-GXJ9-31CB-00008-00>

[^q4-affected-individual]: **Miss. Code Ann. § 75-24-29** — "‘Affected individual’ means any individual who is a resident of this state whose personal information was, or is reasonably believed to have been, intentionally acquired by an unauthorized person through a breach of security." *Miss. Code Ann. § 75-24-29(2)(b)(iv).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627R-MSW3-GXJ9-31CB-00008-00>

[^q4-pi-def]: **Miss. Code Ann. § 75-24-29** — "‘Personal information’ means an individual’s first name or first initial and last name in combination with any one or more of the following data elements:" *Miss. Code Ann. § 75-24-29(2)(b).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627R-MSW3-GXJ9-31CB-00008-00>

[^q4-notice-methods]: **Miss. Code Ann. § 75-24-29** — "substitute notice, provided the person demonstrates that the cost of providing notice in accordance with paragraph (a), (b) or (c) of this subsection would exceed Five Thousand Dollars ($5,000.00), that the affected class of subject persons to be notified exceeds five thousand (5,000) individuals or the person does not have sufficient contact information." *Miss. Code Ann. § 75-24-29(6).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627R-MSW3-GXJ9-31CB-00008-00>

[^q4-enforcement]: **Miss. Code Ann. § 75-24-29** — "Failure to comply with the requirements of this section shall constitute an unfair trade practice and shall be enforced by the Attorney General; however, nothing in this section may be construed to create a private right of action." *Miss. Code Ann. § 75-24-29(8).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627R-MSW3-GXJ9-31CB-00008-00>

[^q5-no-breach-pra]: **Miss. Code Ann. § 75-24-29** — "Failure to comply with the requirements of this section shall constitute an unfair trade practice and shall be enforced by the Attorney General; however, nothing in this section may be construed to create a private right of action." *Miss. Code Ann. § 75-24-29(8).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627R-MSW3-GXJ9-31CB-00008-00>

[^q5-individual-action]: **Miss. Code Ann. § 75-24-15** — "any person who purchases or leases goods or services primarily for personal, family or household purposes and thereby suffers any ascertainable loss of money or property, real or personal, as a result of the use or employment by the seller, lessor, manufacturer or producer of a method, act or practice prohibited by Section 75-24-5 may bring an action at law" *Miss. Code Ann. § 75-24-15(1).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627H-RXF3-GXJ9-31SS-00008-00>

[^q5-informal-dispute]: **Miss. Code Ann. § 75-24-15** — "In any private action brought under this chapter, the plaintiff must have first made a reasonable attempt to resolve any claim through an informal dispute settlement program approved by the Attorney General." *Miss. Code Ann. § 75-24-15(2).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627H-RXF3-GXJ9-31SS-00008-00>

[^q5-class-bar]: **Miss. Code Ann. § 75-24-15** — "Nothing in this chapter shall be construed to permit any class action or suit, but every private action must be maintained in the name of and for the sole use and benefit of the individual person." *Miss. Code Ann. § 75-24-15(4).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A627H-RXF3-GXJ9-31SS-00008-00>

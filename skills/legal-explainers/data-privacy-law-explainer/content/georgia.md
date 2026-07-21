---
jurisdiction: "Georgia"
slug: georgia
countryCode: US
snapshotAsOf: "2026-07-20"
lastReviewed: "2026-06-12"
canonicalUrl: https://openagreements.org/practice-guides/privacy/us/georgia
license: CC BY 4.0
stale: false
---

> [!IMPORTANT]
> **Informational only — not legal advice.** This is a snapshot of an OpenAgreements practice guide,
> provided for general information. It is not legal advice, does not create an attorney-client
> relationship, and is not a substitute for a licensed attorney in the relevant jurisdiction.
> Laws change; verify against the canonical version before relying on it.
>
> **Canonical:** https://openagreements.org/practice-guides/privacy/us/georgia · **Snapshot as of:** 2026-07-20 · License: CC BY 4.0 · © openagreements.org

# Georgia Consumer Privacy Law[^about]

Georgia has no comprehensive consumer-privacy statute. The operative framework is the Identity Theft article's breach-notification law plus the Georgia Fair Business Practices Act as the deception hook, with FTC Act, GLBA, HIPAA, and COPPA duties layered on top where they apply.


## At a glance

| Question | Georgia |
| --- | --- |
| **Law coverage** | No comprehensive law |
| **Summary** | Georgia has not enacted an omnibus consumer-privacy law, so there are no general state-law access, deletion, correction, opt-out, controller, processor, or privacy-notice duties. The current Georgia obligations are breach notification for information brokers and government data collectors, a fast 24-hour vendor notice-up rule, and truth-in-privacy-policy exposure through the Fair Business Practices Act and FTC Act § 5. |
| **Main law** | O.C.G.A. §§ 10-1-910 to 10-1-912 (identity theft and data-breach notification) plus the Georgia Fair Business Practices Act, O.C.G.A. §§ 10-1-390 to 10-1-408 — Georgia has no comprehensive consumer-privacy statute |
| **Privacy policy required?** | No Georgia statute generally requires a consumer privacy policy or fixes its contents; a policy that misstates actual practices is reachable as a deceptive practice under the FBPA and FTC Act § 5, with GLBA, HIPAA, COPPA, and other sectoral laws supplying notices where they apply |
| **Who does it cover?** | The breach-notification statute reaches information brokers and government data collectors that maintain computerized personal information about individuals, and gives vendors holding that data a 24-hour notice-up duty; the FBPA reaches unfair or deceptive practices in consumer transactions and consumer acts or practices in trade or commerce |
| **Can consumers sue?** | Limited path |
| **Privacy policy rule** | No state policy checklist |
| **Consent for sensitive data?** | No special rule |
| **Browser opt-out signals?** | Not required |
| **Lawsuit detail** | Not expressly under the breach-notification article; the FBPA gives injured persons an individual action, but not a representative action, after a 30-day demand, with treble actual damages for intentional violations and attorney-fee shifting |
| **Who enforces it?** | Georgia Attorney General |

## Which privacy laws apply to your business in Georgia? {#which-privacy-laws-apply}

**Short answer.** Georgia has no comprehensive consumer-privacy law. The generally applicable state framework has two pieces: the Identity Theft article, which requires breach notice by an information broker or data collector that maintains computerized personal information [^ga-breach-duty], and the Georgia Fair Business Practices Act (FBPA), which declares unfair or deceptive practices in consumer transactions and consumer acts or practices in trade or commerce unlawful [^ga-fbpa-unlawful]. Neither statute gives Georgia residents general rights to access, delete, correct, or opt out of sale or targeted advertising.

The breach article is narrower than many states' breach laws. It covers an *information broker* — a person or entity that, for fees or dues, is in the business of collecting and furnishing personal information to nonaffiliated third parties — and a *data collector*, which Georgia defines as a state or local government agency or subdivision, with several public-record and law-enforcement carve-outs [^ga-defs-covered]. Ordinary businesses that do not fit the information-broker definition can still be affected as vendors, because a person or business maintaining covered computerized data on behalf of an information broker or data collector must notify that owner within 24 hours after discovery of a breach [^ga-vendor-24h].

The FBPA is the state-law backstop for consumer-facing privacy promises. Its purpose is to protect consumers and legitimate businesses from unfair or deceptive practices in trade or commerce in Georgia, and the General Assembly directs courts to construe it consistently with federal-court interpretations of FTC Act § 5 [^ga-fbpa-purpose]. That makes a public privacy policy a real legal artifact even though Georgia does not prescribe a privacy-policy template: if the policy misstates how the business collects, uses, shares, secures, or retains data, the theory is deception rather than violation of an omnibus privacy code.

The rest of the program rides federal and sectoral law. FTC Act § 5 reaches deceptive or unfair privacy practices nationwide; GLBA governs financial institutions; HIPAA governs covered health entities and their business associates; COPPA governs services directed to children under 13; and other states' comprehensive laws can apply to a Georgia business that meets their thresholds.

## What must your Georgia privacy policy contain? {#privacy-policy-contents}

**Short answer.** No Georgia statute generally requires a consumer privacy policy or fixes what it must say. The binding rule is consistency: the FBPA prohibits unfair or deceptive practices in consumer transactions [^q2-fbpa-unlawful], and the statute is construed consistently with FTC Act § 5 [^q2-fbpa-ftc]. A policy that misstates actual data practices is therefore exposed as a deceptive-practices problem under Georgia and federal law, even though Georgia has no omnibus privacy-policy checklist.

In practice, build the Georgia policy from the regimes that actually bind the business. A financial institution may not disclose nonpublic personal information to nonaffiliated third parties unless it has provided the consumer a GLBA-compliant privacy notice [^q2-glba-notice]. A HIPAA covered entity must give individuals notice of permitted uses and disclosures, rights, and the entity's legal duties [^q2-hipaa-notice]. COPPA bars an operator of a child-directed site or service, or an operator with actual knowledge it collects children's personal information, from collecting that information in violation of the FTC's notice and parental-consent rules [^q2-coppa-notice].

For everyone else, Georgia does not supply an itemized state notice list. Use a best-practice policy — categories of personal information collected, purposes, categories of third parties, retention, security, consumer choices, and contact methods — because other states may require those contents and because the enforceable Georgia question is whether the statement matches the conduct. Do not promise deletion, opt-out, sale limits, geolocation limits, or retention schedules unless the operating program can honor them.

> [!NOTE]
> **Practice note.**
>
> In Georgia, the absence of an omnibus privacy-policy statute is not permission to publish loose language. The FBPA reaches deception in the consumer marketplace, and the General Assembly expressly tied its construction to FTC Act § 5; treat every privacy-policy sentence as a representation that operations must support [^q2-fbpa-ftc].

## What must your contracts with vendors say? {#vendor-contracts}

**Short answer.** Georgia has no general data-processing-agreement statute. It does not prescribe controller-to-processor instructions, audit rights, deletion clauses, or subprocessor flow-downs for ordinary privacy vendors. The Georgia-specific vendor duty is narrow but fast: a person or business maintaining covered computerized personal information on behalf of an information broker or data collector must notify that owner within 24 hours after discovering a breach, if the personal information was or is reasonably believed to have been acquired by an unauthorized person [^q3-vendor-24h].

That 24-hour rule is the term to hard-wire into Georgia-facing vendor agreements. The statute gives the vendor a statutory notice-up duty, but the contract should supply the mechanics: who receives notice, what counts as discovery, what facts must be included, how quickly forensic updates follow, who sends resident notices, who notifies consumer reporting agencies if the incident exceeds 10,000 Georgia residents, and who pays response costs.

Where a federal or sectoral regime applies, it supplies the fuller contract terms. The GLBA Safeguards Rule requires financial institutions to oversee service providers by selecting capable providers, requiring safeguards by contract, and periodically assessing them [^q3-glba-safeguards]. HIPAA requires a written business-associate agreement before protected health information is shared, including permitted uses and disclosures and downstream protections [^q3-hipaa-baa]. Outside those regimes, use the multistate best-practice clauses anyway: processing limited to documented instructions, confidentiality, reasonable security, breach notice back to your business on a short clock, cooperation with notices and investigations, and return or deletion at the end of the engagement.

## When must you notify people of a data breach in Georgia? {#breach-notification}

**Short answer.** For covered information brokers and data collectors, notice must go to each affected Georgia resident in the most expedient time possible and without unreasonable delay after discovery or notification of a breach, subject to law-enforcement delay and time needed to determine scope and restore reasonable system integrity [^q4-resident-notice]. Georgia sets no fixed outer day-count for resident notice, but vendors maintaining covered data they do not own have a hard 24-hour notice-up clock to the information broker or data collector [^q4-vendor-24h].

Georgia's trigger is acquisition-based. A breach of the security of the system means unauthorized acquisition of electronic data that compromises the security, confidentiality, or integrity of personal information; good-faith employee or agent acquisition or use is excluded if it is not used or further disclosed without authorization [^q4-breach-def]. The resident notice duty applies when unencrypted personal information was, or is reasonably believed to have been, acquired by an unauthorized person [^q4-resident-notice].

The 2024 amendment to the definition of *personal information* matters. Georgia still covers first name or first initial and last name combined with an unencrypted or unredacted Social Security number, driver's license or state ID number, account or payment-card number usable without additional credentials, account passwords, PINs, or access codes [^q4-pi-def]. But it also now covers those same identity-theft-enabling items even when they are not connected to the person's name, if the compromised information would be sufficient to perform or attempt identity theft [^q4-pi-standalone]. Publicly available government-record information is excluded.

Notice methods include written, telephone, and E-SIGN-consistent electronic notice. Substitute notice is available only if the cost exceeds $50,000, the affected class exceeds 100,000, or the business lacks sufficient contact information; substitute notice requires all three components: email where available, conspicuous website posting where the broker or collector maintains a website, and notice to major statewide media [^q4-notice-methods]. If more than 10,000 Georgia residents must be notified at one time, the information broker or data collector must also notify all nationwide consumer reporting agencies without unreasonable delay about the timing, distribution, and content of the notices [^q4-cra].

There is no general Georgia Attorney General notice threshold in these captured sections. The Georgia-specific incident-response routing is therefore resident notice, 24-hour vendor notice-up, law-enforcement delay where applicable, and nationwide consumer-reporting-agency notice for incidents over 10,000 residents.

> [!NOTE]
> **Practice note.**
>
> The 24-hour vendor clock is shorter than many standard incident-response clauses. For Georgia-covered data, a contract that gives a vendor three, five, or ten business days to report a breach can be too slow for the statutory notice-up duty [^q4-vendor-24h].

## Can a consumer sue your business in Georgia over privacy? {#consumer-lawsuit}

**Short answer.** The breach-notification article captured here does not create an express private right of action. The private-suit path is the FBPA: a person injured by consumer acts or practices in violation of the FBPA may bring an individual action, but not a representative action, for equitable injunctive relief and general and exemplary damages [^q5-fbpa-private-action]. Before filing, the claimant generally must send a written demand at least 30 days in advance identifying the unfair or deceptive practice and the injury suffered [^q5-demand].

The FBPA remedy can be meaningful where a privacy theory fits the statute. A court must award three times actual damages for an intentional violation [^q5-treble], and if the court finds an FBPA violation, the injured person is awarded reasonable attorney's fees and litigation expenses, subject to the statute's rejected-settlement limitations and bad-faith rules [^q5-fees]. The Attorney General must also be served with the initial complaint and amended complaints within 20 days after filing, and may be heard in the action [^q5-ag-service].

The constraint is scope. The FBPA reaches unfair or deceptive practices in consumer transactions and consumer acts or practices in trade or commerce [^q5-fbpa-unlawful]. A privacy-policy misrepresentation in a consumer-facing service is the natural Georgia theory; a purely internal employment-data issue, a one-off private dispute, or an incident outside the consumer marketplace is a harder fit. For data-breach-only claims, Georgia's identity-theft article supplies the notice standard, but not an express damages remedy in these sections.

[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-06-12. License: CC BY 4.0. Steven Obiajulu, J.D. is admitted in New York, not Georgia. This article synthesizes Georgia primary law and is not legal advice from a Georgia-admitted attorney. This article is for informational purposes only and does not create an attorney-client relationship. CC BY 4.0. Cite as Steven Obiajulu, *Georgia Consumer Privacy Law*, OpenAgreements (last updated June 12, 2026), https://openagreements.org/practice-guides/privacy/us/georgia.

[^ga-breach-duty]: **O.C.G.A. § 10-1-912** — "Any information broker or data collector that maintains computerized data that includes personal information of individuals shall give notice of any breach of the security of the system following discovery or notification of the breach in the security of the data to any resident of this state whose unencrypted personal information was, or is reasonably believed to have been, acquired by an unauthorized person." *O.C.G.A. § 10-1-912(a).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6348-FSJ1-DYB7-W1RP-00008-00>

[^ga-fbpa-unlawful]: **O.C.G.A. § 10-1-393** — "Unfair or deceptive acts or practices in the conduct of consumer transactions and consumer acts or practices in trade or commerce are declared unlawful." *O.C.G.A. § 10-1-393(a).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6FX8-GHW3-RTDX-K0FH-00008-00>

[^ga-defs-covered]: **O.C.G.A. § 10-1-911** — "‘Information broker’ means any person or entity who, for monetary fees or dues, engages in whole or in part in the business of collecting, assembling, evaluating, compiling, reporting, transmitting, transferring, or communicating information concerning individuals for the primary purpose of furnishing personal information to nonaffiliated third parties" *O.C.G.A. § 10-1-911(2)-(3).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6C0M-58Y3-SK2M-M1R5-00008-00>

[^ga-vendor-24h]: **O.C.G.A. § 10-1-912** — "Any person or business that maintains computerized data on behalf of an information broker or data collector that includes personal information of individuals that the person or business does not own shall notify the information broker or data collector of any breach of the security of the system within 24 hours following discovery" *O.C.G.A. § 10-1-912(b).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6348-FSJ1-DYB7-W1RP-00008-00>

[^ga-fbpa-purpose]: **O.C.G.A. § 10-1-391** — "The purpose of this part shall be to protect consumers and legitimate business enterprises from unfair or deceptive practices in the conduct of any trade or commerce in part or wholly in the state." *O.C.G.A. § 10-1-391(a)-(b).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6348-FSJ1-DYB7-W1B2-00008-00>

[^q2-fbpa-unlawful]: **O.C.G.A. § 10-1-393** — "Unfair or deceptive acts or practices in the conduct of consumer transactions and consumer acts or practices in trade or commerce are declared unlawful." *O.C.G.A. § 10-1-393(a).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6FX8-GHW3-RTDX-K0FH-00008-00>

[^q2-fbpa-ftc]: **O.C.G.A. § 10-1-391** — "It is the intent of the General Assembly that this part be interpreted and construed consistently with interpretations given by the Federal Trade Commission in the federal courts pursuant to Section 5(a)(1) of the Federal Trade Commission Act (15 U.S.C. Section 45(a)(1)), as from time to time amended." *O.C.G.A. § 10-1-391(b).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6348-FSJ1-DYB7-W1B2-00008-00>

[^q2-glba-notice]: **GLBA privacy notice** — "a financial institution may not, directly or through any affiliate, disclose to a nonaffiliated third party any nonpublic personal information, unless such financial institution provides or has provided to the consumer a notice that complies with section 6803 of this title." *15 U.S.C. § 6802(a).* <https://www.law.cornell.edu/uscode/text/15/6802#:~:text=a%20financial%20institution%20may%20not%2C,section%206803%20of%20this%20title.>

[^q2-hipaa-notice]: **HIPAA Notice of Privacy Practices** — "an individual has a right to adequate notice of the uses and disclosures of protected health information that may be made by the covered entity, and of the individual's rights and the covered entity's legal duties with respect to protected health information" *45 C.F.R. § 164.520(a)(1).* <https://www.law.cornell.edu/cfr/text/45/164.520#:~:text=an%20individual%20has%20a%20right,respect%20to%20protected%20health%20information>

[^q2-coppa-notice]: **COPPA** — "It is unlawful for an operator of a website or online service directed to children, or any operator that has actual knowledge that it is collecting personal information from a child, to collect personal information from a child in a manner that violates the regulations prescribed under subsection (b)." *15 U.S.C. § 6502(a)(1).* <https://www.law.cornell.edu/uscode/text/15/6502#:~:text=It%20is%20unlawful%20for%20an,regulations%20prescribed%20under%20subsection%20(b).>

[^q3-vendor-24h]: **O.C.G.A. § 10-1-912** — "Any person or business that maintains computerized data on behalf of an information broker or data collector that includes personal information of individuals that the person or business does not own shall notify the information broker or data collector of any breach of the security of the system within 24 hours following discovery, if the personal information was, or is reasonably believed to have been, acquired by an unauthorized person." *O.C.G.A. § 10-1-912(b).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6348-FSJ1-DYB7-W1RP-00008-00>

[^q3-glba-safeguards]: **GLBA Safeguards Rule** — "Oversee service providers, by: (1) Taking reasonable steps to select and retain service providers that are capable of maintaining appropriate safeguards for the customer information at issue; (2) Requiring your service providers by contract to implement and maintain such safeguards; and (3) Periodically assessing your service providers based on the risk they present and the continued adequacy of their safeguards." *16 C.F.R. § 314.4(f).* <https://www.law.cornell.edu/cfr/text/16/314.4#:~:text=Oversee%20service%20providers%2C%20by%3A%20(1),continued%20adequacy%20of%20their%20safeguards.>

[^q3-hipaa-baa]: **HIPAA Business Associate Contracts** — "A contract between the covered entity and a business associate must: (i) Establish the permitted and required uses and disclosures of protected health information by the business associate." *45 C.F.R. § 164.504(e)(2).* <https://www.law.cornell.edu/cfr/text/45/164.504#:~:text=A%20contract%20between%20the%20covered,information%20by%20the%20business%20associate.>

[^q4-resident-notice]: **O.C.G.A. § 10-1-912** — "The notice shall be made in the most expedient time possible and without unreasonable delay, consistent with the legitimate needs of law enforcement, as provided in subsection (c) of this Code section, or with any measures necessary to determine the scope of the breach and restore the reasonable integrity, security, and confidentiality of the data system." *O.C.G.A. § 10-1-912(a).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6348-FSJ1-DYB7-W1RP-00008-00>

[^q4-vendor-24h]: **O.C.G.A. § 10-1-912** — "Any person or business that maintains computerized data on behalf of an information broker or data collector that includes personal information of individuals that the person or business does not own shall notify the information broker or data collector of any breach of the security of the system within 24 hours following discovery" *O.C.G.A. § 10-1-912(b).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6348-FSJ1-DYB7-W1RP-00008-00>

[^q4-breach-def]: **O.C.G.A. § 10-1-911** — "‘Breach of the security of the system’ means unauthorized acquisition of an individual’s electronic data that compromises the security, confidentiality, or integrity of personal information of such individual maintained by an information broker or data collector." *O.C.G.A. § 10-1-911(1).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6C0M-58Y3-SK2M-M1R5-00008-00>

[^q4-pi-def]: **O.C.G.A. § 10-1-911** — "‘Personal information’ means an individual’s first name or first initial and last name in combination with any one or more of the following data elements, when either the name or the data elements are not encrypted or redacted" *O.C.G.A. § 10-1-911(6)(A)-(D).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6C0M-58Y3-SK2M-M1R5-00008-00>

[^q4-pi-standalone]: **O.C.G.A. § 10-1-911** — "Any of the items contained in subparagraphs (A) through (D) of this paragraph when not in connection with the individual’s first name or first initial and last name, if the information compromised would be sufficient to perform or attempt to perform identity theft against the person whose information was compromised." *O.C.G.A. § 10-1-911(6)(E).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6C0M-58Y3-SK2M-M1R5-00008-00>

[^q4-notice-methods]: **O.C.G.A. § 10-1-911** — "Substitute notice, if the information broker or data collector demonstrates that the cost of providing notice would exceed $50,000.00, that the affected class of individuals to be notified exceeds 100,000, or that the information broker or data collector does not have sufficient contact information to provide written or electronic notice to such individuals." *O.C.G.A. § 10-1-911(4).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6C0M-58Y3-SK2M-M1R5-00008-00>

[^q4-cra]: **O.C.G.A. § 10-1-912** — "In the event that an information broker or data collector discovers circumstances requiring notification pursuant to this Code section of more than 10,000 residents of this state at one time, the information broker or data collector shall also notify, without unreasonable delay, all consumer reporting agencies that compile and maintain files on consumers on a nation-wide basis" *O.C.G.A. § 10-1-912(d).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6348-FSJ1-DYB7-W1RP-00008-00>

[^q5-fbpa-private-action]: **O.C.G.A. § 10-1-399** — "any person who suffers injury or damages as a result of a violation of Chapter 5B of this title, as a result of consumer acts or practices in violation of this part, as a result of office supply transactions in violation of this part or whose business or property has been injured or damaged as a result of such violations may bring an action individually, but not in a representative capacity" *O.C.G.A. § 10-1-399(a).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6FX3-0RK3-RWYN-91FC-00008-00>

[^q5-demand]: **O.C.G.A. § 10-1-399** — "At least 30 days prior to the filing of any such action, a written demand for relief, identifying the claimant and reasonably describing the unfair or deceptive act or practice relied upon and the injury suffered, shall be delivered to any prospective respondent." *O.C.G.A. § 10-1-399(b).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6FX3-0RK3-RWYN-91FC-00008-00>

[^q5-treble]: **O.C.G.A. § 10-1-399** — "Subject to subsection (b) of this Code section, a court shall award three times actual damages for an intentional violation." *O.C.G.A. § 10-1-399(c).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6FX3-0RK3-RWYN-91FC-00008-00>

[^q5-fees]: **O.C.G.A. § 10-1-399** — "If the court finds in any action that there has been a violation of this part, the person injured by such violation shall, in addition to other relief provided for in this Code section and irrespective of the amount in controversy, be awarded reasonable attorneys’ fees and expenses of litigation incurred in connection with said action" *O.C.G.A. § 10-1-399(d).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6FX3-0RK3-RWYN-91FC-00008-00>

[^q5-ag-service]: **O.C.G.A. § 10-1-399** — "In any action brought under this Code section the Attorney General shall be served by certified or registered mail or statutory overnight delivery with a copy of the initial complaint and any amended complaint within 20 days of the filing of such complaint." *O.C.G.A. § 10-1-399(g).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6FX3-0RK3-RWYN-91FC-00008-00>

[^q5-fbpa-unlawful]: **O.C.G.A. § 10-1-393** — "Unfair or deceptive acts or practices in the conduct of consumer transactions and consumer acts or practices in trade or commerce are declared unlawful." *O.C.G.A. § 10-1-393(a).* <https://advance.lexis.com/document/?pdmfid=1000516&pddocfullpath=%2Fshared%2Fdocument%2Fstatutes-legislation%2Furn%3AcontentItem%3A6FX8-GHW3-RTDX-K0FH-00008-00>
